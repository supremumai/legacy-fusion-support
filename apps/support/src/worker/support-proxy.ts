import type { Ticket, Contact, TicketStatus, TicketCategory, TicketPriority } from '../types/ticket';
import { LEGACY_FUSION_KB } from '../knowledge/legacy_fusion_kb';
import {
  assembleTicketCreationContext,
  assembleConversationContext,
  assembleLearningContext,
} from './support-context';
import type {
  TicketCreationContextInput,
  ConversationContextInput,
  LearningContextInput,
} from './support-context';
import {
  buildContextBlock,
  assembleAutoResponseSystemPrompt,
  LEGACYZERO_TRIAGE_PROMPT_V1,
} from './legacyzero-prompts';
import {
  runLegacyZeroTriage,
  runLegacyZeroConversation,
  runLegacyZeroLearningSuggestion,
} from './legacyzero-brain';
import type { TriageInput, ConversationInput, LearningInput } from './legacyzero-brain';
import { updateGraphForResolvedTicket, updateGraphForApprovedKnowledge } from './support-graph';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
export interface Env {
  GHL_AGENCY_TOKEN:          string;
  GHL_LOCATION_TOKEN:        string;
  GHL_LOCATION_ID:           string;
  GHL_PIPELINE_ID:           string;
  GHL_AGENT_CONTACT_ID:      string;
  SUPPORT_CORS_ORIGIN:       string;
  GHL_WEBHOOK_SECRET:        string;
  SUPABASE_URL:              string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY:         string;
}

// ---------------------------------------------------------------------------
// Pipeline stage mapping (TicketStatus → GHL stage name)
// ---------------------------------------------------------------------------
const STAGE_MAP: Record<TicketStatus, string> = {
  new:              'New Ticket',
  triaged:          'Triage',
  in_progress:      'In Progress',
  waiting_client:   'Waiting on Client',
  waiting_internal: 'Waiting on Internal',
  resolved:         'Resolved',
  closed:           'Closed',
  escalated:        'Escalated',
};

// Reverse map: exact GHL stage name → TicketStatus
// Keys are lowercase for case-insensitive lookup.
const REVERSE_STAGE_MAP: Record<string, TicketStatus> = {
  'new ticket':           'new',
  'triage':               'triaged',
  'in progress':          'in_progress',
  'waiting on client':    'waiting_client',
  'waiting on internal':  'waiting_internal',
  'resolved':             'resolved',
  'closed':               'closed',
  'escalated':            'escalated',
};

function stageNameToStatus(name: string): TicketStatus | null {
  return REVERSE_STAGE_MAP[name.trim().toLowerCase()] ?? null;
}

// ---------------------------------------------------------------------------
// GHL custom field keys (Opportunity-level)
// ---------------------------------------------------------------------------
const CF = {
  category:    'lf_ticket_category',
  priority:    'lf_ticket_priority',
  aiSummary:   'lf_ai_summary',
  slaDeadline: 'lf_sla_deadline',
  internalId:  'lf_internal_id',
} as const;

// ---------------------------------------------------------------------------
// GHL API — v2 base (location-token auth + Version header)
// ---------------------------------------------------------------------------
const GHL_V2_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders(token: string): HeadersInit {
  return {
    Authorization:  `Bearer ${token}`,
    'Content-Type': 'application/json',
    Version:        '2021-07-28',
  };
}

// ---------------------------------------------------------------------------
// Pipeline stage cache (Worker lifetime — no cold-start penalty on repeat reqs)
// stageName (lowercase) → stageId
// ---------------------------------------------------------------------------
let stageIdCache: Map<string, string> | null = null;

async function getPipelineStageMap(env: Env): Promise<Map<string, string>> {
  if (stageIdCache) return stageIdCache;

  const res = await fetch(`${GHL_V2_BASE}/opportunities/pipelines/${env.GHL_PIPELINE_ID}`, {
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch pipeline stages: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    pipeline?: { stages?: Array<{ id: string; name: string }> };
    stages?:   Array<{ id: string; name: string }>;
  };

  const stages = data.pipeline?.stages ?? data.stages ?? [];
  const map = new Map<string, string>();
  for (const s of stages) {
    map.set(s.name.trim().toLowerCase(), s.id);
  }

  console.log('[getPipelineStageMap] loaded stages:', [...map.entries()]);
  stageIdCache = map;
  return map;
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------
function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Max-Age':       '86400',
  };
}

// ---------------------------------------------------------------------------
// iframe-friendly security headers
// Allows GHL to embed the support pages.
// X-Frame-Options is intentionally omitted — it would block iframe embedding.
// ---------------------------------------------------------------------------
const IFRAME_HEADERS: HeadersInit = {
  'Content-Security-Policy': "frame-ancestors https://app.gohighlevel.com",
};

function handlePreflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders(origin), ...IFRAME_HEADERS },
  });
}

function json(data: unknown, status = 200, origin = '*'): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...IFRAME_HEADERS,
    },
  });
}

// ---------------------------------------------------------------------------
// GHL response → domain types
// ---------------------------------------------------------------------------
function mapOpportunityToTicket(opp: Record<string, unknown>): Ticket {
  const cf = (opp.customFields as Record<string, unknown>) ?? {};
  return {
    id:               (cf[CF.internalId] as string) ?? (opp.id as string),
    ghlOpportunityId: opp.id as string,
    ghlContactId:     opp.contactId as string,
    title:            opp.name as string,
    category:         (cf[CF.category] as TicketCategory) ?? 'general',
    priority:         (cf[CF.priority] as TicketPriority) ?? 'medium',
    status:           mapStageToStatus(opp.pipelineStageName as string),
    assignedTo:       (opp.assignedTo as string) ?? undefined,
    slaDeadline:      new Date((cf[CF.slaDeadline] as string) ?? Date.now()),
    createdAt:        new Date(opp.createdAt as string),
    updatedAt:        new Date(opp.updatedAt as string),
  };
}

function mapStageToStatus(stageName: string): TicketStatus {
  return stageNameToStatus(stageName) ?? 'new';
}

function mapContactToContact(c: Record<string, unknown>): Contact {
  return {
    id:              c.id as string,
    ghlContactId:    c.id as string,
    name:            ((c.firstName as string) + ' ' + (c.lastName as string)).trim(),
    email:           c.email as string,
    plan:            (c.customFields as Record<string, string>)?.plan ?? undefined,
    mrr:             undefined,
    memberSince:     c.dateAdded ? new Date(c.dateAdded as string) : undefined,
    pastTicketCount: 0,
  };
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Endpoint handlers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// LegacyZero auto-response — called server-side immediately after ticket insert
// ---------------------------------------------------------------------------
async function autoRespondToTicket(params: {
  ticketId:    string;
  title:       string;
  category:    string;
  subcategory: string;
  description: string;
  locationId:  string;
  imageUrls:   string[];
  kbEntries:   Array<{ problem: string; solution: string; category: string; tags: string[] }>;
  env:         Env;
}): Promise<{ response: string; resolved: boolean; resolution_note: string | null }> {
  const { title, category, subcategory, description, imageUrls, kbEntries, env } = params;

  const kbContext = kbEntries.length > 0
    ? '\n\nKNOWLEDGE BASE (use to resolve if relevant):\n' +
      kbEntries.map((e, i) =>
        `[${i + 1}] Problem: ${e.problem}\n` +
        `     Solution: ${e.solution}\n` +
        `     Tags: ${(e.tags ?? []).join(', ')}`
      ).join('\n\n')
    : '\n\nKNOWLEDGE BASE: No relevant entries found.';

  const systemPrompt =
    `You are LegacyZero, an AI support assistant for ` +
    `Legacy Fusion, a GoHighLevel-based CRM platform.\n\n` +
    `A customer just submitted a support ticket. Your job:\n` +
    `1. Analyze the issue carefully\n` +
    `2. Check the knowledge base for relevant solutions\n` +
    `3. If you can fully resolve it, provide a clear solution\n` +
    `4. If not, acknowledge and say an agent will help\n\n` +
    `RULES:\n` +
    `- Plain text only — no markdown, no bullets, no asterisks\n` +
    `- Be concise, warm, and professional\n` +
    `- Only mark resolved if you have a confident complete solution\n` +
    `- Respond in the same language the customer used\n\n` +
    `Respond with valid JSON only — no other text:\n` +
    `{"response":"your message","resolved":true or false,` +
    `"resolution_note":"brief summary or null"}` +
    kbContext;

  const userMessage =
    `Ticket: ${title}\n` +
    `Category: ${category} — ${subcategory}\n` +
    `Customer description: ${description}`;

  // Build content array with optional image blocks
  const contentBlocks: any[] = [
    { type: 'text', text: userMessage }
  ];

  for (const url of (imageUrls ?? []).slice(0, 3)) {
    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) continue;
      const buffer = await imgRes.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      contentBlocks.push({
        type: 'image',
        source: {
          type:       'base64',
          media_type: contentType,
          data:       base64,
        },
      });
      console.log('[autoRespond] image attached:', url.slice(-40));
    } catch (e) {
      console.warn('[autoRespond] image fetch failed:', url, e);
    }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':    'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: [
        {
          type:          'text',
          text:          LEGACY_FUSION_KB,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: systemPrompt,
        },
      ],
      messages: [{ role: 'user', content: contentBlocks }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const raw = data.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim();

  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as {
      response:        string;
      resolved:        boolean;
      resolution_note: string | null;
    };
    return parsed;
  } catch {
    console.error('[autoRespond] JSON parse failed:', raw.slice(0, 300));
    return {
      response:        raw || 'Thank you for contacting support. An agent will review your case shortly.',
      resolved:        false,
      resolution_note: null,
    };
  }
}

