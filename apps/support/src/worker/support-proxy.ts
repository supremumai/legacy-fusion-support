import type { Ticket, Contact, TicketStatus, TicketCategory, TicketPriority } from '../types/ticket';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
export interface Env {
  GHL_API_KEY: string;
  GHL_PIPELINE_ID: string;
  GHL_LOCATION_ID: string;
  SUPPORT_CORS_ORIGIN: string;
  GHL_WEBHOOK_SECRET: string;
  // Supabase service-role key — used server-side only in the Worker
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ---------------------------------------------------------------------------
// Pipeline stage mapping
// ---------------------------------------------------------------------------
const STAGE_MAP: Record<TicketStatus, string> = {
  new:              'New',
  triaged:          'Triaged',
  in_progress:      'In Progress',
  waiting_client:   'Waiting on Client',
  waiting_internal: 'Waiting on Internal',
  resolved:         'Resolved',
  closed:           'Closed',
  escalated:        'Escalated',
};

// ---------------------------------------------------------------------------
// GHL custom field keys (Opportunity-level)
// ---------------------------------------------------------------------------
const CF = {
  category:   'lf_ticket_category',
  priority:   'lf_ticket_priority',
  aiSummary:  'lf_ai_summary',
  slaDeadline:'lf_sla_deadline',
  internalId: 'lf_internal_id',
} as const;

// ---------------------------------------------------------------------------
// GHL API base
// ---------------------------------------------------------------------------
const GHL_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------
function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function handlePreflight(origin: string): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function json(data: unknown, status = 200, origin = '*'): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
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
    status:           mapStageToStatus(opp.pipelineStageId as string, opp.pipelineStageName as string),
    assignedTo:       (opp.assignedTo as string) ?? undefined,
    slaDeadline:      new Date((cf[CF.slaDeadline] as string) ?? Date.now()),
    createdAt:        new Date(opp.createdAt as string),
    updatedAt:        new Date(opp.updatedAt as string),
  };
}

function mapStageToStatus(stageId: string, stageName: string): TicketStatus {
  // Reverse lookup by name (stage IDs are dynamic per pipeline)
  const entry = Object.entries(STAGE_MAP).find(
    ([, name]) => name.toLowerCase() === (stageName ?? '').toLowerCase()
  );
  return (entry?.[0] as TicketStatus) ?? 'new';
}

function mapContactToContact(c: Record<string, unknown>): Contact {
  const tags = (c.tags as string[]) ?? [];
  return {
    id:              c.id as string,
    ghlContactId:    c.id as string,
    name:            ((c.firstName as string) + ' ' + (c.lastName as string)).trim(),
    email:           c.email as string,
    plan:            (c.customFields as Record<string, string>)?.plan ?? undefined,
    mrr:             undefined,
    memberSince:     c.dateAdded ? new Date(c.dateAdded as string) : undefined,
    pastTicketCount: 0, // enriched separately from Supabase
  };
}

// ---------------------------------------------------------------------------
// Endpoint handlers
// ---------------------------------------------------------------------------

