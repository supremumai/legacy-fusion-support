import type { Ticket, Contact, TicketStatus, TicketCategory, TicketPriority } from '../types/ticket';
import { DEMO_DATA } from './tickets';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WORKER_URL = 'https://legacy-fusion-support.hector-0b9.workers.dev';

const DEMO_MODE =
  (import.meta as Record<string, unknown> & { env: Record<string, string> }).env
    .VITE_DEMO_MODE === 'true';

// ---------------------------------------------------------------------------
// Base fetch helper
// ---------------------------------------------------------------------------
async function workerFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Worker error ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// createTicket
// ---------------------------------------------------------------------------
export interface CreateTicketParams {
  userId:     string;
  locationId: string;
  userName:   string;
  userEmail:  string;
  title:      string;
  category:   TicketCategory;
  priority:   TicketPriority;
  summary?:   string;
}

export async function createTicket(params: CreateTicketParams): Promise<Ticket> {
  if (DEMO_MODE) {
    // Return the first demo ticket as a stand-in for a newly created ticket
    return DEMO_DATA.tickets[0];
  }

  console.log('[ghl] createTicket params:', JSON.stringify(params));

  const result = await workerFetch<{ ticketId: string; ghlOpportunityId: string }>(
    '/ghl/tickets/create',
    {
      method: 'POST',
      body: JSON.stringify({
        userId:     params.userId,
        locationId: params.locationId,
        userName:   params.userName,
        userEmail:  params.userEmail,
        title:      params.title,
        category:   params.category,
        priority:   params.priority,
        summary:    params.summary,
      }),
    }
  );

  // Return minimal ticket directly — avoid a second GHL fetch that could obscure the real ID
  const ghlId = result.ghlOpportunityId ?? result.ticketId;
  console.log('[ghl] createTicket result — ticketId:', result.ticketId, 'ghlOpportunityId:', ghlId);

  return {
    id:               result.ticketId,
    ghlOpportunityId: ghlId,
    title:            params.title,
    category:         params.category,
    priority:         params.priority,
    status:           'new',
    slaDeadline:      new Date(Date.now() + 48 * 3600000),
    createdAt:        new Date(),
    updatedAt:        new Date(),
  } as Ticket;
}

// ---------------------------------------------------------------------------
// updateTicketStatus
// ---------------------------------------------------------------------------
export async function updateTicketStatus(
  ghlOpportunityId: string,
  status: TicketStatus
): Promise<void> {
  if (DEMO_MODE) {
    // No-op in demo mode — status changes are not persisted
    return;
  }

  await workerFetch<{ success: boolean }>(
    `/ghl/tickets/${ghlOpportunityId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
}

// ---------------------------------------------------------------------------
// updateTicketStage — Supabase-only stage update (drag-and-drop in kanban)
// Does NOT call GHL. TODO: add GHL pipeline sync when scope is granted.
// ---------------------------------------------------------------------------
export async function updateTicketStage(
  ticketId: string,
  stage: string
): Promise<void> {
  if (DEMO_MODE) {
    console.log('[demo] updateTicketStage:', ticketId, stage);
    return;
  }
  await workerFetch<{ success: boolean }>(
    `/support/tickets/${ticketId}/stage`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    }
  );
}

// ---------------------------------------------------------------------------
// fetchTicketStages — returns { [ghlOpportunityId]: pipelineStage } from Supabase
// Used by pipeline board to restore persisted stages on render.
// ---------------------------------------------------------------------------
export async function fetchTicketStages(
  locationId: string
): Promise<Record<string, string>> {
  if (DEMO_MODE) return {};
  const res = await fetch(`${WORKER_URL}/support/tickets/stages?locationId=${encodeURIComponent(locationId)}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    console.error('[fetchTicketStages] failed:', res.status);
    return {};
  }
  const data = await res.json() as { stages: Record<string, string> };
  return data.stages ?? {};
}

// ---------------------------------------------------------------------------
// fetchSupabaseTicket — returns support_tickets row for a given ghl_opportunity_id
// Used to hydrate AI Analysis fields (summary, sla_deadline, priority, category).
// ---------------------------------------------------------------------------
export interface SupabaseTicketRow {
  status:       string;
  summary:      string | null;
  sla_deadline: string | null;
  priority:     string;
  category:     string;
  contact_name: string | null;
}