// POST /ghl/tickets/create
async function createTicket(req: Request, env: Env, origin: string): Promise<Response> {
  const body = await req.json<{
    userId:      string;
    locationId:  string;
    userName:    string;
    userEmail:   string;
    title:       string;
    category:    TicketCategory;
    priority:    TicketPriority;
    summary?:    string;
    source?:     string;
    subcategory?: string;
    imageUrls?:  string[];
  }>();

  console.log('[createTicket] params:', {
    userId:     body.userId,
    locationId: body.locationId,
    userName:   body.userName,
    title:      body.title,
  });

  // Step 1 — GHL contact search (non-fatal, for ghl_contact_id only)
  let ghlContactId: string | null = null;
  try {
    const searchParams = new URLSearchParams({
      locationId: body.locationId,
      query:      body.userEmail,
    });
    const searchRes = await fetch(
      `${GHL_V2_BASE}/contacts/?${searchParams}`,
      { headers: ghlHeaders(env.GHL_LOCATION_TOKEN) }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json() as { contacts?: Array<{ id: string }> };
      if (searchData.contacts?.length) {
        ghlContactId = searchData.contacts[0].id;
        console.log('[createTicket] GHL contact found:', ghlContactId);
      }
    } else {
      console.warn('[createTicket] GHL contact search failed:', searchRes.status, '— non-fatal');
    }
  } catch (e) {
    console.warn('[createTicket] GHL contact search error:', e, '— non-fatal');
  }

  // Step 2 — Calculate SLA deadline
  const SLA_HOURS: Record<string, number> = { urgent: 2, high: 4, medium: 24, low: 72 };
  const slaDeadline = new Date(
    Date.now() + (SLA_HOURS[body.priority ?? 'medium'] ?? 24) * 3600000
  ).toISOString();

  // Step 3 — Insert to Supabase
  const internalId = `T-${Date.now().toString(36).toUpperCase()}`;

  const ticketRow = {
    id:             internalId,
    user_id:        body.userId ?? null,
    location_id:    body.locationId,
    status:         'new',
    title:          body.title ?? null,
    contact_name:   body.userName ?? null,
    contact_email:  body.userEmail ?? null,
    priority:       body.priority ?? 'medium',
    category:       body.category ?? 'general',
    subcategory:    body.subcategory ?? null,
    summary:        body.summary ?? null,
    source:         (body.source ?? 'chat').toLowerCase(),
    sla_deadline:   slaDeadline,
    ghl_contact_id: ghlContactId,
    image_urls:     body.imageUrls ?? [],
    updated_at:     new Date().toISOString(),
  };

  const insertRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/support_tickets`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(ticketRow),
    }
  );

  if (!insertRes.ok) {
    const detail = await insertRes.text();
    console.error('[createTicket] Supabase insert failed:', insertRes.status, detail);
    return json({ error: 'ticket creation failed', detail }, 502, origin);
  }

  console.log('[createTicket] created in Supabase:', internalId);

  // Step 4 — Brain-powered auto-response (non-fatal)
  try {
    // Assemble context from brain tables
    const contextInput: TicketCreationContextInput = {
      locationId:  body.locationId,
      category:    body.category ?? 'general',
      subcategory: body.subcategory ?? null,
      contactId:   ghlContactId,
    };
    const contextPkg = await assembleTicketCreationContext(env, contextInput).catch(e => {
      console.warn('[createTicket] context assembly failed (non-fatal):', e);
      return {
        kbArticles: [], ticketMemories: [], sopChunks: [], graphInsights: [],
        contextScore: 0, contextWarnings: ['context assembly failed'], assembledAt: new Date().toISOString(), phase: 1,
      };
    });

    console.log(`[createTicket] context: kb=${contextPkg.kbArticles.length} mem=${contextPkg.ticketMemories.length} sop=${contextPkg.sopChunks.length} score=${contextPkg.contextScore}`);

    // Build triage input — auto_response mode returns customer_response + triage classification
    const triageInput: TriageInput = {
      title:       body.title ?? '',
      description: body.summary ?? '',
      category:    body.category ?? 'general',
      subcategory: body.subcategory ?? null,
      imageUrls:   body.imageUrls ?? [],
      mode:        'auto_response',
    };

    // Handle images for auto-response: fetch and attach as base64 blocks
    // (runLegacyZeroTriage accepts plain text; image attachment handled by callAnthropic)
    // For image-bearing tickets, append image context note to description
    const imageNote = (body.imageUrls ?? []).length > 0
      ? `\n\n[${(body.imageUrls ?? []).length} image(s) attached by customer]`
      : '';
    triageInput.description = (body.summary ?? '') + imageNote;

    const aiResult = await runLegacyZeroTriage(env, contextPkg, triageInput);

    console.log(`[createTicket] triage: resolved=${aiResult.resolved} escalated=${aiResult.escalation_recommended} confidence=${aiResult.confidence} quality=${aiResult.source_quality}`);

    const customerResponse  = aiResult.customer_response ?? 'Thank you for contacting support. An agent will review your case shortly.';
    const aiResolved        = aiResult.resolved ?? false;
    const escalationRec     = aiResult.escalation_recommended ?? false;
    const resolutionNote     = aiResult.resolution_note ?? null;

    // Persist AI message to support_messages
    await fetch(`${env.SUPABASE_URL}/rest/v1/support_messages`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        ticket_id:   internalId,
        role:        'ai',
        content:     customerResponse,
        is_internal: false,
        location_id: body.locationId,
      }),
    });

    // Determine new status: escalated > resolved > triaged
    const newStatus: string = escalationRec ? 'escalated'
                            : aiResolved    ? 'resolved'
                            : 'triaged';

    await fetch(
      `${env.SUPABASE_URL}/rest/v1/support_tickets?id=eq.${internalId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          status:         newStatus,
          resolved_by_ai: aiResolved,
          updated_at:     new Date().toISOString(),
        }),
      }
    );

    // Fire-and-forget: insert support_ai_evaluations row
    fetch(`${env.SUPABASE_URL}/rest/v1/support_ai_evaluations`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        location_id:       body.locationId,
        ticket_id:         internalId,
        turn_index:        0,
        model:             'claude-sonnet-4-20250514',
        response_text:     customerResponse.slice(0, 1000),
        accuracy_score:    aiResult.confidence,
        completeness_score: aiResult.confidence,
        tone_score:        null,
        escalation_correct: escalationRec === (aiResult.category === 'escalated'),
        overall_score:     aiResult.confidence,
        kb_articles_used:  contextPkg.kbArticles.map(a => a.id),
        flagged_for_review: aiResult.confidence < 0.6,
        review_reason:     aiResult.confidence < 0.6 ? 'low confidence on first response' : null,
        created_at:        new Date().toISOString(),
      }),
    }).catch(e => console.warn('[createTicket] ai_evaluations insert failed (non-fatal):', e));

    // Fire-and-forget: insert support_resolution_events row (ai_first_response event)
    fetch(`${env.SUPABASE_URL}/rest/v1/support_resolution_events`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        location_id:           body.locationId,
        ticket_id:             internalId,
        contact_id:            ghlContactId,
        resolution_type:       'ai_first_response',
        category:              body.category ?? 'general',
        subcategory:           body.subcategory ?? null,
        resolution_summary:    resolutionNote ?? `AI responded with ${aiResolved ? 'resolution' : 'acknowledgement'}`,
        kb_article_ids_used:   contextPkg.kbArticles.map(a => a.id),
        sop_ids_used:          contextPkg.sopChunks.map(c => c.sop_id),
        ai_response_count:     1,
        agent_intervened:      false,
        resolution_time_minutes: 0,
        resolved_at:           new Date().toISOString(),
        created_at:            new Date().toISOString(),
      }),
    }).catch(e => console.warn('[createTicket] resolution_events insert failed (non-fatal):', e));

    // Notify agent via GHL SMS if escalated or new ticket (fire-and-forget)
    const agentContactId = env.GHL_AGENT_CONTACT_ID ?? '';
    if (agentContactId) {
      const escalationFlag = escalationRec ? '🚨 ESCALATED — ' : '';
      fetch(`${GHL_V2_BASE}/conversations/messages`, {
        method:  'POST',
        headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
        body:    JSON.stringify({
          type:      'SMS',
          contactId: agentContactId,
          message:   `${escalationFlag}New support ticket: ${body.title}\n` +
                     `Category: ${body.category ?? 'general'}\n` +
                     `Priority: ${body.priority ?? 'medium'}\n` +
                     `Status: ${newStatus}\n` +
                     `Summary: ${body.summary ?? ''}`,
        }),
      })
        .then(r => console.log('[notify] agent SMS sent:', r.status))
        .catch(e => console.warn('[notify] agent SMS failed:', e));
    }

    return json({
      ticketId:              internalId,
      ghlContactId,
      aiResponse:            customerResponse,
      aiResolved,
      resolutionNote,
      // Extended fields (optional, backward compatible)
      aiConfidence:          aiResult.confidence,
      sourceQuality:         aiResult.source_quality,
      escalationRecommended: escalationRec,
    }, 201, origin);

  } catch (aiErr) {
    console.error('[createTicket] brain auto-response failed (non-fatal):', aiErr);

    // Fallback: set triaged
    fetch(
      `${env.SUPABASE_URL}/rest/v1/support_tickets?id=eq.${internalId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({ status: 'triaged', updated_at: new Date().toISOString() }),
      }
    ).catch(() => {});

    const agentContactIdFallback = env.GHL_AGENT_CONTACT_ID ?? '';
    if (agentContactIdFallback) {
      fetch(`${GHL_V2_BASE}/conversations/messages`, {
        method:  'POST',
        headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
        body:    JSON.stringify({
          type:      'SMS',
          contactId: agentContactIdFallback,
          message:   `New support ticket: ${body.title}\n` +
                     `Category: ${body.category ?? 'general'}\n` +
                     `Priority: ${body.priority ?? 'medium'}\n` +
                     `Summary: ${body.summary ?? ''}`,
        }),
      })
        .then(r => console.log('[notify] agent SMS sent (fallback):', r.status))
        .catch(e => console.warn('[notify] agent SMS failed (fallback):', e));
    }

    return json({
      ticketId:              internalId,
      ghlContactId,
      aiResponse:            null,
      aiResolved:            false,
      resolutionNote:        null,
      aiConfidence:          null,
      sourceQuality:         'none',
      escalationRecommended: false,
    }, 201, origin);
  }

}

// PATCH /ghl/tickets/:id/status
async function updateTicketStatus(
  ghlOpportunityId: string,
  req: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const body = await req.json<{ status: TicketStatus }>();
  const stageName = STAGE_MAP[body.status];

  if (!stageName) {
    return json({ error: `Unknown status: ${body.status}` }, 400, origin);
  }

  // Resolve stage name → stage ID via cached pipeline fetch
  let stageId: string | undefined;
  try {
    const stageMap = await getPipelineStageMap(env);
    stageId = stageMap.get(stageName.toLowerCase());
    if (!stageId) {
      console.warn(`[updateTicketStatus] Stage not found in pipeline map: "${stageName}"`);
      return json({ error: `Stage not found in pipeline: ${stageName}` }, 400, origin);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: 'Failed to resolve pipeline stage', detail: msg }, 502, origin);
  }

  // Map ticket status to GHL opportunity status
  const ghlStatus = body.status === 'resolved' ? 'won'
                  : body.status === 'closed'   ? 'lost'
                  : 'open';

  // GHL v2: PUT /opportunities/:id
  const updatePayload = { pipelineStageId: stageId, status: ghlStatus };
  console.log('[updateTicketStatus] GHL v2 request body:', JSON.stringify(updatePayload));

  const res = await fetch(`${GHL_V2_BASE}/opportunities/${ghlOpportunityId}`, {
    method:  'PUT',
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
    body:    JSON.stringify(updatePayload),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'GHL update failed', detail: err }, 502, origin);
  }

  return json({ success: true }, 200, origin);
}

// GET /ghl/users
async function getUsers(env: Env, origin: string): Promise<Response> {
  const res = await fetch(`${GHL_V2_BASE}/users/?locationId=${env.GHL_LOCATION_ID}`, {
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[getUsers] GHL failed:', res.status, err.slice(0, 300));
    return json({ error: 'Failed to fetch users', status: res.status, detail: err }, 502, origin);
  }
  const data = (await res.json()) as { users?: Record<string, unknown>[] };
  const users = (data.users ?? []).map((u) => ({
    id:    u.id    as string,
    name:  u.name  as string,
    email: u.email as string,
  }));
  return json({ users }, 200, origin);
}

// PATCH /ghl/tickets/:id/assign
async function assignTicket(
  ghlOpportunityId: string,
  req: Request,
  env: Env,
  origin: string
): Promise<Response> {
  let body: { assignedTo: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400, origin); }
  if (!body.assignedTo) return json({ error: 'assignedTo is required' }, 400, origin);

  const res = await fetch(`${GHL_V2_BASE}/opportunities/${ghlOpportunityId}`, {
    method:  'PUT',
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
    body:    JSON.stringify({ assignedTo: body.assignedTo }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[assignTicket] GHL failed:', res.status, err.slice(0, 300));
    return json({ error: 'GHL assign failed', status: res.status, detail: err }, 502, origin);
  }
  console.log('[assignTicket] assigned', ghlOpportunityId, '→', body.assignedTo);
  return json({ success: true }, 200, origin);
}

// POST /kb/save
async function saveKnowledgeBase(req: Request, env: Env, origin: string): Promise<Response> {
  let body: {
    ticketId:   string;
    locationId: string;
    problem:    string;
    solution:   string;
    category:   string;
    tags?:      string[];
    createdBy?: string;
  };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400, origin); }

  const { ticketId, locationId, problem, solution, category, tags = [], createdBy = '' } = body;
  if (!ticketId || !locationId || !problem || !solution || !category) {
    return json({ error: 'ticketId, locationId, problem, solution, category are required' }, 400, origin);
  }

  const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/knowledge_base`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({ ticket_id: ticketId, location_id: locationId, problem, solution, category, tags, created_by: createdBy }),
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error('[kb/save] Supabase insert failed:', insertRes.status, err.slice(0, 300));
    return json({ error: 'KB insert failed', status: insertRes.status, detail: err }, 502, origin);
  }

  console.log('[kb/save] saved KB entry for ticket:', ticketId);
  return json({ success: true }, 201, origin);
}

