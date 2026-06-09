// support-context.ts
// LegacyZero runtime brain context assembler
// Queries Supabase brain tables and packages context for injection into AI prompts.
//
// Four assembly functions:
//   assembleTicketCreationContext  — called at POST /ghl/tickets/create (auto-response)
//   assembleConversationContext    — called at POST /ai/chat (each conversation turn)
//   assembleLearningContext        — called after resolution (learning suggestion prompt)
//   assembleAgentSummaryContext    — called at POST /support/tickets/:id/summary
//
// All functions fail gracefully — empty brain tables never crash the Worker.

import type { Env } from './support-proxy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KBArticle {
  id:           string;
  title:        string;
  problem:      string;
  solution:     string;
  category:     string;
  subcategory:  string | null;
  feature_area: string | null;
  tags:         string[];
}

export interface TicketMemory {
  topic_summary:      string;
  resolution_summary: string | null;
  category:           string;
  subcategory:        string | null;
  resolved_by:        string;
  ticket_created_at:  string;
}

export interface SOPChunk {
  sop_id:      string;
  sop_title:   string;
  chunk_title: string | null;
  chunk_index: number;
  content:     string;
  category:    string;
  audience:    string;
}

export interface GraphInsight {
  node_key:  string;
  label:     string;
  node_type: string;
  weight:    number;
}

export interface SupportContextPackage {
  // Core retrieval results
  kbArticles:    KBArticle[];
  ticketMemories: TicketMemory[];
  sopChunks:     SOPChunk[];
  graphInsights: GraphInsight[];   // empty in Phase 1

  // Metadata
  contextScore:   number;         // 0.0–1.0 confidence that this context is relevant
  contextWarnings: string[];       // non-fatal issues encountered during assembly
  assembledAt:    string;         // ISO timestamp
  phase:          number;         // 1 = brain tables only, higher = graph active
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface TicketCreationContextInput {
  locationId:  string;
  category:    string;
  subcategory?: string | null;
  userId?:     string | null;
  contactId?:  string | null;
}

export interface ConversationContextInput {
  locationId:  string;
  ticketId:    string;
  category:    string;
  subcategory?: string | null;
  contactId?:  string | null;
  turnIndex?:  number;
}

export interface LearningContextInput {
  locationId:       string;
  ticketId:         string;
  category:         string;
  subcategory?:     string | null;
  resolutionSummary: string;
  conversationSummary?: string | null;
}

export interface AgentSummaryContextInput {
  locationId:  string;
  ticketId:    string;
  category:    string;
  subcategory?: string | null;
  contactId?:  string | null;
}

// ---------------------------------------------------------------------------
// Supabase REST helpers
// ---------------------------------------------------------------------------

/** Low-level fetch against Supabase REST API with service role key. */
async function supabaseGet<T>(
  url: string,
  serviceRoleKey: string,
  query: string
): Promise<T[]> {
  const res = await fetch(`${url}/rest/v1/${query}`, {
    headers: {
      'apikey':        serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Accept':        'application/json',
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => 'unknown');
    throw new Error(`Supabase GET failed: ${res.status} ${detail.slice(0, 200)}`);
  }

  return res.json() as Promise<T[]>;
}

// ---------------------------------------------------------------------------
// Step 1 — Query support_knowledge_articles
//
// Fetches active KB articles for the given category that are either:
//   (a) global  (location_id IS NULL), or
//   (b) scoped  (location_id = locationId)
//
// Ranked: helpful_count DESC, retrieval_count DESC
// Limit 5 per call.
// ---------------------------------------------------------------------------

async function fetchKBArticles(
  env: Env,
  locationId: string,
  category: string,
  subcategory?: string | null
): Promise<KBArticle[]> {
  // Build filter — location match or global, category match, active=true
  // Use PostgREST filter syntax
  const locationFilter = `or=(location_id.eq.${encodeURIComponent(locationId)},location_id.is.null)`;
  const categoryFilter = `category=eq.${encodeURIComponent(category)}`;
  const activeFilter   = 'active=eq.true';

  // Optional subcategory narrowing — fetch by subcategory first, fall back to category-only
  const subcategoryFilter = subcategory
    ? `&subcategory=eq.${encodeURIComponent(subcategory)}`
    : '';

  const query =
    `support_knowledge_articles` +
    `?${locationFilter}&${categoryFilter}${subcategoryFilter}&${activeFilter}` +
    `&order=helpful_count.desc,retrieval_count.desc` +
    `&limit=5` +
    `&select=id,title,problem,solution,category,subcategory,feature_area,tags`;

  type Row = {
    id: string; title: string; problem: string; solution: string;
    category: string; subcategory: string | null; feature_area: string | null;
    tags: string[];
  };

  const rows = await supabaseGet<Row>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, query);

  // If subcategory narrowing returned 0 results, retry with category only
  if (subcategoryFilter && rows.length === 0) {
    const broadQuery =
      `support_knowledge_articles` +
      `?${locationFilter}&${categoryFilter}&${activeFilter}` +
      `&order=helpful_count.desc,retrieval_count.desc` +
      `&limit=5` +
      `&select=id,title,problem,solution,category,subcategory,feature_area,tags`;
    const broadRows = await supabaseGet<Row>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, broadQuery);
    return broadRows.map(r => ({
      id:          r.id,
      title:       r.title,
      problem:     r.problem,
      solution:    r.solution,
      category:    r.category,
      subcategory: r.subcategory ?? null,
      feature_area: r.feature_area ?? null,
      tags:        r.tags ?? [],
    }));
  }

