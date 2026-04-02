/*
 * ===========================================================================
 * MIGRATION SQL — run once in Supabase dashboard (SQL Editor)
 * ===========================================================================
 *
 * create table support_messages (
 *   id         uuid        primary key default gen_random_uuid(),
 *   ticket_id  text        not null,
 *   role       text        not null check (role in ('ai', 'client', 'agent')),
 *   content    text        not null,
 *   is_internal boolean    default false,
 *   created_at timestamptz default now()
 * );
 *
 * create index on support_messages(ticket_id, created_at);
 *
 * alter table support_messages enable row level security;
 *
 * -- Agents (authenticated users) have full access
 * create policy "agents_full_access" on support_messages
 *   for all using (auth.role() = 'authenticated');
 *
 * -- Clients (anonymous) can only read non-internal messages
 * create policy "clients_own_messages" on support_messages
 *   for select using (is_internal = false);
 *
 * ===========================================================================
 */

import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Message } from '../types/ticket';
import { DEMO_DATA } from './tickets';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DEMO_MODE =
  (import.meta as Record<string, unknown> & { env: Record<string, string> }).env
    .VITE_DEMO_MODE === 'true';

// ---------------------------------------------------------------------------
// Database row type (matches support_messages schema)
// ---------------------------------------------------------------------------
interface MessageRow {
  id: string;
  ticket_id: string;
  role: 'ai' | 'client' | 'agent';
  content: string;
  is_internal: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supabase client
// Stateless — instantiated per module load, no shared auth state
// ---------------------------------------------------------------------------
const supabaseUrl = (
  import.meta as Record<string, unknown> & { env: Record<string, string> }
).env.VITE_SUPABASE_URL as string;

const supabaseAnonKey = (
  import.meta as Record<string, unknown> & { env: Record<string, string> }
).env.VITE_SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

// ---------------------------------------------------------------------------
// Row → Message
// ---------------------------------------------------------------------------
function rowToMessage(row: MessageRow): Message {
  return {
    id:         row.id,
    ticketId:   row.ticket_id,
    role:       row.role,
    content:    row.content,
    isInternal: row.is_internal,
    createdAt:  new Date(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// getMessages
// Returns all messages for a ticket, ordered oldest → newest.
// RLS ensures clients only receive non-internal rows.
// ---------------------------------------------------------------------------
export async function getMessages(ticketId: string): Promise<Message[]> {
  if (DEMO_MODE) {
    return DEMO_DATA.messages[ticketId] ?? [];
  }

  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`getMessages failed: ${error.message}`);
  }

  return (data as MessageRow[]).map(rowToMessage);
}

// ---------------------------------------------------------------------------
// addMessage
// Inserts a single message and returns the persisted row.
// ---------------------------------------------------------------------------
export async function addMessage(
  ticketId: string,
  role: Message['role'],
  content: string,
  isInternal = false
): Promise<Message> {
  if (DEMO_MODE) {
    // Return a synthetic message — not persisted in demo mode
    const syntheticMsg: Message = {
      id:         `demo-${Date.now()}`,
      ticketId,
      role,
      content,
      isInternal,
      createdAt:  new Date(),
    };
    // Append to in-memory demo messages so the UI reflects it immediately
    if (!DEMO_DATA.messages[ticketId]) {
      DEMO_DATA.messages[ticketId] = [];
    }
    DEMO_DATA.messages[ticketId].push(syntheticMsg);
    return syntheticMsg;
  }

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id:   ticketId,
      role,
      content,
      is_internal: isInternal,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`addMessage failed: ${error.message}`);
  }

  return rowToMessage(data as MessageRow);
}

// ---------------------------------------------------------------------------
// subscribeToTicket
// Returns a RealtimeChannel subscribed to INSERT events on the given ticket.
// Caller is responsible for calling channel.unsubscribe() on teardown.
//
// In demo mode, returns a no-op mock channel object.
//
// Usage:
//   const channel = subscribeToTicket(ticketId, (msg) => { ... });
//   // on unmount:
//   channel.unsubscribe();
// ---------------------------------------------------------------------------
export function subscribeToTicket(
  ticketId: string,
  callback: (message: Message) => void
): RealtimeChannel {
  if (DEMO_MODE) {
    // Return a minimal no-op object that satisfies the RealtimeChannel interface
    return {
      unsubscribe: () => Promise.resolve('ok' as const),
    } as unknown as RealtimeChannel;
  }

  const channel = supabase
    .channel(`ticket:${ticketId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'support_messages',
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => {
        callback(rowToMessage(payload.new as MessageRow));
      }
    )
    .subscribe();

  return channel;
}
