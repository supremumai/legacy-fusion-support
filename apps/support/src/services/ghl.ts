import type { Ticket, Contact, TicketStatus, TicketCategory, TicketPriority } from '../types/ticket';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WORKER_URL = (import.meta as Record<string, unknown> & { env: Record<string, string> }).env
  .VITE_SUPPORT_WORKER_URL as string;

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
    // Demo stub — real data injected in Batch 10
    return null as unknown as Ticket;
  }

  const result = await workerFetch<{ ticketId: string; ghlOpportunityId: string }>(
    '/ghl/tickets/create',
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );

  // Hydrate a minimal Ticket from the create response
  // Full record available via getTicket() if needed immediately after create
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
    return null as unknown as Ticket;
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
    return [];
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
    return null as unknown as Contact;
  }

  return workerFetch<Contact>(`/ghl/contacts/${ghlContactId}`);
}
