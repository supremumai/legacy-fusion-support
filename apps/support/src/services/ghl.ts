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
  contactId: string;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  summary?: string;
}

export async function createTicket(params: CreateTicketParams): Promise<Ticket> {
  if (DEMO_MODE) {
    // Return the first demo ticket as a stand-in for a newly created ticket
    return DEMO_DATA.tickets[0];
  }

  const result = await workerFetch<{ ticketId: string; ghlOpportunityId: string }>(
    '/ghl/tickets/create',
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );

  return getTicket(result.ghlOpportunityId);
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
  status?: TicketStatus;
  limit?: number;
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
  if (filters.status) params.set('status', filters.status);
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
