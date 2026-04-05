import type { Ticket, Contact, TicketStatus, TicketCategory, TicketPriority } from '../types/ticket';

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
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

// POST /ghl/tickets/create
async function createTicket(req: Request, env: Env, origin: string): Promise<Response> {
  const body = await req.json<{
    userId:     string;
    locationId: string;
    userName:   string;
    userEmail:  string;
    title:      string;
    category:   TicketCategory;
    priority:   TicketPriority;
    summary?:   string;
  }>();

  // Step 1 — search for existing contact by email
  let contactId = '';
  const searchParams = new URLSearchParams({
    locationId: env.GHL_LOCATION_ID,
    query:      body.userEmail,
  });
  console.log('[createTicket] params:', { userId: body.userId, locationId: body.locationId, userName: body.userName, userEmail: body.userEmail, title: body.title, category: body.category, priority: body.priority });
  console.log('[createTicket] step1 search query:', body.userEmail);

  const searchRes  = await fetch(`${GHL_V2_BASE}/contacts/?${searchParams}`, {
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
  });
  const searchText = await searchRes.text();
  console.log('[createTicket] step1 search status:', searchRes.status);
  console.log('[createTicket] step1 search body:', searchText.slice(0, 500));

  if (!searchRes.ok) {
    return json({ error: 'GHL contact search failed', status: searchRes.status, detail: searchText }, 502, origin);
  }

  const searchData = JSON.parse(searchText) as { contacts?: Array<{ id: string }> };
  if (searchData.contacts && searchData.contacts.length > 0) {
    contactId = searchData.contacts[0].id;
    console.log('[createTicket] found existing contact:', contactId);
  }

  // Step 2 — create contact if not found
  if (!contactId) {
    const createPayload = {
      locationId: env.GHL_LOCATION_ID,
      name:       body.userName,
      email:      body.userEmail,
    };
    console.log('[createTicket] step2 creating contact:', JSON.stringify(createPayload));

    const createRes  = await fetch(`${GHL_V2_BASE}/contacts/`, {
      method:  'POST',
      headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
      body:    JSON.stringify(createPayload),
    });
    const createText = await createRes.text();
    console.log('[createTicket] step2 create status:', createRes.status);
    console.log('[createTicket] step2 create body:', createText.slice(0, 500));

    if (!createRes.ok) {
      return json({ error: 'GHL contact creation failed', status: createRes.status, detail: createText }, 502, origin);
    }

    const createData = JSON.parse(createText) as { contact?: { id: string }; id?: string };
    contactId = createData.contact?.id ?? createData.id ?? '';
    console.log('[createTicket] step2 resolved contactId:', contactId);

    if (!contactId) {
      return json({ error: 'GHL contact creation returned no ID', detail: createText }, 502, origin);
    }
  }

  // Step 3 — create the opportunity
  const internalId = `T-${Date.now().toString(36).toUpperCase()}`;
  const oppPayload = {
    pipelineId:      env.GHL_PIPELINE_ID,
    locationId:      env.GHL_LOCATION_ID,
    name:            body.title,
    pipelineStageId: null,
    status:          'open',
    contactId,
    monetaryValue:   0,
    customFields: [
      { key: 'lf_ticket_category', field_value: body.category ?? 'general' },
      { key: 'lf_ticket_priority', field_value: body.priority ?? 'medium' },
      { key: 'lf_ai_summary',      field_value: body.summary  ?? '' },
    ],
  };

  console.log('[createTicket] step3 opportunity payload:', JSON.stringify(oppPayload));

  const oppRes  = await fetch(`${GHL_V2_BASE}/opportunities/`, {
    method:  'POST',
    headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
    body:    JSON.stringify(oppPayload),
  });

  console.log('[createTicket] step3 opp status:', oppRes.status);
  const oppText = await oppRes.text();
  console.log('[createTicket] step3 opp body:', oppText.slice(0, 500));

  if (!oppRes.ok) {
    return json({ error: 'GHL opportunity creation failed', status: oppRes.status, detail: oppText }, 502, origin);
  }

  const oppData = JSON.parse(oppText) as Record<string, unknown>;
  console.log('[createTicket] opp response:', JSON.stringify(oppData).slice(0, 300));
  const oppInner = (oppData.opportunity ?? oppData) as Record<string, unknown>;
  const ghlOpportunityId = (oppInner?.id ?? null) as string | null;
  console.log('[createTicket] real GHL opp ID:', ghlOpportunityId);
  if (!ghlOpportunityId) {
    console.error('[createTicket] no GHL opportunity ID in response — using fallback');
    return json({ ticketId: internalId, ghlOpportunityId: internalId }, 201, origin);
  }

  // Notify agent via GHL SMS (fire-and-forget — never fail the ticket creation)
  const agentContactId = env.GHL_AGENT_CONTACT_ID ?? '';
  if (agentContactId) {
    const notifyPayload = {
      type:      'SMS',
      contactId: agentContactId,
      message:   `New support ticket: ${body.title}\nCategory: ${body.category ?? 'general'}\nPriority: ${body.priority ?? 'medium'}\nSummary: ${body.summary ?? ''}`,
    };
    fetch(`${GHL_V2_BASE}/conversations/messages`, {
      method:  'POST',
      headers: ghlHeaders(env.GHL_LOCATION_TOKEN),
      body:    JSON.stringify(notifyPayload),
    })
      .then(r => console.log('[notify] agent notification sent, status:', r.status))
      .catch(e => console.error('[notify] agent notification error:', e instanceof Error ? e.message : String(e)));
  } else {
    console.log('[notify] GHL_AGENT_CONTACT_ID not set — skipping agent notification');
  }

  return json({ ticketId: internalId, ghlOpportunityId }, 201, origin);
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

  // GHL v2: PUT /opportunities/:id
  const updatePayload = { pipelineStageId: stageId, status: 'open' };
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
// Routes Anthropic calls server-side — keeps ANTHROPIC_API_KEY out of the browser.
// ---------------------------------------------------------------------------
async function handleAIChat(req: Request, env: Env, origin: string): Promise<Response> {
  console.log('[ai/chat] received request');
  console.log('[ai/chat] ANTHROPIC_API_KEY bound:', !!env.ANTHROPIC_API_KEY);

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not bound' }, 503, origin);
  }

  let body: { messages: Array<{ role: string; content: string }>; systemPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  const { messages, systemPrompt } = body;
  console.log('[ai/chat] messages count:', messages?.length);

  if (!messages || !systemPrompt) {
    return json({ error: 'messages and systemPrompt are required' }, 400, origin);
  }

  // Enforce clean plain-text conversation style — prepended to whatever the client sends
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

`;
  const effectiveSystemPrompt = CONVERSATION_STYLE_PREFIX + systemPrompt;

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages array must be non-empty' }, 400, origin);
  }

  try {
    // Normalize roles: 'ai' → 'assistant', anything else non-user → 'user'
    // Filter to only 'user' | 'assistant', then deduplicate consecutive same roles
    const normalized = messages
      .map((m: { role: string; content: string }) => ({
        role:    m.role === 'assistant' || m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      }))
      .filter((m, i, arr) => i === 0 || m.role !== arr[i - 1].role);

    // Anthropic requires at least one message and must start with 'user'
    const finalMessages = normalized.length > 0 && normalized[0].role === 'user'
      ? normalized
      : [{ role: 'user', content: 'Hello' }, ...normalized];

    const requestBody = {
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     effectiveSystemPrompt,
      messages:   finalMessages,
    };

    console.log('[ai/chat] request body:', JSON.stringify(requestBody).slice(0, 300));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
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
      return json({ response: '', error: 'empty content from Anthropic' }, 200, origin);
    }

    // Strip markdown formatting before returning to client
    const text = rawText
      .replace(/#{1,6}\s/g, '')            // remove headers (## Heading)
      .replace(/\*\*(.*?)\*\*/g, '$1')     // remove bold (**text**)
      .replace(/\*(.*?)\*/g, '$1')         // remove italic (*text*)
      .replace(/^\s*[-•]\s/gm, '')         // remove bullet points
      .trim();

    return json({ response: text }, 200, origin);

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

  return json({ received: true, handled: true, opportunityId, newStatus }, 200, '');
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
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
    const requestOrigin = req.headers.get('Origin') ?? '';
    const allowedOrigin = env.SUPPORT_CORS_ORIGIN;

    if (method === 'OPTIONS') {
      if (requestOrigin !== allowedOrigin) return new Response('Forbidden', { status: 403 });
      return handlePreflight(allowedOrigin);
    }

    if (requestOrigin && requestOrigin !== allowedOrigin) {
      return json({ error: 'Forbidden: origin not allowed' }, 403, '');
    }

    const origin = allowedOrigin;

    if (method === 'POST' && path === '/ai/chat') {
      return handleAIChat(req, env, origin);
    }

    if (method === 'POST' && path === '/ghl/tickets/create') {
      return createTicket(req, env, origin);
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

    return json({ error: 'Not found' }, 404, origin);
  },
};