// GET /support/tickets — fetch ALL tickets across all locations from Supabase
async function handleGetTickets(
  request: Request, env: Env, origin: string
): Promise<Response> {
  const url = new URL(request.url)
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
    100
  )

  // Fetch ALL tickets across all locations — no location filter
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/support_tickets?order=updated_at.desc&limit=${limit}&select=*`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Accept': 'application/json'
      }
    }
  )

  if (!res.ok) {
    const detail = await res.text()
    return json({ error: 'failed to fetch tickets', detail }, 502, origin)
  }

  const rows = await res.json() as any[]

  // Get unique location_ids from the result
  const locationIds = [...new Set(
    rows.map((r: any) => r.location_id).filter(Boolean)
  )] as string[]

  // Fetch location names from GHL in parallel (non-fatal per location)
  const locationNames: Record<string, string> = {}
  await Promise.all(
    locationIds.map(async (locId) => {
      try {
        const locRes = await fetch(
          `${GHL_V2_BASE}/locations/${locId}`,
          { headers: ghlHeaders(env.GHL_AGENCY_TOKEN) }
        )
        if (locRes.ok) {
          const locData = await locRes.json() as any
          const name = locData.location?.name ?? locData.name ?? null
          if (name) locationNames[locId] = name
          console.log('[getTickets] location:', locId, '→', name)
        } else {
          console.warn('[getTickets] location fetch failed:', locId, locRes.status)
        }
      } catch (e) {
        console.warn('[getTickets] location fetch error:', locId, e)
      }
    })
  )

  // Map rows to Ticket shape with accountName
  const tickets = rows.map((row: any) => ({
    id: row.id,
    ghlOpportunityId: row.ghl_opportunity_id ?? row.id,
    ghlContactId: row.ghl_contact_id ?? null,
    title: row.title ?? 'Untitled',
    status: row.status ?? 'new',
    priority: row.priority ?? 'medium',
    category: row.category ?? 'general',
    contactName: row.contact_name ?? 'Unknown',
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    businessName: row.business_name ?? null,
    source: row.source ?? 'chat',
    assignedTo: row.assigned_to ?? null,
    plan: row.plan ?? null,
    summary: row.summary ?? null,
    slaDeadline: row.sla_deadline ?? null,
    locationId: row.location_id ?? null,
    accountName: locationNames[row.location_id] ?? row.location_id ?? '—',
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
    aiSummary: {
      problem: row.summary ?? '',
      category: row.category ?? 'general',
      priority: row.priority ?? 'medium',
      suggestedAction: '',
      generatedAt: new Date(row.updated_at)
    }
  }))

  console.log('[getTickets] returning', tickets.length, 'tickets from', locationIds.length, 'locations')
  return json(tickets, 200, origin)
}

// GET /ghl/tickets/:id
async function getTicket(
  ghlOpportunityId: string,
  env: Env,
  origin: string
): Promise<Response> {
  const oppRes = await fetch(`${GHL_V2_BASE}/opportunities/${ghlOpportunityId}`, {
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
  });

  if (!oppRes.ok) {
    return json({ error: 'Opportunity not found' }, 404, origin);
  }

  const opp = (await oppRes.json()) as Record<string, unknown>;
  const ticket = mapOpportunityToTicket(opp);

  const contactRes = await fetch(`${GHL_V2_BASE}/contacts/${opp.contactId}`, {
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
  });
  const contact = contactRes.ok
    ? mapContactToContact((await contactRes.json()) as Record<string, unknown>)
    : null;

  return json({ ticket, contact }, 200, origin);
}

// GET /ghl/tickets?status=new&limit=50
async function listTickets(url: URL, env: Env, origin: string): Promise<Response> {
  const statusParam    = url.searchParams.get('status') as TicketStatus | null;
  const contactIdParam = url.searchParams.get('contactId');
  const limit          = parseInt(url.searchParams.get('limit') ?? '50', 10);

  const params = new URLSearchParams({
    location_id:  env.GHL_LOCATION_ID,
    pipeline_id:  env.GHL_PIPELINE_ID,
    limit:        String(Math.min(limit, 100)),
  });

  if (statusParam && STAGE_MAP[statusParam]) {
    params.set('pipeline_stage_id', STAGE_MAP[statusParam]);
  }
  if (contactIdParam) {
    params.set('contact_id', contactIdParam);
  }

  const res = await fetch(`${GHL_V2_BASE}/opportunities/search?${params}`, {
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[listTickets] GHL search failed:', res.status, err.slice(0, 300));
    return json({ error: 'GHL list failed', status: res.status, detail: err }, 502, origin);
  }

  const data = (await res.json()) as {
    opportunities?: Record<string, unknown>[];
    data?:          { opportunities?: Record<string, unknown>[] };
  };

  // GHL v2 /opportunities/search returns { opportunities: [...] } or nested { data: { opportunities: [...] } }
  const opps: Record<string, unknown>[] =
    data.opportunities ?? data.data?.opportunities ?? [];

  console.log('[listTickets] GHL returned', opps.length, 'opportunities');

  const tickets: Ticket[] = opps.map((opp) => {
    const stage     = (opp.pipelineStage as Record<string, unknown> | undefined);
    const stageName = (stage?.name as string) ?? '';
    const contact   = opp.contact as Record<string, unknown> | undefined;

    // Custom field lookup — GHL returns different shapes depending on field type:
    // { id, fieldValue } or { key, fieldValue } or { fieldKey, value }
    type CfEntry = { id?: string; key?: string; fieldKey?: string; fieldValue?: unknown; value?: unknown };
    const cfs = (opp.customFields as CfEntry[] | undefined) ?? [];
    const getCF = (fieldKey: string): unknown =>
      cfs.find(f => f.id === fieldKey || f.key === fieldKey || f.fieldKey === fieldKey)
        ?.fieldValue
      ?? cfs.find(f => f.id === fieldKey || f.key === fieldKey || f.fieldKey === fieldKey)
        ?.value
      ?? null;

    const priority  = (getCF('lf_ticket_priority') as TicketPriority) ?? 'medium';
    const category  = (getCF('lf_ticket_category') as TicketCategory) ?? 'general';
    const aiProblem = (getCF('lf_ai_summary') as string) ?? '';

    return {
      id:               opp.id as string,
      ghlOpportunityId: opp.id as string,
      ghlContactId:     opp.contactId as string,
      title:            (opp.name as string) ?? 'Untitled',
      status:           stageNameToStatus(stageName) ?? 'new',
      priority,
      category,
      assignedTo:       (opp.assignedTo as string) ?? undefined,
      contactName:      (contact?.name as string) ?? (opp.contactName as string) ?? 'Unknown',
      slaDeadline:      null as unknown as Date,
      createdAt:        new Date(opp.createdAt as string),
      updatedAt:        new Date(opp.updatedAt as string),
      aiSummary: {
        problem:         aiProblem,
        category,
        priority,
        suggestedAction: '',
        generatedAt:     new Date(opp.updatedAt as string),
      },
    } as unknown as Ticket;
  });

  return json(tickets, 200, origin);
}

// GET /ghl/contacts/:id
async function getContact(
  ghlContactId: string,
  env: Env,
  origin: string
): Promise<Response> {
  const res = await fetch(`${GHL_V2_BASE}/contacts/${ghlContactId}`, {
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
  });

  if (!res.ok) {
    return json({ error: 'Contact not found' }, 404, origin);
  }

  const contact = mapContactToContact((await res.json()) as Record<string, unknown>);
  return json(contact, 200, origin);
}

// ---------------------------------------------------------------------------
// GHL webhook signature validation (HMAC-SHA256)
// ---------------------------------------------------------------------------
async function verifyGHLSignature(req: Request, secret: string): Promise<boolean> {
  const signature = req.headers.get('X-GHL-Signature') ?? '';
  if (!signature.startsWith('sha256=')) return false;

  const expectedHex = signature.slice(7);
  const body = await req.text();

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const actualHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Supabase upsert: support_tickets (service-role, server-side only)
// ---------------------------------------------------------------------------
async function upsertTicketStatus(
  ghlOpportunityId: string,
  locationId: string,
  status: TicketStatus,
  env: Env
): Promise<void> {
  const setConfigRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/set_config`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({ setting_name: 'app.location_id', new_value: locationId, is_local: true }),
  });

  if (!setConfigRes.ok) {
    throw new Error(`set_config failed: ${await setConfigRes.text()}`);
  }

  const upsertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/support_tickets`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      ghl_opportunity_id: ghlOpportunityId,
      location_id:        locationId,
      status,
      updated_at:         new Date().toISOString(),
    }),
  });

  if (!upsertRes.ok) {
    throw new Error(`Supabase upsert failed: ${await upsertRes.text()}`);
  }
}

// ---------------------------------------------------------------------------
// AI proxy: POST /ai/chat
// Brain path: if ticketId + locationId + category in body, uses brain context.
// Legacy path: if only messages + systemPrompt, falls back to original behavior.
// Both paths return { response, resolved } — backward compatible.
// ---------------------------------------------------------------------------
async function handleAIChat(req: Request, env: Env, origin: string): Promise<Response> {
  console.log('[ai/chat] received request');
  console.log('[ai/chat] ANTHROPIC_API_KEY bound:', !!env.ANTHROPIC_API_KEY);

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not bound' }, 503, origin);
  }

  let body: {
    messages:     Array<{ role: string; content: string }>;
    systemPrompt?: string;
    // Brain path fields (optional)
    ticketId?:    string;
    locationId?:  string;
    category?:    string;
    subcategory?: string;
    contactId?:   string;
    ticketStatus?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  const { messages } = body;
  console.log('[ai/chat] messages count:', messages?.length, '| brain path:', !!(body.ticketId && body.locationId));

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages array must be non-empty' }, 400, origin);
  }

  // ---------------------------------------------------------------------------
  // BRAIN PATH: ticketId + locationId + category provided → use brain context
  // ---------------------------------------------------------------------------
  if (body.ticketId && body.locationId && body.category) {
    try {
      const ctxInput: ConversationContextInput = {
        locationId:  body.locationId,
        ticketId:    body.ticketId,
        category:    body.category,
        subcategory: body.subcategory ?? null,
        contactId:   body.contactId ?? null,
        turnIndex:   messages.length,
      };

      const contextPkg = await assembleConversationContext(env, ctxInput).catch(e => {
        console.warn('[ai/chat] brain context assembly failed (non-fatal):', e);
        return {
          kbArticles: [], ticketMemories: [], sopChunks: [], graphInsights: [],
          contextScore: 0, contextWarnings: ['context failed'], assembledAt: new Date().toISOString(), phase: 1,
        };
      });

      // Find last client message for the user turn
      const lastClientMsg = [...messages]
        .reverse()
        .find(m => m.role === 'client' || m.role === 'user');

      const convInput: ConversationInput = {
        messages,
        lastClientMessage: lastClientMsg?.content ?? '',
        ticketCategory:    body.category,
        ticketStatus:      body.ticketStatus ?? undefined,
      };

      const result = await runLegacyZeroConversation(env, contextPkg, convInput);

      console.log(`[ai/chat] brain result: resolved=${result.resolved} confidence=${result.confidence} quality=${result.source_quality}`);

      return json({
        response:              result.customer_response,
        resolved:              result.resolved,
        // Extended fields (optional, backward compatible)
        confidence:            result.confidence,
        sourceQuality:         result.source_quality,
        escalationRecommended: false,
      }, 200, origin);

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[ai/chat] brain path error, falling through to legacy:', msg);
      // Fall through to legacy path on brain failure
    }
  }

  // ---------------------------------------------------------------------------
  // LEGACY PATH: original behavior — messages + systemPrompt
  // Kept exactly as-is for backward compatibility with existing frontend callers.
  // ---------------------------------------------------------------------------
  const { systemPrompt } = body;

  if (!systemPrompt) {
    return json({ error: 'messages and systemPrompt are required' }, 400, origin);
  }

  const CONVERSATION_STYLE_PREFIX = `You are LegacyZero, the AI support agent for Legacy Fusion.
