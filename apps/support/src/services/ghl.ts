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

  const params = new URLSearchParams();
  if (filters.locationId) params.set('locationId', filters.locationId);
  if (filters.status)     params.set('status', filters.status);
  if (filters.limit != null) params.set('limit', String(filters.limit));

  const query = params.toString() ? `?${params}` : '';
  return workerFetch<Ticket[]>(`/ghl/tickets${query}`);
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