export async function fetchSupabaseTicket(
  ghlOpportunityId: string
): Promise<SupabaseTicketRow | null> {
  if (DEMO_MODE) return null;
  try {
    const res = await fetch(
      `${WORKER_URL}/support/tickets/${encodeURIComponent(ghlOpportunityId)}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) return null;
    return await res.json() as SupabaseTicketRow;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// getTicket
// ---------------------------------------------------------------------------
export async function getTicket(ghlOpportunityId: string): Promise<Ticket> {
  if (DEMO_MODE) {
    const ticket = DEMO_DATA.tickets.find(t => t.ghlOpportunityId === ghlOpportunityId);
    if (!ticket) throw new Error(`Demo ticket not found: ${ghlOpportunityId}`);
    return ticket;
  }

  const result = await workerFetch<{ ticket: Ticket; contact: Contact | null }>(
    `/ghl/tickets/${ghlOpportunityId}`
  );

  return result.ticket;
}

// ---------------------------------------------------------------------------
// listTickets
// ---------------------------------------------------------------------------
export interface ListTicketsFilters {
  locationId?: string;
  contactId?:  string;
  status?:     TicketStatus;
  limit?:      number;
}

export async function listTickets(filters: ListTicketsFilters = {}): Promise<Ticket[]> {
  if (DEMO_MODE) {
    let tickets = DEMO_DATA.tickets;
    if (filters.status) {
      tickets = tickets.filter(t => t.status === filters.status);
    }
    if (filters.limit != null) {
      tickets = tickets.slice(0, filters.limit);
    }
    return tickets;
  }

  const params = new URLSearchParams({
    locationId: filters.locationId ?? '',
    limit: String(filters.limit ?? 50)
  })

  try {
    return await workerFetch<Ticket[]>(`/support/tickets?${params}`)
  } catch (err) {
    console.error('[listTickets] failed:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// getContact
// ---------------------------------------------------------------------------
export async function getContact(ghlContactId: string): Promise<Contact> {
  if (DEMO_MODE) {
    const contact = DEMO_DATA.contacts[ghlContactId];
    if (!contact) throw new Error(`Demo contact not found: ${ghlContactId}`);
    return contact;
  }

  return workerFetch<Contact>(`/ghl/contacts/${ghlContactId}`);
}

// ---------------------------------------------------------------------------
// getUsers
// ---------------------------------------------------------------------------
export interface GHLUser { id: string; name: string; email: string; }

export async function getUsers(): Promise<GHLUser[]> {
  if (DEMO_MODE) {
    return [
      { id: 'user-lf', name: 'Legacy',   email: 'legacy@legacyfusion.com' },
      { id: 'user-cs', name: 'Cesar',    email: 'cesar@legacyfusion.com'  },
      { id: 'user-an', name: 'Antonio',  email: 'antonio@legacyfusion.com' },
    ];
  }
  const data = await workerFetch<{ users: GHLUser[] }>('/ghl/users');
  return data.users ?? [];
}

// ---------------------------------------------------------------------------
// assignTicket
// ---------------------------------------------------------------------------
export async function assignTicket(ticketId: string, assignedTo: string): Promise<void> {
  if (DEMO_MODE) return;
  await workerFetch<{ success: boolean }>(`/ghl/tickets/${ticketId}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignedTo }),
  });
}

// ---------------------------------------------------------------------------
// saveKnowledgeBase
// ---------------------------------------------------------------------------
export interface KBEntry {
  ticketId:   string;
  locationId: string;
  problem:    string;
  solution:   string;
  category:   string;
  tags?:      string[];
  createdBy?: string;
}

export async function saveKnowledgeBase(entry: KBEntry): Promise<void> {
  if (DEMO_MODE) {
    console.log('[demo] KB entry saved (demo):', entry);
    return;
  }
  await workerFetch<{ success: boolean }>('/kb/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
}

// ---------------------------------------------------------------------------
// createManualTicket
// ---------------------------------------------------------------------------
export interface ManualTicketInput {
  locationId: string
  title: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  businessName?: string
  source?: string
  category?: string
  priority?: string
  summary?: string
  plan?: string
  assignedTo?: string
}

export async function createManualTicket(input: ManualTicketInput): Promise<{ ticketId: string }> {
  const res = await fetch(`${WORKER_URL}/support/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Manual ticket creation failed: ${JSON.stringify(err)}`)
  }
  return res.json()
}