Rules:
- Respond in plain conversational text only
- No markdown headers (no ##, ###)
- No bold (**text**) or italic (*text*)
- No bullet point lists unless absolutely necessary
- Keep responses under 3 sentences for simple questions
- Be warm, concise, and professional
- Do not start every message with "Hi there!" or "Hello!"
- Vary your greetings naturally
- If you believe the customer's issue has been fully resolved based on their last message (they confirmed it's working, said thank you and the issue is gone, or explicitly said it's fixed), append the exact token [RESOLVED] on a new line at the very end of your response — nothing after it. Only do this when clearly resolved. Never add [RESOLVED] speculatively.

`;

  try {
    const labeledHistory = messages.map((m: { role: string; content: string }) => {
      const r = m.role;
      if (r === 'client' || r === 'user')      return `[Client]: ${m.content}`;
      if (r === 'agent')                        return `[Agent]: ${m.content}`;
      if (r === 'ai' || r === 'assistant')      return `[LegacyZero]: ${m.content}`;
      return `[${r}]: ${m.content}`;
    }).join('\n');

    const contextPrefix =
      `CONVERSATION HISTORY:\n${labeledHistory}\n\n` +
      `The above is the full conversation so far. ` +
      `[Client] messages are from the customer. ` +
      `[Agent] messages are from a human support agent (NOT you). ` +
      `[LegacyZero] messages are your own previous responses. ` +
      `The client's latest message is directed at you. ` +
      `Respond only to the client — do not address the agent.\n\n`;

    const effectiveSystemPrompt = CONVERSATION_STYLE_PREFIX + contextPrefix + systemPrompt;

    const lastClientMsg = [...messages]
      .reverse()
      .find((m: { role: string; content: string }) =>
        m.role === 'client' || m.role === 'user'
      );

    const finalMessages = [{
      role: 'user' as const,
      content: lastClientMsg?.content ?? '',
    }];

    const requestBody = {
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [
        {
          type:          'text',
          text:          LEGACY_FUSION_KB,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: effectiveSystemPrompt,
        },
      ],
      messages: finalMessages,
    };

    console.log('[ai/chat] legacy request body:', JSON.stringify(requestBody).slice(0, 300));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[ai/chat] response status:', res.status);
    const raw = await res.text();
    console.log('[ai/chat] response body:', raw.slice(0, 500));

    if (!res.ok) {
      return json({ error: `Anthropic error ${res.status}`, detail: raw }, 502, origin);
    }

    let data: { content: Array<{ type: string; text: string }> };
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ error: 'Failed to parse Anthropic response', raw: raw.slice(0, 500) }, 502, origin);
    }

    const rawText = data.content?.[0]?.text ?? '';
    if (!rawText) {
      console.warn('[ai/chat] empty content from Anthropic, content:', JSON.stringify(data.content));
      return json({ response: '', resolved: false, error: 'empty content from Anthropic' }, 200, origin);
    }

    const stripped = rawText
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^\s*[-•]\s/gm, '')
      .trim();

    const RESOLVED_MARKER = '[RESOLVED]';
    const isResolved = stripped.includes(RESOLVED_MARKER);
    const text = stripped.replace(RESOLVED_MARKER, '').trim();

    return json({ response: text, resolved: isResolved }, 200, origin);

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[ai/chat] fetch error:', msg);
    return json({ error: 'AI call failed', detail: msg }, 502, origin);
  }
}

// ---------------------------------------------------------------------------
// Health check: GET /health
// Verifies Supabase and GHL connectivity without exposing secrets.
// No auth required.
// ---------------------------------------------------------------------------
async function handleHealth(env: Env): Promise<Response> {
  const timestamp = new Date().toISOString();

  // Defensive: check required env bindings are present
  if (!env.SUPABASE_URL) {
    return new Response(JSON.stringify({
      status:  'misconfigured',
      error:   'SUPABASE_URL is not bound to Worker env — check wrangler.toml [vars] or Cloudflare dashboard secrets',
      project: 'legacy-fusion-support',
      timestamp,
    }), {
      status:  503,
      headers: { 'Content-Type': 'application/json', ...IFRAME_HEADERS },
    });
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({
      status:  'misconfigured',
      error:   'SUPABASE_SERVICE_ROLE_KEY secret is not bound — run: wrangler secret put SUPABASE_SERVICE_ROLE_KEY',
      project: 'legacy-fusion-support',
      timestamp,
    }), {
      status:  503,
      headers: { 'Content-Type': 'application/json', ...IFRAME_HEADERS },
    });
  }

  if (!env.GHL_LOCATION_TOKEN) {
    return new Response(JSON.stringify({
      status:  'misconfigured',
      error:   'GHL_LOCATION_TOKEN secret is not bound — run: wrangler secret put GHL_LOCATION_TOKEN',
      project: 'legacy-fusion-support',
      timestamp,
    }), {
      status:  503,
      headers: { 'Content-Type': 'application/json', ...IFRAME_HEADERS },
    });
  }

  // Supabase check — SELECT from support_messages LIMIT 1
  let supabaseStatus: 'connected' | 'error' = 'error';
  let supabaseDetail = '';
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/support_messages?select=id&limit=1`,
      {
        headers: {
          'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    supabaseStatus = res.ok ? 'connected' : 'error';
    if (!res.ok) supabaseDetail = `HTTP ${res.status}`;
  } catch (e) {
    supabaseDetail = e instanceof Error ? e.message : String(e);
  }

  // GHL check — token presence only (no external HTTP call)
  // External GHL API reachability is validated separately via ticket create/list.
  let ghlStatus: 'connected' | 'error' = 'error';
  let ghlDetail = '';
  if (env.GHL_LOCATION_TOKEN) {
    ghlStatus = 'connected';
    ghlDetail = 'token present';
  } else {
    ghlDetail = 'GHL_LOCATION_TOKEN not bound — run: wrangler secret put GHL_LOCATION_TOKEN';
  }

  const allOk = supabaseStatus === 'connected' && ghlStatus === 'connected';
  const body: Record<string, unknown> = {
    status:    allOk ? 'ok' : 'degraded',
    project:   'legacy-fusion-support',
    supabase:  supabaseStatus,
    ghl:       ghlStatus,
    ghlNote:   'token presence check only — GHL API verified via ticket operations',
    timestamp,
  };
  if (supabaseDetail) body.supabaseDetail = supabaseDetail;
  if (ghlDetail)      body.ghlDetail      = ghlDetail;

  return new Response(JSON.stringify(body), {
    status:  allOk ? 200 : 503,
    headers: { 'Content-Type': 'application/json', ...IFRAME_HEADERS },
  });
}

// ---------------------------------------------------------------------------
// Webhook handler: POST /webhooks/ghl
// ---------------------------------------------------------------------------
async function handleGHLWebhook(req: Request, env: Env): Promise<Response> {
  const cloned = req.clone();

  const valid = await verifyGHLSignature(cloned, env.GHL_WEBHOOK_SECRET);
  if (!valid) {
    return json({ error: 'Invalid signature' }, 401, '');
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json<Record<string, unknown>>();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400, '');
  }

  const eventType = payload.type as string | undefined;

  if (eventType !== 'opportunity.stageChange') {
    return json({ received: true, handled: false, reason: `Unhandled event: ${eventType}` }, 200, '');
  }

  const opportunityId = payload.opportunityId as string | undefined;
  const newStage      = payload.newStage      as string | undefined;
  const locationId    = payload.locationId as string | undefined;

  if (!opportunityId || !newStage || !locationId) {
    return json({ error: 'Missing required fields: opportunityId, newStage, locationId' }, 422, '');
  }

  const newStatus = stageNameToStatus(newStage);
  if (!newStatus) {
    // Unknown stage — return 200 so GHL does not retry
    console.log(`[webhook] Unrecognised stage: "${newStage}" — skipping`);
    return json({ received: true, handled: false, reason: `Unknown stage: ${newStage}` }, 200, '');
  }

  try {
    await upsertTicketStatus(opportunityId, locationId, newStatus, env);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: 'Supabase sync failed', detail: msg }, 502, '');
  }

  // Graph activation — fire-and-forget when GHL signals resolved or closed
  if (newStatus === 'resolved' || newStatus === 'closed') {
    (async () => {
      try {
        // Fetch ticket metadata from Supabase (may exist if created via chat)
        const tRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/support_tickets` +
          `?ghl_opportunity_id=eq.${encodeURIComponent(opportunityId)}` +
          `&select=id,category,subcategory,title,summary,ghl_contact_id&limit=1`,
          {
            headers: {
              'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );

        const rows = tRes.ok
          ? (await tRes.json() as Array<{ id: string; category: string | null; subcategory: string | null; title: string | null; summary: string | null; ghl_contact_id: string | null }>)
          : [];

        const ticket    = rows[0];
        const category  = ticket?.category    ?? 'general';
        const sub       = ticket?.subcategory ?? null;

        await updateGraphForResolvedTicket(env, {
          ticketId:          opportunityId,
          locationId,
          category,
          subcategory:       sub,
          featureArea:       null,
          topicSummary:      ticket?.title ?? ticket?.summary ?? `GHL opportunity ${opportunityId}`,
          resolutionSummary: `Stage changed to ${newStatus} via GHL webhook`,
          resolvedBy:        'agent',
          kbArticleIds:      [],
        });

        // Resolution event
        await fetch(`${env.SUPABASE_URL}/rest/v1/support_resolution_events`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({
            location_id:           locationId,
            ticket_id:             ticket?.id ?? opportunityId,
            contact_id:            ticket?.ghl_contact_id ?? null,
            resolution_type:       newStatus === 'resolved' ? 'agent_resolved' : 'auto_closed',
            category,
            subcategory:           sub,
            resolution_summary:    `GHL pipeline stage → ${newStatus}`,
            kb_article_ids_used:   [],
            sop_ids_used:          [],
            ai_response_count:     0,
            agent_intervened:      true,
            resolved_at:           new Date().toISOString(),
            created_at:            new Date().toISOString(),
          }),
        }).catch(e => console.warn('[webhook/graph] resolution_event failed:', e));

        console.log(`[webhook/graph] graph updated for ${opportunityId} → ${newStatus}`);
      } catch (e) {
        console.warn('[webhook/graph] graph update error (non-fatal):', e instanceof Error ? e.message : String(e));
      }
    })();
  }

  return json({ received: true, handled: true, opportunityId, newStatus }, 200, '');
}