// POST /ghl/tickets/create
async function createTicket(req: Request, env: Env, origin: string): Promise<Response> {
  const body = await req.json<{
    contactId: string;
    title: string;
    category: TicketCategory;
    priority: TicketPriority;
    summary?: string;
  }>();

  const internalId = `T-${Date.now().toString(36).toUpperCase()}`;

  const payload = {
    pipelineId:      env.GHL_PIPELINE_ID,
    locationId:      env.GHL_LOCATION_ID,
    contactId:       body.contactId,
    name:            body.title,
    pipelineStageId: null, // GHL resolves "New" by position; will be set via PATCH if needed
    status:          'open',
    customFields: [
      { key: CF.category,    field_value: body.category },
      { key: CF.priority,    field_value: body.priority },
      { key: CF.aiSummary,   field_value: body.summary ?? '' },
      { key: CF.internalId,  field_value: internalId },
      { key: CF.slaDeadline, field_value: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() },
    ],
  };

  const res = await fetch(`${GHL_BASE}/opportunities/`, {
    method: 'POST',
    headers: ghlHeaders(env.GHL_API_KEY),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'GHL create failed', detail: err }, 502, origin);
  }

  const opp = (await res.json()) as Record<string, unknown>;
  return json({ ticketId: internalId, ghlOpportunityId: opp.id }, 201, origin);
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

  // Fetch pipeline stages to resolve stage ID
  const pipelineRes = await fetch(
    `${GHL_BASE}/opportunities/pipelines/${env.GHL_PIPELINE_ID}?locationId=${env.GHL_LOCATION_ID}`,
    { headers: ghlHeaders(env.GHL_API_KEY) }
  );

  if (!pipelineRes.ok) {
    return json({ error: 'Failed to fetch pipeline stages' }, 502, origin);
  }

  const pipeline = (await pipelineRes.json()) as { stages: Array<{ id: string; name: string }> };
  const stage = pipeline.stages.find(
    (s) => s.name.toLowerCase() === stageName.toLowerCase()
  );

  if (!stage) {
    return json({ error: `Stage not found in pipeline: ${stageName}` }, 404, origin);
  }

  const res = await fetch(`${GHL_BASE}/opportunities/${ghlOpportunityId}`, {
    method: 'PUT',
    headers: ghlHeaders(env.GHL_API_KEY),
    body: JSON.stringify({ pipelineStageId: stage.id }),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'GHL update failed', detail: err }, 502, origin);
  }

  return json({ success: true }, 200, origin);
}

// GET /ghl/tickets/:id
async function getTicket(
  ghlOpportunityId: string,
  env: Env,
  origin: string
): Promise<Response> {
  const [oppRes, ] = await Promise.all([
    fetch(`${GHL_BASE}/opportunities/${ghlOpportunityId}`, {
      headers: ghlHeaders(env.GHL_API_KEY),
    }),
  ]);

  if (!oppRes.ok) {
    return json({ error: 'Opportunity not found' }, 404, origin);
  }

  const opp = (await oppRes.json()) as Record<string, unknown>;
  const ticket = mapOpportunityToTicket(opp);

  // Fetch contact
  const contactRes = await fetch(`${GHL_BASE}/contacts/${opp.contactId}`, {
    headers: ghlHeaders(env.GHL_API_KEY),
  });
  const contact = contactRes.ok
    ? mapContactToContact((await contactRes.json()) as Record<string, unknown>)
    : null;

  return json({ ticket, contact }, 200, origin);
}

// GET /ghl/tickets?status=new&limit=50
async function listTickets(url: URL, env: Env, origin: string): Promise<Response> {
  const statusParam = url.searchParams.get('status') as TicketStatus | null;
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

  const params = new URLSearchParams({
    pipelineId: env.GHL_PIPELINE_ID,
    locationId: env.GHL_LOCATION_ID,
    limit: String(Math.min(limit, 100)),
  });

  if (statusParam && STAGE_MAP[statusParam]) {
    params.set('pipelineStage', STAGE_MAP[statusParam]);
  }

  const res = await fetch(`${GHL_BASE}/opportunities/search?${params}`, {
    headers: ghlHeaders(env.GHL_API_KEY),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'GHL list failed', detail: err }, 502, origin);
  }

  const data = (await res.json()) as { opportunities: Record<string, unknown>[] };
  const tickets: Ticket[] = (data.opportunities ?? []).map(mapOpportunityToTicket);

  return json(tickets, 200, origin);
}

// GET /ghl/contacts/:id
async function getContact(
  ghlContactId: string,
  env: Env,
  origin: string
): Promise<Response> {
  const res = await fetch(`${GHL_BASE}/contacts/${ghlContactId}`, {
    headers: ghlHeaders(env.GHL_API_KEY),
  });

  if (!res.ok) {
    return json({ error: 'Contact not found' }, 404, origin);
  }

  const contact = mapContactToContact((await res.json()) as Record<string, unknown>);
  return json(contact, 200, origin);
}

// ---------------------------------------------------------------------------
// Reverse stage map: GHL stage name → TicketStatus
// ---------------------------------------------------------------------------
const REVERSE_STAGE_MAP: Record<string, TicketStatus> = Object.fromEntries(
  Object.entries(STAGE_MAP).map(([status, name]) => [name.toLowerCase(), status as TicketStatus])
);

