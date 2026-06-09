// legacyzero-brain.ts
// LegacyZero runtime agent modes — four Anthropic call functions with context injection.
//
// All four functions:
//   - Accept env (Env) and a SupportContextPackage from support-context.ts
//   - Build a complete system prompt using legacyzero-prompts.ts assemblers
//   - Call Anthropic API using existing env.ANTHROPIC_API_KEY pattern
//   - Apply robust JSON parsing (strip fences → parse → regex extract → fallback)
//   - Never throw — return typed fallback on any failure
//
// Functions exported:
//   runLegacyZeroTriage              — ticket classification, returns TriageResult
//   runLegacyZeroConversation        — conversation turn, returns ConversationResult
//   runLegacyZeroLearningSuggestion  — post-resolution KB candidate, returns LearningResult | null
//   runLegacyZeroAgentSummary        — workspace briefing, returns AgentSummaryResult

import type { Env } from './support-proxy';
import type { SupportContextPackage } from './support-context';
import {
  buildContextBlock,
  assembleTriageSystemPrompt,
  assembleConversationSystemPrompt,
  assembleLearningSystemPrompt,
  assembleAgentSummarySystemPrompt,
  LEGACYZERO_TRIAGE_PROMPT_V1,
} from './legacyzero-prompts';

// ---------------------------------------------------------------------------
// Anthropic API constants
// ---------------------------------------------------------------------------

const ANTHROPIC_API_URL      = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION      = '2023-06-01';
const ANTHROPIC_BETA_CACHE   = 'prompt-caching-2024-07-31';

const MODEL_SONNET  = 'claude-sonnet-4-20250514';   // triage + learning (higher reasoning)
const MODEL_HAIKU   = 'claude-haiku-4-5-20251001';  // conversation + agent summary (low latency)

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface TriageResult {
  category:               string;
  priority:               string;
  problem:                string;
  suggestedAction:        string;
  subcategory:            string | null;
  confidence:             number;
  // Auto-response fields (populated by runLegacyZeroTriage when called at ticket creation)
  customer_response?:     string;
  resolved?:              boolean;
  resolution_note?:       string | null;
  escalation_recommended?: boolean;
  source_quality:         'brain' | 'kb_only' | 'none';
  // Internal metadata
  _rawResponse?:          string;
  _parseError?:           string;
}

export interface ConversationResult {
  customer_response:  string;
  resolved:           boolean;
  confidence:         number;
  source_quality:     'brain' | 'kb_only' | 'none';
  _rawResponse?:      string;
  _parseError?:       string;
}

export interface LearningResult {
  worthy:           true;
  problem:          string;
  solution:         string;
  category:         string;
  subcategory:      string | null;
  tags:             string[];
  confidence:       number;
  source_ticket_id: string | null;
  suggested_title:  string;
}

export interface AgentSummaryResult {
  situation:         string;
  suggested_action:  string;
  sla_risk:          'ok' | 'warning' | 'critical';
  escalation_flag:   boolean;
  escalation_reason: string | null;
  kb_reference:      string | null;
  resolved_by_ai:    boolean;
  confidence:        number;
  _rawResponse?:     string;
  _parseError?:      string;
}

// ---------------------------------------------------------------------------
// Fallback values
// ---------------------------------------------------------------------------

const TRIAGE_FALLBACK: TriageResult = {
  category:               'general',
  priority:               'medium',
  problem:                'Customer-reported issue requires agent review.',
  suggestedAction:        'Review conversation and classify manually.',
  subcategory:            null,
  confidence:             0.30,
  customer_response:      'Thank you for reaching out. A team member will review your issue shortly.',
  resolved:               false,
  resolution_note:        null,
  escalation_recommended: true,
  source_quality:         'none',
  _parseError:            'fallback',
};

const CONVERSATION_FALLBACK: ConversationResult = {
  customer_response: 'Could you give me a bit more detail so I can help you correctly?',
  resolved:          false,
  confidence:        0.40,
  source_quality:    'none',
  _parseError:       'fallback',
};

const AGENT_SUMMARY_FALLBACK: AgentSummaryResult = {
  situation:         'Summary unavailable — review the conversation directly.',
  suggested_action:  'Read the full conversation thread and respond accordingly.',
  sla_risk:          'ok',
  escalation_flag:   false,
  escalation_reason: null,
  kb_reference:      null,
  resolved_by_ai:    false,
  confidence:        0.0,
  _parseError:       'fallback',
};