// POST /support/tickets — manual ticket creation from control panel
// ---------------------------------------------------------------------------
async function handleCreateManualTicket(
  request: Request, env: Env, origin: string
): Promise<Response> {
  const {
    locationId, title, contactName, contactEmail,
    contactPhone, businessName, source, category,
    priority, summary, plan, assignedTo
  } = await request.json() as any

  if (!locationId || !title) {
    return json({ error: 'locationId and title required' }, 400, origin)
  }

  // GHL contact search — non-fatal, only if email provided
  let ghlContactId: string | null = null
  if (contactEmail) {
    try {
      const sr = await fetch(
        `${GHL_V2_BASE}/contacts/?locationId=${locationId}&query=${encodeURIComponent(contactEmail)}`,
        { headers: ghlHeaders(env.GHL_LOCATION_TOKEN) }
      )
      if (sr.ok) {
        const sd = await sr.json() as any
        const cs = sd.contacts ?? sd.data?.contacts ?? []
        if (cs.length > 0) {
          ghlContactId = cs[0].id ?? null
          console.log('[manualTicket] GHL contact found:', ghlContactId)
        }
      }
    } catch (e) {
      console.warn('[manualTicket] GHL contact search failed (non-fatal):', e)
    }
  }

  const SLA_HOURS: Record<string, number> = { urgent: 2, high: 4, medium: 24, low: 72 }
  const slaDeadline = new Date(
    Date.now() + (SLA_HOURS[priority ?? 'medium'] ?? 24) * 3600000
  ).toISOString()

  const internalId = 'T-' + Math.random().toString(36).slice(2, 10).toUpperCase()

  const ticketRow = {
    id: internalId,
    location_id: locationId,
    status: 'new',
    title,
    contact_name: contactName ?? null,
    contact_email: contactEmail ?? null,
    contact_phone: contactPhone ?? null,
    business_name: businessName ?? null,
    source: (source ?? 'manual').toLowerCase(),
    category: category ?? 'general',
    priority: priority ?? 'medium',
    summary: summary ?? null,
    sla_deadline: slaDeadline,
    plan: plan ?? null,
    assigned_to: assignedTo ?? null,
    ghl_contact_id: ghlContactId,
    updated_at: new Date().toISOString()
  }

  const ir = await fetch(
    `${env.SUPABASE_URL}/rest/v1/support_tickets`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(ticketRow)
    }
  )

  if (!ir.ok) {
    const detail = await ir.text()
    console.error('[manualTicket] insert failed:', ir.status, detail)
    return json({ error: 'manual ticket creation failed', detail }, 502, origin)
  }

  console.log('[manualTicket] created:', internalId)
  return json({ ticketId: internalId }, 201, origin)
}

// ---------------------------------------------------------------------------
// POST /ai/learning/suggest
// Load ticket + messages → brain learning context → runLegacyZeroLearningSuggestion
// Insert: support_ticket_memories, support_learning_queue, support_resolution_events
// Returns: { queueItemId } or { skipped: true } if not worthy
// ---------------------------------------------------------------------------
async function handleLearningSuggest(req: Request, env: Env, origin: string): Promise<Response> {
  let body: {
    ticketId:          string;
    locationId:        string;
    contactId?:        string | null;
    category:          string;
    subcategory?:      string | null;
    featureArea?:      string | null;
    title:             string;
    summary?:          string | null;
    resolutionSummary: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  const { ticketId, locationId, category } = body;
  if (!ticketId || !locationId || !category) {
    return json({ error: 'ticketId, locationId, category required' }, 400, origin);
  }

  // Fetch conversation thread from Supabase
  const threadRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/support_messages` +
    `?ticket_id=eq.${encodeURIComponent(ticketId)}` +
    `&order=created_at.asc&select=role,content,is_internal,created_at`,
    {
      headers: {
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  const thread = threadRes.ok
    ? (await threadRes.json() as Array<{ role: string; content: string; is_internal: boolean; created_at: string }>)
    : [];

  console.log(`[learning/suggest] ticket=${ticketId} thread=${thread.length} category=${category}`);

  // Assemble learning context
  const ctxInput: LearningContextInput = {
    locationId,
    ticketId,
    category,
    subcategory:      body.subcategory ?? null,
    resolutionSummary: body.resolutionSummary,
  };

  const contextPkg = await assembleLearningContext(env, ctxInput).catch(() => ({
    kbArticles: [], ticketMemories: [], sopChunks: [], graphInsights: [],
    contextScore: 0, contextWarnings: [], assembledAt: new Date().toISOString(), phase: 1,
  }));

  const learningInput: LearningInput = {
    ticketId,
    title:             body.title,
    category,
    subcategory:       body.subcategory ?? null,
    summary:           body.summary ?? '',
    resolutionSummary: body.resolutionSummary,
    thread,
  };

  const suggestion = await runLegacyZeroLearningSuggestion(env, contextPkg, learningInput);

  // Always write ticket memory (regardless of KB worthiness)
  const memoryRow = {
    location_id:           locationId,
    contact_id:            body.contactId ?? 'unknown',
    ticket_id:             ticketId,
    topic_summary:         body.summary ?? body.title ?? 'Support issue',
    resolution_summary:    body.resolutionSummary,
    category,
    subcategory:           body.subcategory ?? null,
    resolved_by:           'agent',
    ticket_created_at:     new Date().toISOString(),
    ticket_resolved_at:    new Date().toISOString(),
    exported_to_canonical: false,
    created_at:            new Date().toISOString(),
    updated_at:            new Date().toISOString(),
  };

  fetch(`${env.SUPABASE_URL}/rest/v1/support_ticket_memories`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(memoryRow),
  }).catch(e => console.warn('[learning/suggest] memory insert failed:', e));

  // Write resolution event
  fetch(`${env.SUPABASE_URL}/rest/v1/support_resolution_events`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({
      location_id:           locationId,
      ticket_id:             ticketId,
      contact_id:            body.contactId ?? null,
      resolution_type:       'agent_resolved',
      category,
      subcategory:           body.subcategory ?? null,
      resolution_summary:    body.resolutionSummary,
      kb_article_ids_used:   [],
      sop_ids_used:          [],
      ai_response_count:     thread.filter(m => m.role === 'ai').length,
      agent_intervened:      true,
      resolved_at:           new Date().toISOString(),
      created_at:            new Date().toISOString(),
    }),
  }).catch(e => console.warn('[learning/suggest] resolution_events insert failed:', e));

  // Update cognitive graph — nodes + edges for this resolution (fire-and-forget)
  // Spec §15: upsert location / ticket-topic / issue-category / feature / resolution nodes
  // Edges: topic→category (relates_to), feature→category (feature_of),
  //        resolution→feature (resolves_via), category→resolution (common_with)
  updateGraphForResolvedTicket(env, {
    ticketId,
    locationId,
    category,
    subcategory:       body.subcategory ?? null,
    featureArea:       body.featureArea  ?? null,
    topicSummary:      body.summary      ?? body.title ?? `Support issue: ${category}`,
    resolutionSummary: body.resolutionSummary,
    resolvedBy:        'agent',
    kbArticleIds:      [],
  }).catch(e => console.warn('[learning/suggest] graph update failed:', e));

  if (!suggestion) {
    console.log('[learning/suggest] not worthy — skipping queue insert');
    return json({ skipped: true, reason: 'not_worthy' }, 200, origin);
  }

  // Insert into learning queue
  const queueRow = {
    location_id:       locationId,
    ticket_id:         ticketId,
    source_type:       'resolution_event',
    suggested_title:   suggestion.suggested_title,
    suggested_problem: suggestion.problem,
    suggested_solution: suggestion.solution,
    category:          suggestion.category,
    subcategory:       suggestion.subcategory ?? null,
    suggested_tags:    suggestion.tags,
    ai_confidence:     suggestion.confidence,
    status:            suggestion.confidence >= 0.6 ? 'pending' : 'low_confidence',
    exported_to_canonical: false,
    created_at:        new Date().toISOString(),
    updated_at:        new Date().toISOString(),
  };

  const queueRes = await fetch(`${env.SUPABASE_URL}/rest/v1/support_learning_queue`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer':        'return=representation',
    },
    body: JSON.stringify(queueRow),
  });

  if (!queueRes.ok) {
    const detail = await queueRes.text();
    console.error('[learning/suggest] queue insert failed:', queueRes.status, detail);
    return json({ error: 'queue insert failed', detail }, 502, origin);
  }

  const queueRows = await queueRes.json() as Array<{ id: string }>;
  const queueItemId = queueRows[0]?.id ?? null;

  console.log(`[learning/suggest] queued: ${queueItemId} | confidence=${suggestion.confidence} | status=${queueRow.status}`);

  return json({
    queueItemId,
    status:     queueRow.status,
    confidence: suggestion.confidence,
    title:      suggestion.suggested_title,
  }, 201, origin);
}

// ---------------------------------------------------------------------------
// GET /support/learning-queue?locationId=xxx&status=pending&limit=20
// Returns pending learning queue items for agent review.
// ---------------------------------------------------------------------------
async function handleGetLearningQueue(req: Request, env: Env, origin: string): Promise<Response> {
  const url        = new URL(req.url);
  const locationId = url.searchParams.get('locationId');
  const status     = url.searchParams.get('status') ?? 'pending';
  const limit      = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);

  if (!locationId) {
    return json({ error: 'locationId required' }, 400, origin);
  }

  const validStatuses = ['pending', 'low_confidence', 'approved', 'rejected'];
  const statusFilter = validStatuses.includes(status) ? status : 'pending';

  const qRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/support_learning_queue` +
    `?location_id=eq.${encodeURIComponent(locationId)}` +
    `&status=eq.${statusFilter}` +
    `&order=ai_confidence.desc,created_at.desc` +
    `&limit=${limit}` +
    `&select=id,ticket_id,suggested_title,suggested_problem,suggested_solution,category,subcategory,suggested_tags,ai_confidence,status,created_at`,
    {
      headers: {
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Accept':        'application/json',
      },
    }
  );

  if (!qRes.ok) {
    const detail = await qRes.text();
    console.error('[learning-queue] fetch failed:', qRes.status, detail);
    return json({ error: 'failed to fetch learning queue', detail }, 502, origin);
  }

  const items = await qRes.json() as unknown[];
  console.log(`[learning-queue] returning ${(items as unknown[]).length} items | location=${locationId} status=${statusFilter}`);
  return json({ items }, 200, origin);
}