function stageNameToStatus(name: string): TicketStatus | null {
  return REVERSE_STAGE_MAP[name.toLowerCase()] ?? null;
}

// ---------------------------------------------------------------------------
// GHL webhook signature validation
// Uses HMAC-SHA256 over the raw request body.
// GHL sends: X-GHL-Signature: sha256=<hex>
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

  // Timing-safe comparison
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Supabase upsert helper (server-side, service-role key)
// Upserts into support_tickets using locationId for RLS context.
// ---------------------------------------------------------------------------
async function upsertTicketStatus(
  ghlOpportunityId: string,
  locationId: string,
  status: TicketStatus,
  env: Env
): Promise<void> {
  // Set RLS session config via Supabase RPC before the upsert
  const setConfigRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/set_config`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        setting_name: 'app.location_id',
        new_value:    locationId,
        is_local:     true,
      }),
    }
  );

  if (!setConfigRes.ok) {
    throw new Error(`set_config failed: ${await setConfigRes.text()}`);
  }

  const upsertRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/support_tickets`,
    {
      method: 'POST',
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
    }
  );

  if (!upsertRes.ok) {
    throw new Error(`Supabase upsert failed: ${await upsertRes.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Webhook handler: POST /webhooks/ghl
// ---------------------------------------------------------------------------
async function handleGHLWebhook(req: Request, env: Env): Promise<Response> {
  // Clone request so we can read body twice (once for sig verification)
  const cloned = req.clone();

  // Validate signature
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

  // Only handle opportunity stage change events
  if (eventType !== 'opportunity.stageChange') {
    return json({ received: true, handled: false, reason: `Unhandled event: ${eventType}` }, 200, '');
  }

  const opportunityId = payload.id as string | undefined;
  const newStageName  = (payload.stage as Record<string, unknown>)?.name as string | undefined;
  const locationId    = payload.locationId as string | undefined;

  if (!opportunityId || !newStageName || !locationId) {
    return json({ error: 'Missing required fields: id, stage.name, locationId' }, 422, '');
  }

  const newStatus = stageNameToStatus(newStageName);
  if (!newStatus) {
    return json({ received: true, handled: false, reason: `Unknown stage name: ${newStageName}` }, 200, '');
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
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const path = url.pathname;

    // CORS origin enforcement
    const requestOrigin = req.headers.get('Origin') ?? '';
    const allowedOrigin = env.SUPPORT_CORS_ORIGIN;

    if (method === 'OPTIONS') {
      // Preflight — only allow from matching origin
      if (requestOrigin !== allowedOrigin) {
        return new Response('Forbidden', { status: 403 });
      }
      return handlePreflight(allowedOrigin);
    }

    if (requestOrigin && requestOrigin !== allowedOrigin) {
      return json({ error: 'Forbidden: origin not allowed' }, 403, '');
    }

    const origin = allowedOrigin;

    // Route: POST /ghl/tickets/create
    if (method === 'POST' && path === '/ghl/tickets/create') {
      return createTicket(req, env, origin);
    }

    // Route: PATCH /ghl/tickets/:id/status
    const statusMatch = path.match(/^\/ghl\/tickets\/([^/]+)\/status$/);
    if (method === 'PATCH' && statusMatch) {
      return updateTicketStatus(statusMatch[1], req, env, origin);
    }

    // Route: GET /ghl/tickets/:id
    const ticketMatch = path.match(/^\/ghl\/tickets\/([^/]+)$/);
    if (method === 'GET' && ticketMatch) {
      return getTicket(ticketMatch[1], env, origin);
    }

    // Route: GET /ghl/tickets (list)
    if (method === 'GET' && path === '/ghl/tickets') {
      return listTickets(url, env, origin);
    }

    // Route: GET /ghl/contacts/:id
    const contactMatch = path.match(/^\/ghl\/contacts\/([^/]+)$/);
    if (method === 'GET' && contactMatch) {
      return getContact(contactMatch[1], env, origin);
    }

    // Route: POST /webhooks/ghl — GHL inbound webhook (no CORS check, signature validated internally)
    if (method === 'POST' && path === '/webhooks/ghl') {
      return handleGHLWebhook(req, env);
    }

    return json({ error: 'Not found' }, 404, origin);
  },
};