// ---------------------------------------------------------------------------
// Core Anthropic call helper
// Sends a system prompt + messages array to the Anthropic API.
// Returns raw text content or throws on HTTP error.
// ---------------------------------------------------------------------------

async function callAnthropic(params: {
  apiKey:     string;
  model:      string;
  maxTokens:  number;
  system:     string;
  messages:   Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> {
  const { apiKey, model, maxTokens, system, messages } = params;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta':    ANTHROPIC_BETA_CACHE,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: [
        {
          type:          'text',
          text:          system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`Anthropic API error: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };

  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

// ---------------------------------------------------------------------------
// Robust JSON parser
// Three-stage: strip fences → JSON.parse → regex extract → null on total failure
// ---------------------------------------------------------------------------

function parseJSON<T>(raw: string): { parsed: T | null; error: string | null } {
  // Stage 1: strip markdown code fences and leading/trailing whitespace
  const stripped = raw
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')
    .replace(/^---.*$/gm, '')
    .trim();

  // Stage 2: direct parse
  try {
    return { parsed: JSON.parse(stripped) as T, error: null };
  } catch (_e1) {
    // Stage 3: regex extract — find first {...} object in the response
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return { parsed: JSON.parse(match[0]) as T, error: null };
      } catch (_e2) {
        return {
          parsed: null,
          error: `JSON parse failed after fence strip and regex extract. Raw[:200]: ${raw.slice(0, 200)}`,
        };
      }
    }
    return {
      parsed: null,
      error: `No JSON object found in response. Raw[:200]: ${raw.slice(0, 200)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Source quality label
// Reflects how much brain context was available for this call.
// ---------------------------------------------------------------------------

function sourceQuality(pkg: SupportContextPackage): 'brain' | 'kb_only' | 'none' {
  if (pkg.kbArticles.length > 0 && (pkg.ticketMemories.length > 0 || pkg.sopChunks.length > 0)) {
    return 'brain';
  }
  if (pkg.kbArticles.length > 0) return 'kb_only';
  return 'none';
}

// ===========================================================================
// runLegacyZeroTriage
//
// Classifies a ticket or conversation. Used at:
//   - POST /ghl/tickets/create (auto-response mode — also generates customer_response)
//   - triageConversation in legacyzero.ts (classification only)
//
// System prompt: LEGACYZERO_TRIAGE_PROMPT_V1 + context block KB section only
// Model: claude-sonnet-4-20250514 (higher reasoning for classification)
// Max tokens: 1000
//
// Input content: ticket title + description, or normalized conversation string
// Output: TriageResult (with optional customer_response for auto-response mode)
// ===========================================================================

export interface TriageInput {
  title:       string;
  description: string;
  category?:   string | null;
  subcategory?: string | null;
  imageUrls?:  string[];
  mode:        'triage_only' | 'auto_response';  // triage_only = JSON only; auto_response = JSON + customer message
}

export async function runLegacyZeroTriage(
  env: Env,
  contextPackage: SupportContextPackage,
  input: TriageInput
): Promise<TriageResult> {
  try {
    const contextBlock   = buildContextBlock(contextPackage);
    const systemPrompt   = assembleTriageSystemPrompt(contextBlock);
    const quality        = sourceQuality(contextPackage);

    // For auto_response mode: use the existing autoRespondToTicket-style prompt
    // that returns {response, resolved, resolution_note} + triage classification
    // For triage_only: pure JSON classification output
    const userContent = input.mode === 'auto_response'
      ? `Ticket: ${input.title}\nCategory: ${input.category ?? 'unknown'} — ${input.subcategory ?? ''}\nCustomer description: ${input.description}`
      : `${input.title}\n\n${input.description}`;

    console.log(`[brain:triage] mode=${input.mode} | category=${input.category ?? '?'} | quality=${quality}`);

    const raw = await callAnthropic({
      apiKey:    env.ANTHROPIC_API_KEY,
      model:     MODEL_SONNET,
      maxTokens: 1000,
      system:    systemPrompt,
      messages:  [{ role: 'user', content: userContent }],
    });

    console.log('[brain:triage] raw[:300]:', raw.slice(0, 300));

    type TriageRaw = {
      category?: string; priority?: string; problem?: string;
      suggestedAction?: string; subcategory?: string | null; confidence?: number;
      // auto_response fields
      response?: string; resolved?: boolean; resolution_note?: string | null;
    };

    const { parsed, error } = parseJSON<TriageRaw>(raw);

    if (!parsed || !parsed.category || !parsed.priority) {
      console.error('[brain:triage] parse failure:', error);
      return { ...TRIAGE_FALLBACK, source_quality: quality, _rawResponse: raw, _parseError: error ?? 'missing fields' };
    }

    return {
      category:               parsed.category,
      priority:               parsed.priority,
      problem:                parsed.problem    ?? TRIAGE_FALLBACK.problem,
      suggestedAction:        parsed.suggestedAction ?? TRIAGE_FALLBACK.suggestedAction,
      subcategory:            parsed.subcategory ?? null,
      confidence:             parsed.confidence ?? 0.5,
      // Auto-response fields
      customer_response:      parsed.response   ?? undefined,
      resolved:               parsed.resolved   ?? false,
      resolution_note:        parsed.resolution_note ?? null,
      escalation_recommended: parsed.category === 'escalated',
      source_quality:         quality,
      _rawResponse:           raw,
    };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[brain:triage] fatal error:', msg);
    return { ...TRIAGE_FALLBACK, _parseError: msg };
  }
}

// ===========================================================================
// runLegacyZeroConversation
//
// Generates a customer-facing response for an ongoing ticket conversation.
// Called by handleAIChat on every /ai/chat request.
//
// System prompt: LEGACYZERO_CONVERSATION_PROMPT_V1 + context block + labeled history
// Model: claude-haiku-4-5-20251001 (low latency for conversation turns)
// Max tokens: 1024
//
// Returns plain text response (markdown stripped by caller) + resolved flag.
// ===========================================================================

export interface ConversationInput {
  messages:        Array<{ role: string; content: string }>;
  lastClientMessage: string;
  ticketCategory?:  string;
  ticketStatus?:    string;
}

export async function runLegacyZeroConversation(
  env: Env,
  contextPackage: SupportContextPackage,
  input: ConversationInput
): Promise<ConversationResult> {
  try {
    const contextBlock = buildContextBlock(contextPackage);
    const systemPrompt = assembleConversationSystemPrompt({
      contextBlock,
      conversationHistory: input.messages,
      ticketCategory:      input.ticketCategory,
      ticketStatus:        input.ticketStatus,
    });
    const quality = sourceQuality(contextPackage);

    console.log(`[brain:conversation] ${input.messages.length} messages | quality=${quality} | category=${input.ticketCategory ?? '?'}`);

    const raw = await callAnthropic({
      apiKey:    env.ANTHROPIC_API_KEY,
      model:     MODEL_HAIKU,
      maxTokens: 1024,
      system:    systemPrompt,
      messages:  [{ role: 'user', content: input.lastClientMessage }],
    });

    console.log('[brain:conversation] raw[:200]:', raw.slice(0, 200));

    // Conversation may return plain text (from CONVERSATION_PROMPT) OR JSON.
    // Detect: if response starts with { it's JSON; otherwise treat as plain text.
    const trimmed = raw.trim();

    // Check for [RESOLVED] marker (may be in plain text or JSON)
    const RESOLVED_MARKER = '[RESOLVED]';
    const isResolved = trimmed.includes(RESOLVED_MARKER);

    // Try JSON parse first
    type ConvRaw = { response?: string; resolved?: boolean; };
    const { parsed } = parseJSON<ConvRaw>(trimmed);

    let responseText: string;
    if (parsed && parsed.response) {
      responseText = parsed.response;
    } else {
      // Plain text — strip the resolved marker
      responseText = trimmed.replace(RESOLVED_MARKER, '').trim();
    }

    // Strip markdown formatting
    const stripped = responseText
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^\s*[-•]\s/gm, '')
      .trim();

    if (!stripped) {
      console.warn('[brain:conversation] empty response after strip');
      return { ...CONVERSATION_FALLBACK, source_quality: quality, _rawResponse: raw };
    }

    return {
      customer_response: stripped,
      resolved:          isResolved || (parsed?.resolved ?? false),
      confidence:        contextPackage.contextScore > 0 ? 0.75 : 0.50,
      source_quality:    quality,
      _rawResponse:      raw,
    };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[brain:conversation] fatal error:', msg);
    return { ...CONVERSATION_FALLBACK, _parseError: msg };
  }
}

// ===========================================================================
// runLegacyZeroLearningSuggestion
//
// Evaluates a resolved ticket for KB extraction worthiness.
// Called after a resolution event is written.
//
// System prompt: LEGACYZERO_LEARNING_PROMPT_V1 + existing KB for duplicate check
// Model: claude-sonnet-4-20250514
// Max tokens: 1000
//
// Returns LearningResult if worthy, null if not worthy or if call fails.
// Never throws — failures return null (non-fatal).
// ===========================================================================

export interface LearningInput {
  ticketId:         string;
  title:            string;
  category:         string;
  subcategory?:     string | null;
  summary:          string;
  resolutionSummary: string;
  thread:           Array<{ role: string; content: string; is_internal?: boolean }>;
}

export async function runLegacyZeroLearningSuggestion(
  env: Env,
  contextPackage: SupportContextPackage,
  input: LearningInput
): Promise<LearningResult | null> {
  try {
    const contextBlock = buildContextBlock(contextPackage);
    const systemPrompt = assembleLearningSystemPrompt(contextBlock);

    // Build conversation summary for the learning prompt
    // Exclude internal notes — they are agent-only and should not inform KB
    const threadText = input.thread
      .filter(m => !m.is_internal)
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n');

    const userContent =
      `Ticket ID: ${input.ticketId}\n` +
      `Title: ${input.title}\n` +
      `Category: ${input.category}${input.subcategory ? ' / ' + input.subcategory : ''}\n` +
      `Summary: ${input.summary}\n` +
      `Resolution: ${input.resolutionSummary}\n\n` +
      `Conversation:\n${threadText}`;

    console.log(`[brain:learning] evaluating ticket: ${input.ticketId}`);

    const raw = await callAnthropic({
      apiKey:    env.ANTHROPIC_API_KEY,
      model:     MODEL_SONNET,
      maxTokens: 1000,
      system:    systemPrompt,
      messages:  [{ role: 'user', content: userContent }],
    });

    console.log('[brain:learning] raw[:300]:', raw.slice(0, 300));

    type LearningRaw = {
      worthy: boolean;
      problem?: string; solution?: string; category?: string;
      subcategory?: string | null; tags?: string[]; confidence?: number;
      source_ticket_id?: string | null; suggested_title?: string;
    };

    const { parsed, error } = parseJSON<LearningRaw>(raw);

    if (!parsed) {
      console.error('[brain:learning] parse failure:', error);
      return null;
    }

    if (!parsed.worthy) {
      console.log('[brain:learning] not worthy — skipping');
      return null;
    }

    if (!parsed.problem || !parsed.solution || !parsed.category) {
      console.error('[brain:learning] worthy=true but missing required fields');
      return null;
    }

    const result: LearningResult = {
      worthy:           true,
      problem:          parsed.problem,
      solution:         parsed.solution,
      category:         parsed.category,
      subcategory:      parsed.subcategory ?? null,
      tags:             (parsed.tags ?? []).slice(0, 5),  // max 5 tags
      confidence:       parsed.confidence ?? 0.5,
      source_ticket_id: parsed.source_ticket_id ?? input.ticketId,
      suggested_title:  parsed.suggested_title ?? input.title.slice(0, 60),
    };

    console.log(`[brain:learning] candidate: "${result.suggested_title}" | confidence=${result.confidence}`);
    return result;

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[brain:learning] fatal error (non-fatal):', msg);
    return null;  // learning failures are always non-fatal
  }
}

// ===========================================================================
// runLegacyZeroAgentSummary
//
// Generates a concise workspace briefing when an agent opens a ticket.
// Called by POST /support/tickets/:id/summary (implemented in A7).
//
// System prompt: LEGACYZERO_AGENT_SUMMARY_PROMPT_V1 + escalation rules + context
// Model: claude-haiku-4-5-20251001 (fast enough for workspace load)
// Max tokens: 512
//
// Returns AgentSummaryResult. Falls back gracefully — workspace must never block.
// ===========================================================================

export interface AgentSummaryInput {
  ticketId:    string;
  title:       string;
  category:    string;
  priority:    string;
  status:      string;
  slaDeadline: string | null;
  source:      string;
  summary:     string | null;
  thread:      Array<{ role: string; content: string; is_internal: boolean; created_at: string }>;
  contact: {
    plan:             string | null;
    past_ticket_count: number;
    member_since:     string | null;
  };
}

export async function runLegacyZeroAgentSummary(
  env: Env,
  contextPackage: SupportContextPackage,
  input: AgentSummaryInput
): Promise<AgentSummaryResult> {
  try {
    const contextBlock = buildContextBlock(contextPackage);
    const systemPrompt = assembleAgentSummarySystemPrompt(contextBlock);

    // SLA risk pre-calculation (Worker provides to prompt for context)
    let slaRiskHint = 'ok';
    if (input.slaDeadline) {
      const msLeft = new Date(input.slaDeadline).getTime() - Date.now();
      if (msLeft < 0)                  slaRiskHint = 'critical';
      else if (msLeft < 3600000)       slaRiskHint = 'critical';
      else if (msLeft < 4 * 3600000)   slaRiskHint = 'warning';
    }

    // Build thread summary for the agent summary prompt
    const threadText = input.thread.map(m => {
      const internalNote = m.is_internal ? ' [INTERNAL NOTE]' : '';
      const when = new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `[${m.role}${internalNote} @ ${when}]: ${m.content.slice(0, 300)}`;
    }).join('\n');

    // Build KB reference hint for summary
    const kbHint = contextPackage.kbArticles.length > 0
      ? `\nRelevant KB articles: ${contextPackage.kbArticles.map(a => a.title).join(', ')}`
      : '';

    const userContent =
      `Ticket: ${input.title} (${input.ticketId})\n` +
      `Category: ${input.category} | Priority: ${input.priority} | Status: ${input.status}\n` +
      `SLA Deadline: ${input.slaDeadline ?? 'not set'} (${slaRiskHint})\n` +
      `Source: ${input.source}\n` +
      `Contact: Plan=${input.contact.plan ?? 'unknown'} | Past tickets=${input.contact.past_ticket_count} | Member since=${input.contact.member_since ?? 'unknown'}\n` +
      kbHint +
      `\n\nConversation (${input.thread.length} messages):\n${threadText}`;

    console.log(`[brain:agent-summary] ticket: ${input.ticketId} | sla_risk=${slaRiskHint}`);

    if (input.thread.length < 2) {
      // Not enough conversation to summarize
      return {
        situation:         'Ticket just opened. No substantial conversation yet.',
        suggested_action:  'Review ticket details and reach out to the user.',
        sla_risk:          slaRiskHint as 'ok' | 'warning' | 'critical',
        escalation_flag:   false,
        escalation_reason: null,
        kb_reference:      contextPackage.kbArticles[0]?.title ?? null,
        resolved_by_ai:    false,
        confidence:        0.3,
      };
    }

    const raw = await callAnthropic({
      apiKey:    env.ANTHROPIC_API_KEY,
      model:     MODEL_HAIKU,
      maxTokens: 512,
      system:    systemPrompt,
      messages:  [{ role: 'user', content: userContent }],
    });

    console.log('[brain:agent-summary] raw[:300]:', raw.slice(0, 300));

    type SummaryRaw = {
      situation?: string; suggested_action?: string;
      sla_risk?: string; escalation_flag?: boolean;
      escalation_reason?: string | null; kb_reference?: string | null;
      resolved_by_ai?: boolean; confidence?: number;
    };

    const { parsed, error } = parseJSON<SummaryRaw>(raw);

    if (!parsed || !parsed.situation) {
      console.error('[brain:agent-summary] parse failure:', error);
      return {
        ...AGENT_SUMMARY_FALLBACK,
        sla_risk:     slaRiskHint as 'ok' | 'warning' | 'critical',
        kb_reference: contextPackage.kbArticles[0]?.title ?? null,
        _rawResponse: raw,
        _parseError:  error ?? 'missing situation field',
      };
    }

    // Validate sla_risk — use pre-calculated value if AI returns invalid
    const validSLARisks = new Set(['ok', 'warning', 'critical']);
    const finalSLARisk = validSLARisks.has(parsed.sla_risk ?? '')
      ? parsed.sla_risk as 'ok' | 'warning' | 'critical'
      : slaRiskHint as 'ok' | 'warning' | 'critical';

    return {
      situation:         parsed.situation,
      suggested_action:  parsed.suggested_action ?? AGENT_SUMMARY_FALLBACK.suggested_action,
      sla_risk:          finalSLARisk,
      escalation_flag:   parsed.escalation_flag ?? false,
      escalation_reason: parsed.escalation_reason ?? null,
      kb_reference:      parsed.kb_reference ?? contextPackage.kbArticles[0]?.title ?? null,
      resolved_by_ai:    parsed.resolved_by_ai ?? false,
      confidence:        parsed.confidence ?? 0.6,
      _rawResponse:      raw,
    };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[brain:agent-summary] fatal error (non-fatal):', msg);
    return { ...AGENT_SUMMARY_FALLBACK, _parseError: msg };
  }
}