// ---------------------------------------------------------------------------
// PATCH /support/learning-queue/:id/review
// Agent approves or rejects a learning queue item.
// Approved: insert to support_knowledge_articles → update queue → update graph
// Rejected: update queue with reason
// ---------------------------------------------------------------------------
async function handleReviewLearningQueue(
  queueItemId: string,
  req: Request,
  env: Env,
  origin: string
): Promise<Response> {
  let body: {
    action:           'approved' | 'edited_approved' | 'rejected' | 'dismissed';
    reviewedBy:       string;
    locationId:       string;
    // For approved/edited_approved:
    title?:           string;
    problem?:         string;
    solution?:        string;
    category?:        string;
    subcategory?:     string | null;
    tags?:            string[];
    // For rejected:
    rejectionReason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  const { action, reviewedBy, locationId } = body;
  if (!action || !reviewedBy || !locationId) {
    return json({ error: 'action, reviewedBy, locationId required' }, 400, origin);
  }

  const now = new Date().toISOString();

  // Fetch the queue item
  const itemRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/support_learning_queue` +
    `?id=eq.${encodeURIComponent(queueItemId)}&limit=1&select=*`,
    {
      headers: {
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!itemRes.ok) {
    return json({ error: 'failed to fetch queue item' }, 502, origin);
  }

  const items = await itemRes.json() as Array<Record<string, unknown>>;
  if (!items.length) {
    return json({ error: 'queue item not found' }, 404, origin);
  }

  const item = items[0];

  // ---- APPROVED or EDITED_APPROVED ----
  if (action === 'approved' || action === 'edited_approved') {
    const title      = (action === 'edited_approved' && body.title)    ? body.title    : item.suggested_title as string;
    const problem    = (action === 'edited_approved' && body.problem)   ? body.problem  : item.suggested_problem as string;
    const solution   = (action === 'edited_approved' && body.solution)  ? body.solution : item.suggested_solution as string;
    const category   = (action === 'edited_approved' && body.category)  ? body.category : item.category as string;
    const subcategory = body.subcategory ?? (item.subcategory as string | null) ?? null;
    const tags       = (action === 'edited_approved' && body.tags)      ? body.tags     : (item.suggested_tags as string[] ?? []);

    // Insert into support_knowledge_articles
    const articleRes = await fetch(`${env.SUPABASE_URL}/rest/v1/support_knowledge_articles`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer':        'return=representation',
      },
      body: JSON.stringify({
        location_id:       locationId,
        title,
        problem,
        solution,
        category,
        subcategory:       subcategory,
        feature_area:      null,
        tags,
        source:            'agent_approved',
        source_ticket_id:  item.ticket_id as string,
        approved_by:       reviewedBy,
        approved_at:       now,
        active:            true,
        retrieval_count:   0,
        helpful_count:     0,
        created_at:        now,
        updated_at:        now,
      }),
    });

    if (!articleRes.ok) {
      const detail = await articleRes.text();
      console.error('[review] article insert failed:', articleRes.status, detail);
      return json({ error: 'knowledge article insert failed', detail }, 502, origin);
    }

    const articleRows = await articleRes.json() as Array<{ id: string }>;
    const articleId = articleRows[0]?.id ?? null;

    console.log(`[review] approved: queueItem=${queueItemId} → article=${articleId}`);

    // Update queue item: approved + promoted_article_id
    fetch(
      `${env.SUPABASE_URL}/rest/v1/support_learning_queue?id=eq.${encodeURIComponent(queueItemId)}`,
      {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          status:             'approved',
          reviewed_by:        reviewedBy,
          reviewed_at:        now,
          promoted_article_id: articleId,
          updated_at:         now,
        }),
      }
    ).catch(e => console.warn('[review] queue update failed:', e));

    // ---------------------------------------------------------------------------
    // Cognitive graph update — fire-and-forget, fully enriched
    // Spec G2: upsert knowledge_article node + link to issue/solution/feature nodes
    // ---------------------------------------------------------------------------
    if (articleId) {
      (async () => {
        try {
          // Derive feature_area from tags heuristic: look for known feature keywords
          // Priority: explicit feature_area tags > subcategory > null
          const FEATURE_TAG_MAP: Record<string, string> = {
            'workflow':         'Workflows',
            'automation':       'Workflows',
            'trigger':          'Triggers',
            'form':             'Forms',
            'funnel':           'Funnels',
            'calendar':         'Calendar',
            'sms':              'SMS',
            'email':            'Email',
            'pipeline':         'Pipelines',
            'contact':          'Contacts',
            'domain':           'Custom Domains',
            'ssl':              'Custom Domains',
            'google-calendar':  'Google Calendar',
            'integration':      'Integrations',
            'zapier':           'Zapier',
            'billing':          'Billing',
            'login':            'Account Access',
            'password':         'Account Access',
            'permissions':      'Roles and Permissions',
            'role':             'Roles and Permissions',
          };

          let derivedFeatureArea: string | null = null;
          for (const tag of tags) {
            const tagLower = tag.toLowerCase();
            if (FEATURE_TAG_MAP[tagLower]) {
              derivedFeatureArea = FEATURE_TAG_MAP[tagLower];
              break;
            }
            // Partial match
            for (const [key, val] of Object.entries(FEATURE_TAG_MAP)) {
              if (tagLower.includes(key)) { derivedFeatureArea = val; break; }
            }
            if (derivedFeatureArea) break;
          }

          console.log(`[review/graph] articleId=${articleId} category=${category} subcategory=${subcategory} featureArea=${derivedFeatureArea}`);

          // Upsert: knowledge_article node + category + subcategory + feature nodes + edges
          await updateGraphForApprovedKnowledge(env, {
            id:           articleId,
            title,
            category,
            subcategory:  subcategory ?? null,
            feature_area: derivedFeatureArea,
            tags,
          });

          // Also update retrieval_count on the article to signal it has been graph-linked
          await fetch(
            `${env.SUPABASE_URL}/rest/v1/support_knowledge_articles?id=eq.${encodeURIComponent(articleId)}`,
            {
              method:  'PATCH',
              headers: {
                'Content-Type':  'application/json',
                'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                'Prefer':        'return=minimal',
              },
              body: JSON.stringify({
                feature_area: derivedFeatureArea,
                updated_at:   now,
              }),
            }
          ).catch(e => console.warn('[review/graph] feature_area backfill failed:', e));

          // Write a resolution event linking this KB article back to its source ticket
          const sourceTicketId = item.ticket_id as string | null;
          if (sourceTicketId) {
            await fetch(`${env.SUPABASE_URL}/rest/v1/support_resolution_events`, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                'Prefer':        'return=minimal',
              },
              body: JSON.stringify({
                location_id:           locationId,
                ticket_id:             sourceTicketId,
                contact_id:            null,
                resolution_type:       'agent_resolved',
                category,
                subcategory:           subcategory ?? null,
                resolution_summary:    `KB article "${title}" approved and added to knowledge base`,
                kb_article_ids_used:   [articleId],
                sop_ids_used:          [],
                ai_response_count:     0,
                agent_intervened:      true,
                resolved_at:           now,
                created_at:            now,
              }),
            }).catch(e => console.warn('[review/graph] resolution_event insert failed:', e));
          }

          console.log(`[review/graph] graph fully updated for article: ${articleId} | "${title}"`);
        } catch (graphErr) {
          console.warn('[review/graph] error (non-fatal):', graphErr instanceof Error ? graphErr.message : String(graphErr));
        }
      })();
    }

    return json({ success: true, articleId, action: 'approved' }, 200, origin);
  }

  // ---- REJECTED or DISMISSED ----
  const newStatus = action === 'dismissed' ? 'rejected' : 'rejected';
  const rejectionReason = body.rejectionReason ?? (action === 'dismissed' ? 'dismissed by agent' : 'rejected by agent');

  fetch(
    `${env.SUPABASE_URL}/rest/v1/support_learning_queue?id=eq.${encodeURIComponent(queueItemId)}`,
    {
      method:  'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        status:           newStatus,
        reviewed_by:      reviewedBy,
        reviewed_at:      now,
        rejection_reason: rejectionReason,
        updated_at:       now,
      }),
    }
  ).catch(e => console.warn('[review] queue reject update failed:', e));

  console.log(`[review] rejected: queueItem=${queueItemId} | reason=${rejectionReason}`);
  return json({ success: true, action: 'rejected' }, 200, origin);
}

// ---------------------------------------------------------------------------
// POST /support/brain/export-approved-kb
//
// Reads support_knowledge_articles where active=true and either:
//   (a) canonical_file_path IS NULL (never exported), or
//   (b) exported_to_canonical explicitly requested
//
// Returns a sanitized JSON array of articles ready for canonical brain sync.
// After the caller writes files to legacyzero-brain, they call this endpoint
// again with exported=true + file paths to mark them exported in Supabase.
//
// Two sub-actions via body:
//   { action: 'fetch' }              → returns unexported active articles
//   { action: 'mark', items: [...] } → marks articles as exported with paths
// ---------------------------------------------------------------------------
async function handleExportApprovedKB(req: Request, env: Env, origin: string): Promise<Response> {
  let body: {
    action:   'fetch' | 'mark';
    locationId?: string | null;   // null = all locations (admin export)
    limit?:   number;
    items?:   Array<{
      id:                  string;
      canonical_file_path: string;
      canonical_git_commit?: string | null;
    }>;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  const { action, limit = 100 } = body;

  // ---------------------------------------------------------------------------
  // action: fetch — return unexported active articles
  // ---------------------------------------------------------------------------
  if (action === 'fetch') {
    const locationFilter = body.locationId
      ? `&location_id=eq.${encodeURIComponent(body.locationId)}`
      : '';

    // Query: active=true AND (canonical_file_path IS NULL = never exported)
    const query =
      `support_knowledge_articles` +
      `?active=eq.true` +
      `&canonical_file_path=is.null` +
      `${locationFilter}` +
      `&order=created_at.asc` +
      `&limit=${Math.min(limit, 200)}` +
      `&select=id,location_id,title,problem,solution,category,subcategory,feature_area,tags,source,source_ticket_id,approved_by,approved_at,created_at`;

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${query}`, {
      headers: {
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Accept':        'application/json',
      },
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[export-kb/fetch] failed:', res.status, detail.slice(0, 200));
      return json({ error: 'fetch failed', detail }, 502, origin);
    }

    type ArticleRow = {
      id: string; location_id: string | null; title: string; problem: string;
      solution: string; category: string; subcategory: string | null;
      feature_area: string | null; tags: string[]; source: string;
      source_ticket_id: string | null; approved_by: string | null;
      approved_at: string | null; created_at: string;
    };

    const rows = await res.json() as ArticleRow[];

    // Sanitize: strip any internal IDs, return clean exportable shape
    const articles = rows.map(r => ({
      id:               r.id,
      location_id:      r.location_id,        // null = global
      title:            r.title,
      problem:          r.problem,
      solution:         r.solution,
      category:         r.category,
      subcategory:      r.subcategory ?? null,
      feature_area:     r.feature_area ?? null,
      tags:             r.tags ?? [],
      source:           r.source,
      source_ticket_id: r.source_ticket_id ?? null,
      approved_by:      r.approved_by ?? null,
      approved_at:      r.approved_at ?? null,
      created_at:       r.created_at,
      // Suggested file path for canonical brain — caller writes file here
      suggested_file_path: `knowledge/${r.location_id ? `location-specific/${r.location_id}` : 'global'}/${r.category}/${r.id.slice(0, 8)}-${slugifyTitle(r.title)}.md`,
    }));

    console.log(`[export-kb/fetch] returning ${articles.length} unexported articles`);
    return json({ articles, count: articles.length }, 200, origin);
  }

  // ---------------------------------------------------------------------------
  // action: mark — update canonical_file_path after export
  // ---------------------------------------------------------------------------
  if (action === 'mark') {
    const items = body.items ?? [];
    if (!items.length) {
      return json({ error: 'items array required for mark action' }, 400, origin);
    }

    const now = new Date().toISOString();
    let marked = 0;
    const errors: string[] = [];

    for (const item of items) {
      if (!item.id || !item.canonical_file_path) {
        errors.push(`invalid item: ${JSON.stringify(item).slice(0, 80)}`);
        continue;
      }

      const patchRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/support_knowledge_articles?id=eq.${encodeURIComponent(item.id)}`,
        {
          method:  'PATCH',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({
            canonical_file_path:  item.canonical_file_path,
            canonical_git_commit: item.canonical_git_commit ?? null,
            updated_at:           now,
          }),
        }
      );

      if (!patchRes.ok) {
        const detail = await patchRes.text().catch(() => 'unknown');
        errors.push(`${item.id}: ${patchRes.status} ${detail.slice(0, 80)}`);
        console.warn('[export-kb/mark] patch failed:', item.id, patchRes.status);
      } else {
        marked++;
        console.log(`[export-kb/mark] marked: ${item.id} → ${item.canonical_file_path}`);

        // Write support_resolution_events: exported_to_canonical
        fetch(`${env.SUPABASE_URL}/rest/v1/support_resolution_events`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({
            location_id:           'global',
            ticket_id:             item.id,  // using article id as reference (no ticket context here)
            contact_id:            null,
            resolution_type:       'agent_resolved',
            category:              'general',
            subcategory:           null,
            resolution_summary:    `KB article exported to canonical brain: ${item.canonical_file_path}`,
            kb_article_ids_used:   [item.id],
            sop_ids_used:          [],
            ai_response_count:     0,
            agent_intervened:      false,
            resolved_at:           now,
            created_at:            now,
          }),
        }).catch(e => console.warn('[export-kb/mark] resolution_event failed:', e));
      }
    }

    console.log(`[export-kb/mark] marked ${marked}/${items.length} articles`);
    return json({
      success: true,
      marked,
      errors: errors.length > 0 ? errors : undefined,
    }, 200, origin);
  }

  return json({ error: `Unknown action: ${action}. Use 'fetch' or 'mark'` }, 400, origin);
}

/** Slugify an article title for use in file paths */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
    const url    = new URL(req.url);
    const method = req.method.toUpperCase();
    const path   = url.pathname;

    // Health check — no auth, no CORS enforcement
    if (method === 'GET' && path === '/health') {
      return handleHealth(env);
    }

    // GHL webhook — no CORS check, signature validated internally
    if (method === 'POST' && path === '/webhooks/ghl') {
      return handleGHLWebhook(req, env);
    }

    // CORS enforcement for all browser-facing routes
    const requestOrigin = req.headers.get('Origin')?.trim() ?? '';
    const allowedOrigins = [
      (env.SUPPORT_CORS_ORIGIN ?? '').trim(),
      'https://legacy-fusion-support.hector-0b9.workers.dev',
      'https://app.legacy-fusion.com',
    ].filter(Boolean);

    const originAllowed = !requestOrigin || allowedOrigins.includes(requestOrigin);

    // Handle OPTIONS preflight — always respond, never block
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin':  requestOrigin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
          'Access-Control-Max-Age':       '86400',
        },
      });
    }

    // For non-OPTIONS: block if origin is set and not in allowed list
    if (!originAllowed) {
      return new Response(
        JSON.stringify({ error: 'forbidden', requestOrigin, allowedOrigins }),
        {
          status: 403,
          headers: {
            'Content-Type':                'application/json',
            'Access-Control-Allow-Origin': requestOrigin || '*',
          },
        }
      );
    }

    // Set origin for json() helper responses
    const origin = requestOrigin || allowedOrigins[0] || '*';

    if (method === 'POST' && path === '/ai/chat') {
      return handleAIChat(req, env, origin);
    }

    if (method === 'POST' && path === '/ghl/tickets/create') {
      return createTicket(req, env, origin);
    }

    if (method === 'GET' && path === '/support/tickets') {
      return handleGetTickets(req, env, origin);
    }

    if (method === 'POST' && path === '/support/tickets') {
      return handleCreateManualTicket(req, env, origin);
    }

    const statusMatch = path.match(/^\/ghl\/tickets\/([^/]+)\/status$/);
    if (method === 'PATCH' && statusMatch) {
      return updateTicketStatus(statusMatch[1], req, env, origin);
    }

    const ticketMatch = path.match(/^\/ghl\/tickets\/([^/]+)$/);
    if (method === 'GET' && ticketMatch) {
      return getTicket(ticketMatch[1], env, origin);
    }

    if (method === 'GET' && path === '/ghl/tickets') {
      return listTickets(url, env, origin);
    }

    const contactMatch = path.match(/^\/ghl\/contacts\/([^/]+)$/);
    if (method === 'GET' && contactMatch) {
      return getContact(contactMatch[1], env, origin);
    }

    if (method === 'GET' && path === '/ghl/users') {
      return getUsers(env, origin);
    }

    const assignMatch = path.match(/^\/ghl\/tickets\/([^/]+)\/assign$/);
    if (method === 'PATCH' && assignMatch) {
      return assignTicket(assignMatch[1], req, env, origin);
    }

    if (method === 'POST' && path === '/kb/save') {
      return saveKnowledgeBase(req, env, origin);
    }

    // POST /ai/learning/suggest — brain learning pipeline trigger
    if (method === 'POST' && path === '/ai/learning/suggest') {
      return handleLearningSuggest(req, env, origin);
    }

    // POST /support/brain/export-approved-kb — export approved articles to canonical brain
    if (method === 'POST' && path === '/support/brain/export-approved-kb') {
      return handleExportApprovedKB(req, env, origin);
    }

    // GET /support/learning-queue?locationId=xxx&status=pending&limit=20
    if (method === 'GET' && path === '/support/learning-queue') {
      return handleGetLearningQueue(req, env, origin);
    }

    // PATCH /support/learning-queue/:id/review
    const learningQueueReviewMatch = path.match(/^\/support\/learning-queue\/([^/]+)\/review$/);
    if (method === 'PATCH' && learningQueueReviewMatch) {
      return handleReviewLearningQueue(learningQueueReviewMatch[1], req, env, origin);
    }

    // GET /support/tickets/mine?userId=xxx&locationId=xxx
    if (method === 'GET' && path === '/support/tickets/mine') {
      const mineUserId     = url.searchParams.get('userId');
      const mineLocationId = url.searchParams.get('locationId');

      if (!mineUserId || !mineLocationId) {
        return json({ error: 'userId and locationId required' }, 400, origin);
      }

      const mineRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/support_tickets` +
        `?user_id=eq.${encodeURIComponent(mineUserId)}` +
        `&location_id=eq.${encodeURIComponent(mineLocationId)}` +
        `&source=eq.chat` +
        `&order=updated_at.desc` +
        `&select=id,status,title,updated_at,priority,category,summary`,
        {
          headers: {
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );

      if (!mineRes.ok) {
        const detail = await mineRes.text();
        console.error('[mine] fetch failed:', mineRes.status, detail);
        return json({ error: 'failed to fetch user tickets', detail }, 502, origin);
      }

      const mineRows = await mineRes.json() as Array<{
        id: string; status: string; title: string;
        updated_at: string; priority: string; category: string;
        summary: string | null;
      }>;

      const OPEN_STAGES     = new Set(['new', 'triaged', 'in_progress']);
      const WAITING_STAGES  = new Set(['waiting_client', 'waiting_internal', 'escalated']);
      const RESOLVED_STAGES = new Set(['resolved', 'closed']);

      const grouped = {
        open:     mineRows.filter(r => OPEN_STAGES.has(r.status)),
        waiting:  mineRows.filter(r => WAITING_STAGES.has(r.status)),
        resolved: mineRows.filter(r => RESOLVED_STAGES.has(r.status)),
      };

      console.log('[mine] userId:', mineUserId,
        '| open:', grouped.open.length,
        '| waiting:', grouped.waiting.length,
        '| resolved:', grouped.resolved.length);

      return json(grouped, 200, origin);
    }

    // GET /support/tickets/stages?locationId=xxx — return { [ghlOpportunityId]: status } map
    if (method === 'GET' && path === '/support/tickets/stages') {
      const stagesLocationId = url.searchParams.get('locationId');
      if (!stagesLocationId) return json({ error: 'locationId required' }, 400, origin);

      const stagesRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/support_tickets?location_id=eq.${encodeURIComponent(stagesLocationId)}&select=id,ghl_opportunity_id,status`,
        {
          headers: {
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );

      if (!stagesRes.ok) {
        const detail = await stagesRes.text();
        console.error('[stages] fetch failed:', stagesRes.status, detail);
        return json({ error: 'failed to fetch stages', detail }, 502, origin);
      }

      const rows = await stagesRes.json() as Array<{ id: string; ghl_opportunity_id: string | null; status: string }>;
      const stageMap: Record<string, string> = {};
      for (const row of rows) {
        // Always index by internal id (covers manual tickets)
        stageMap[row.id] = row.status;
        // Also index by ghl_opportunity_id if present (covers GHL-linked tickets)
        if (row.ghl_opportunity_id) stageMap[row.ghl_opportunity_id] = row.status;
      }

      console.log('[stages] returning', Object.keys(stageMap).length, 'stages for location:', stagesLocationId);
      return json({ stages: stageMap }, 200, origin);
    }

    // GET /support/tickets/:id — return full support_tickets row by primary key id
    const supportTicketMatch = path.match(/^\/support\/tickets\/([^/]+)$/);
    if (method === 'GET' && supportTicketMatch) {
      const ticketId = supportTicketMatch[1];
      const stRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/support_tickets?id=eq.${encodeURIComponent(ticketId)}&select=*&limit=1`,
        {
          headers: {
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (!stRes.ok) {
        const detail = await stRes.text();
        console.error('[support/tickets/:id] fetch failed:', stRes.status, detail);
        return json({ error: 'ticket fetch failed', detail }, 502, origin);
      }
      const rows = await stRes.json() as any[];
      if (!rows.length) return json({ error: 'not found' }, 404, origin);
      return json(rows[0], 200, origin);
    }

    // PATCH /support/tickets/:id/sla — update sla_deadline in Supabase
    const slaMatch = path.match(/^\/support\/tickets\/([^/]+)\/sla$/);
    if (method === 'PATCH' && slaMatch) {
      const ticketId = slaMatch[1];
      let slaBody: { slaDeadline?: string };
      try {
        const raw = await req.text();
        slaBody = raw ? JSON.parse(raw) : {};
      } catch {
        return json({ error: 'invalid JSON' }, 400, origin);
      }

      if (!slaBody.slaDeadline) {
        return json({ error: 'slaDeadline required' }, 400, origin);
      }

      const slaPatchRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/support_tickets?id=eq.${encodeURIComponent(ticketId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({
            sla_deadline: slaBody.slaDeadline,
            updated_at:   new Date().toISOString(),
          }),
        }
      );

      if (!slaPatchRes.ok) {
        const detail = await slaPatchRes.text();
        return json({ error: 'sla update failed', detail }, 502, origin);
      }

      console.log('[sla] updated:', ticketId, '→', slaBody.slaDeadline);
      return json({ ok: true }, 200, origin);
    }

    // PATCH /support/tickets/:id/assign — assign agent in Supabase
    const assignTicketMatch = path.match(/^\/support\/tickets\/([^/]+)\/assign$/);
    if (method === 'PATCH' && assignTicketMatch) {
      const ticketId = assignTicketMatch[1];
      const rawText = await req.text();
      console.log('[assign] raw body:', rawText);

      let body: { assignedTo?: string } = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        console.error('[assign] JSON parse failed:', rawText);
        return json({ error: 'invalid JSON', raw: rawText }, 400, origin);
      }

      if (!('assignedTo' in body)) {
        return json({ error: 'assignedTo field missing' }, 400, origin);
      }

      const patchRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/support_tickets?id=eq.${encodeURIComponent(ticketId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({
            assigned_to: body.assignedTo ?? null,
            updated_at:  new Date().toISOString(),
          }),
        }
      );

      if (!patchRes.ok) {
        const detail = await patchRes.text();
        return json({ error: 'assign failed', detail }, 502, origin);
      }

      console.log('[assign] ticket:', ticketId, '→', body.assignedTo ?? 'unassigned');
      return json({ ok: true }, 200, origin);
    }

    // PATCH /support/tickets/:id/priority — update priority in Supabase
    const priorityMatch = path.match(/^\/support\/tickets\/([^/]+)\/priority$/);
    if (method === 'PATCH' && priorityMatch) {
      const ticketId = priorityMatch[1];
      let priorityBody: { priority?: string };
      try {
        const raw = await req.text();
        priorityBody = raw ? JSON.parse(raw) : {};
      } catch {
        return json({ error: 'invalid JSON' }, 400, origin);
      }

      if (!priorityBody.priority) {
        return json({ error: 'priority required' }, 400, origin);
      }

      const validPriorities = ['urgent', 'high', 'medium', 'low'];
      if (!validPriorities.includes(priorityBody.priority)) {
        return json({ error: 'invalid priority' }, 400, origin);
      }

      const priorityPatchRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/support_tickets?id=eq.${encodeURIComponent(ticketId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({
            priority:   priorityBody.priority,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      if (!priorityPatchRes.ok) {
        const detail = await priorityPatchRes.text();
        return json({ error: 'priority update failed', detail }, 502, origin);
      }

      console.log('[priority] updated:', ticketId, '→', priorityBody.priority);
      return json({ ok: true }, 200, origin);
    }

    // PATCH /support/tickets/:id/stage — update pipeline stage in Supabase only
    const stageMatch = path.match(/^\/support\/tickets\/([^/]+)\/stage$/);
    if (method === 'PATCH' && stageMatch) {
      const ticketId = stageMatch[1];
      let stageBody: { stage: string };
      try { stageBody = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400, origin); }

      const VALID_STAGES = [
        'new','triaged','in_progress','waiting_client',
        'waiting_internal','escalated','resolved','closed',
      ];
      if (!stageBody.stage || !VALID_STAGES.includes(stageBody.stage)) {
        return json({ error: 'invalid stage' }, 400, origin);
      }

      // Match by internal id first, fall back to ghl_opportunity_id for legacy tickets
      const stageRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/support_tickets?or=(id.eq.${encodeURIComponent(ticketId)},ghl_opportunity_id.eq.${encodeURIComponent(ticketId)})`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({ status: stageBody.stage, updated_at: new Date().toISOString() }),
        }
      );

      if (!stageRes.ok) {
        const detail = await stageRes.text();
        console.error('[stage] update failed:', stageRes.status, detail);
        return json({ error: 'stage update failed', status: stageRes.status, detail }, 502, origin);
      }

      console.log('[stage] updated:', ticketId, '→', stageBody.stage);
      // TODO: GHL pipeline sync (activate when opportunities write scope is granted)

      // ---------------------------------------------------------------------------
      // Graph activation: fire-and-forget when resolving or closing a ticket.
      // Fetch the ticket row for metadata (category, subcategory, location_id, etc.)
      // then upsert the cognitive graph nodes/edges for this resolution event.
      // Non-fatal — never blocks the response.
      // ---------------------------------------------------------------------------
      if (stageBody.stage === 'resolved' || stageBody.stage === 'closed') {
        (async () => {
          try {
            // Fetch ticket metadata — needed for graph node context
            const ticketFetch = await fetch(
              `${env.SUPABASE_URL}/rest/v1/support_tickets` +
              `?or=(id.eq.${encodeURIComponent(ticketId)},ghl_opportunity_id.eq.${encodeURIComponent(ticketId)})` +
              `&select=id,location_id,category,subcategory,title,summary,ghl_contact_id&limit=1`,
              {
                headers: {
                  'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                },
              }
            );

            if (!ticketFetch.ok) {
              console.warn('[stage/graph] ticket fetch failed:', ticketFetch.status, '— skipping graph update');
              return;
            }

            const rows = await ticketFetch.json() as Array<{
              id: string;
              location_id: string;
              category: string | null;
              subcategory: string | null;
              title: string | null;
              summary: string | null;
              ghl_contact_id: string | null;
            }>;

            if (!rows.length) {
              console.warn('[stage/graph] ticket not found:', ticketId, '— skipping graph update');
              return;
            }

            const ticket = rows[0];
            const ticketCategory    = ticket.category    ?? 'general';
            const ticketSubcategory = ticket.subcategory ?? null;
            const ticketLocationId  = ticket.location_id;

            console.log(`[stage/graph] triggering graph update for ${ticketId} → ${stageBody.stage} | cat=${ticketCategory}`);

            await updateGraphForResolvedTicket(env, {
              ticketId,
              locationId:        ticketLocationId,
              category:          ticketCategory,
              subcategory:       ticketSubcategory,
              featureArea:       null,
              topicSummary:      ticket.title ?? ticket.summary ?? `Support ticket ${ticketCategory}`,
              resolutionSummary: `Ticket marked ${stageBody.stage} by agent`,
              resolvedBy:        'agent',
              kbArticleIds:      [],
            });

            // Also write a resolution event for analytics
            await fetch(`${env.SUPABASE_URL}/rest/v1/support_resolution_events`, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                'Prefer':        'return=minimal',
              },
              body: JSON.stringify({
                location_id:           ticketLocationId,
                ticket_id:             ticketId,
                contact_id:            ticket.ghl_contact_id ?? null,
                resolution_type:       stageBody.stage === 'resolved' ? 'agent_resolved' : 'auto_closed',
                category:              ticketCategory,
                subcategory:           ticketSubcategory,
                resolution_summary:    `Ticket marked ${stageBody.stage}`,
                kb_article_ids_used:   [],
                sop_ids_used:          [],
                ai_response_count:     0,
                agent_intervened:      true,
                resolved_at:           new Date().toISOString(),
                created_at:            new Date().toISOString(),
              }),
            }).catch(e => console.warn('[stage/graph] resolution_event insert failed:', e));

            console.log(`[stage/graph] graph + resolution event written for ticket: ${ticketId}`);
          } catch (graphErr) {
            console.warn('[stage/graph] error (non-fatal):', graphErr instanceof Error ? graphErr.message : String(graphErr));
          }
        })();
      }

      return json({ success: true, ticketId, stage: stageBody.stage }, 200, origin);
    }

    // POST /support/images/upload — proxy image to Supabase Storage
    if (method === 'POST' && path === '/support/images/upload') {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const uploadPath = formData.get('path') as string | null;

      if (!file || !uploadPath) {
        return json({ error: 'file and path required' }, 400, origin);
      }

      if (file.size > 5 * 1024 * 1024) {
        return json({ error: 'file too large' }, 400, origin);
      }

      const arrayBuffer = await file.arrayBuffer();

      const uploadRes = await fetch(
        `${env.SUPABASE_URL}/storage/v1/object/ticket-images/${uploadPath}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type':  file.type,
            'x-upsert':      'true',
          },
          body: arrayBuffer,
        }
      );

      if (!uploadRes.ok) {
        const detail = await uploadRes.text();
        console.error('[uploadImage] storage failed:', uploadRes.status, detail);
        return json({ error: 'upload failed', detail }, 502, origin);
      }

      const publicUrl =
        `${env.SUPABASE_URL}/storage/v1/object/public/ticket-images/${uploadPath}`;

      console.log('[uploadImage] uploaded:', uploadPath);
      return json({ url: publicUrl }, 200, origin);
    }

    return json({ error: 'Not found' }, 404, origin);
    } catch (e) {
      console.error('[worker] unhandled error:', e);
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: {
          'Content-Type':                'application/json',
          'Access-Control-Allow-Origin': req.headers.get('Origin') ?? '*',
        },
      });
    }
  },
};