  return rows.map(r => ({
    id:          r.id,
    title:       r.title,
    problem:     r.problem,
    solution:    r.solution,
    category:    r.category,
    subcategory: r.subcategory ?? null,
    feature_area: r.feature_area ?? null,
    tags:        r.tags ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Step 2 — Query support_ticket_memories
//
// Fetches memories for the contact in this location+category, most recent first.
// Limit 3 per call.
// Skips if contactId is null — no contact context to retrieve.
// ---------------------------------------------------------------------------

async function fetchTicketMemories(
  env: Env,
  locationId: string,
  category: string,
  contactId?: string | null
): Promise<TicketMemory[]> {
  if (!contactId) return [];

  const query =
    `support_ticket_memories` +
    `?location_id=eq.${encodeURIComponent(locationId)}` +
    `&contact_id=eq.${encodeURIComponent(contactId)}` +
    `&category=eq.${encodeURIComponent(category)}` +
    `&order=ticket_created_at.desc` +
    `&limit=3` +
    `&select=topic_summary,resolution_summary,category,subcategory,resolved_by,ticket_created_at`;

  type Row = {
    topic_summary: string; resolution_summary: string | null;
    category: string; subcategory: string | null;
    resolved_by: string; ticket_created_at: string;
  };

  const rows = await supabaseGet<Row>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, query);

  return rows.map(r => ({
    topic_summary:      r.topic_summary,
    resolution_summary: r.resolution_summary ?? null,
    category:           r.category,
    subcategory:        r.subcategory ?? null,
    resolved_by:        r.resolved_by,
    ticket_created_at:  r.ticket_created_at,
  }));
}

// ---------------------------------------------------------------------------
// Step 3 — Query support_sop_chunks
//
// Fetches active SOP chunks for the given category.
// Filtered by audience: 'both' or the target audience passed in.
// Ordered: sop_id ASC, chunk_index ASC (keeps related chunks together).
// Limit 3 chunks per call.
// ---------------------------------------------------------------------------

async function fetchSOPChunks(
  env: Env,
  category: string,
  audience: 'agent' | 'ai' | 'both' = 'both'
): Promise<SOPChunk[]> {
  // Audience filter: fetch chunks marked 'both' always; also fetch the target audience
  // PostgREST: audience=in.("both","ai") for ai audience target
  const audienceValues = audience === 'both'
    ? '("both")'
    : `("both","${audience}")`;

  const query =
    `support_sop_chunks` +
    `?category=eq.${encodeURIComponent(category)}` +
    `&audience=in.${audienceValues}` +
    `&active=eq.true` +
    `&order=sop_id.asc,chunk_index.asc` +
    `&limit=3` +
    `&select=sop_id,sop_title,chunk_title,chunk_index,content,category,audience`;

  type Row = {
    sop_id: string; sop_title: string; chunk_title: string | null;
    chunk_index: number; content: string; category: string; audience: string;
  };

  const rows = await supabaseGet<Row>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, query);

  return rows.map(r => ({
    sop_id:      r.sop_id,
    sop_title:   r.sop_title,
    chunk_title: r.chunk_title ?? null,
    chunk_index: r.chunk_index,
    content:     r.content,
    category:    r.category,
    audience:    r.audience,
  }));
}

// ---------------------------------------------------------------------------
// Step 4 — Graph insights (Phase 1 stub)
//
// Returns [] in Phase 1. Will be implemented in the support-graph.ts module
// once the graph is seeded with nodes and edges (Batch B14 / A7).
// ---------------------------------------------------------------------------

function fetchGraphInsights(
  _category: string,
  _subcategory?: string | null
): GraphInsight[] {
  // Phase 1: graph traversal not yet active
  return [];
}

// ---------------------------------------------------------------------------
// Context score calculation
//
// Simple heuristic: score = 1.0 if all 3 active sources returned results,
// degraded per missing source. Used by callers to decide log level.
// ---------------------------------------------------------------------------

function calculateContextScore(
  kbArticles: KBArticle[],
  ticketMemories: TicketMemory[],
  sopChunks: SOPChunk[]
): number {
  let score = 0.0;
  if (kbArticles.length > 0)    score += 0.5;   // KB is highest value
  if (sopChunks.length > 0)     score += 0.3;   // SOPs are second
  if (ticketMemories.length > 0) score += 0.2;  // Memory is helpful but optional
  return Math.round(score * 100) / 100;
}

// ---------------------------------------------------------------------------
// Core assembly helper — runs all 4 steps with individual try/catch
// ---------------------------------------------------------------------------

async function assembleCore(
  env: Env,
  locationId: string,
  category: string,
  options: {
    subcategory?:  string | null;
    contactId?:    string | null;
    sopAudience?:  'agent' | 'ai' | 'both';
    skipMemory?:   boolean;
    skipSOP?:      boolean;
  } = {}
): Promise<SupportContextPackage> {
  const warnings: string[] = [];

  const {
    subcategory  = null,
    contactId    = null,
    sopAudience  = 'both',
    skipMemory   = false,
    skipSOP      = false,
  } = options;

  // Step 1 — KB articles
  let kbArticles: KBArticle[] = [];
  try {
    kbArticles = await fetchKBArticles(env, locationId, category, subcategory);
    console.log(`[context] KB articles fetched: ${kbArticles.length} (${category}/${subcategory ?? 'any'})`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`KB retrieval failed (non-fatal): ${msg.slice(0, 120)}`);
    console.warn('[context] KB fetch failed:', msg);
  }

  // Step 2 — Ticket memories
  let ticketMemories: TicketMemory[] = [];
  if (!skipMemory && contactId) {
    try {
      ticketMemories = await fetchTicketMemories(env, locationId, category, contactId);
      console.log(`[context] Ticket memories fetched: ${ticketMemories.length}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Memory retrieval failed (non-fatal): ${msg.slice(0, 120)}`);
      console.warn('[context] Memory fetch failed:', msg);
    }
  }

  // Step 3 — SOP chunks
  let sopChunks: SOPChunk[] = [];
  if (!skipSOP) {
    try {
      sopChunks = await fetchSOPChunks(env, category, sopAudience);
      console.log(`[context] SOP chunks fetched: ${sopChunks.length}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`SOP retrieval failed (non-fatal): ${msg.slice(0, 120)}`);
      console.warn('[context] SOP fetch failed:', msg);
    }
  }

  // Step 4 — Graph insights (Phase 1: always [])
  const graphInsights = fetchGraphInsights(category, subcategory);

  const contextScore = calculateContextScore(kbArticles, ticketMemories, sopChunks);

  if (contextScore === 0) {
    warnings.push('All brain sources returned empty — LegacyZero will use base identity only');
    console.warn('[context] Empty brain — category:', category, '| location:', locationId);
  }

  return {
    kbArticles,
    ticketMemories,
    sopChunks,
    graphInsights,
    contextScore,
    contextWarnings: warnings,
    assembledAt: new Date().toISOString(),
    phase: 1,
  };
}

// ---------------------------------------------------------------------------
// Public assembly functions
// ---------------------------------------------------------------------------

/**
 * assembleTicketCreationContext
 *
 * Called at POST /ghl/tickets/create before autoRespondToTicket().
 * Retrieves KB articles and SOP chunks (AI audience) for the ticket's category.
 * Memory skipped — contact may not have prior tickets.
 * SOPs filtered to audience='ai' since this context is injected into LegacyZero.
 */
export async function assembleTicketCreationContext(
  env: Env,
  input: TicketCreationContextInput
): Promise<SupportContextPackage> {
  console.log('[context:ticket-creation] assembling for:', input.category, input.subcategory ?? '');
  return assembleCore(env, input.locationId, input.category, {
    subcategory:  input.subcategory,
    contactId:    input.contactId,
    sopAudience:  'ai',
    skipMemory:   false,
  });
}

/**
 * assembleConversationContext
 *
 * Called at POST /ai/chat before building the handleAIChat system prompt.
 * Retrieves KB articles (limit 3, narrowed to subcategory), ticket memories
 * for context-aware responses, and AI-audience SOP chunks.
 * This is the hot path — must be fast. All failures are non-fatal.
 */
export async function assembleConversationContext(
  env: Env,
  input: ConversationContextInput
): Promise<SupportContextPackage> {
  console.log(`[context:conversation] turn ${input.turnIndex ?? 0} | ${input.category}/${input.subcategory ?? ''}`);
  return assembleCore(env, input.locationId, input.category, {
    subcategory:  input.subcategory,
    contactId:    input.contactId,
    sopAudience:  'ai',
    skipMemory:   false,
  });
}

/**
 * assembleLearningContext
 *
 * Called after a ticket is resolved to evaluate whether it's worth capturing
 * as a KB candidate. Retrieves KB articles (to check for duplicates), existing
 * memories (for pattern matching), and agent-audience SOP chunks.
 * Memory skip: false — want full contact history for duplicate detection.
 */
export async function assembleLearningContext(
  env: Env,
  input: LearningContextInput
): Promise<SupportContextPackage> {
  console.log('[context:learning] assembling for ticket:', input.ticketId);
  return assembleCore(env, input.locationId, input.category, {
    subcategory:  input.subcategory,
    contactId:    null,           // no contact-specific context needed for learning
    sopAudience:  'both',
    skipMemory:   true,           // memories not relevant for KB duplicate detection
  });
}

/**
 * assembleAgentSummaryContext
 *
 * Called at POST /support/tickets/:id/summary when an agent opens the workspace.
 * Retrieves KB articles (for kb_reference field), agent-audience SOP chunks
 * (for suggested_action), and ticket memories (for contact history context).
 * Uses 'agent' audience for SOPs — agent sees the full SOP, not just AI-facing content.
 */
export async function assembleAgentSummaryContext(
  env: Env,
  input: AgentSummaryContextInput
): Promise<SupportContextPackage> {
  console.log('[context:agent-summary] assembling for ticket:', input.ticketId);
  return assembleCore(env, input.locationId, input.category, {
    subcategory:  input.subcategory,
    contactId:    input.contactId,
    sopAudience:  'agent',
    skipMemory:   false,
  });
}

// ---------------------------------------------------------------------------
// Context serializers
// Used by legacyzero-prompts.ts to format context into prompt-injectable text.
// ---------------------------------------------------------------------------

/**
 * formatKBContextBlock
 * Formats KB articles into a plain-text block for injection into AI system prompts.
 * Keeps it tight — LegacyZero should use the information, not quote it verbatim.
 */
export function formatKBContextBlock(articles: KBArticle[]): string {
  if (articles.length === 0) return '';

  const lines = articles.map((a, i) =>
    `[${i + 1}] ${a.title}\n` +
    `    Problem: ${a.problem}\n` +
    `    Solution: ${a.solution}`
  );

  return (
    'KNOWLEDGE BASE (use to resolve if relevant — do not quote verbatim):\n' +
    lines.join('\n\n')
  );
}

/**
 * formatMemoryContextBlock
 * Formats ticket memories into a concise contact history block.
 * No PII — summaries only.
 */
export function formatMemoryContextBlock(memories: TicketMemory[]): string {
  if (memories.length === 0) return '';

  const lines = memories.map((m, i) => {
    const when = new Date(m.ticket_created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    const resolution = m.resolution_summary
      ? ` → resolved by ${m.resolved_by}: ${m.resolution_summary}`
      : ` → ${m.resolved_by === 'unresolved' ? 'unresolved' : 'resolved'}`;
    return `[${i + 1}] ${when}: ${m.topic_summary}${resolution}`;
  });

  return 'CONTACT HISTORY (prior tickets from this customer):\n' + lines.join('\n');
}

/**
 * formatSOPContextBlock
 * Formats SOP chunks into a procedure reference block.
 * Intended for agent summary — not injected into customer-facing prompts.
 */
export function formatSOPContextBlock(chunks: SOPChunk[]): string {
  if (chunks.length === 0) return '';

  const lines = chunks.map((c) => {
    const heading = c.chunk_title ? `${c.sop_title} — ${c.chunk_title}` : c.sop_title;
    return `[SOP: ${heading}]\n${c.content}`;
  });

  return 'RELEVANT SOPs:\n' + lines.join('\n\n');
}
