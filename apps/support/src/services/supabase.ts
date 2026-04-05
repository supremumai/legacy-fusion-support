/*
 * ===========================================================================
 * MIGRATION SQL — run once in Supabase dashboard (SQL Editor)
 * ===========================================================================
 *
 * Run all blocks below in order.
 *
 * -- Block 1: support_messages
 * create table support_messages (
 *   id          uuid        primary key default gen_random_uuid(),
 *   ticket_id   text        not null,
 *   role        text        not null check (role in ('ai', 'client', 'agent')),
 *   content     text        not null,
 *   is_internal boolean     default false,
 *   created_at  timestamptz default now()
 * );
 *
 * create index on support_messages(ticket_id, created_at);
 *
 * alter table support_messages enable row level security;
 *
 * -- Block 2: profiles (Batch 11c)
 * create table profiles (
 *   id              uuid primary key references auth.users,
 *   role            text not null default 'client',
 *   ghl_contact_id  text,
 *   location_id     text not null default ''
 * );
 *
 * alter table profiles enable row level security;
 *
 * create policy "users_read_own_profile" on profiles
 *   for select using (auth.uid() = id);
 *
 * -- Auto-create profile row on user signup:
 * create or replace function public.handle_new_user()
 * returns trigger language plpgsql security definer as $$
 * begin
 *   insert into public.profiles (id, role)
 *   values (new.id, 'client');
 *   return new;
 * end;
 * $$;
 *
 * create trigger on_auth_user_created
 *   after insert on auth.users
 *   for each row execute procedure public.handle_new_user();
 *
 * -- Block 3: support_tickets table (Batch 13c)
 * create table support_tickets (
 *   id                  text primary key,
 *   ghl_opportunity_id  text unique,
 *   location_id         text not null,
 *   status              text not null,
 *   updated_at          timestamptz default now()
 * );
 *
 * alter table support_tickets enable row level security;
 *
 * create policy "agents_tickets" on support_tickets
 *   for all using (
 *     location_id = current_setting('app.location_id', true)
 *   );
 *
 * -- Block 4: multi-tenant RLS by location_id on support_messages (Batch 12c)
 * -- Add location_id column to support_messages
 * alter table support_messages
 *   add column location_id text not null default '';
 *
 * -- Drop previous coarse-grained policies
 * drop policy if exists "agents_full_access"   on support_messages;
 * drop policy if exists "clients_own_messages" on support_messages;
 *
 * -- Agents: authenticated + matching location
 * create policy "agents_by_location" on support_messages
 *   for all using (
 *     location_id = current_setting('app.location_id', true)
 *     and auth.role() = 'authenticated'
 *   );
 *
 * -- Clients: non-internal + matching location
 * create policy "clients_by_location" on support_messages
 *   for select using (
 *     location_id = current_setting('app.location_id', true)
 *     and is_internal = false
 *   );
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

const DEMO_LOCATION_ID = 'location-demo';

const supabaseUrl = 'https://ckbwpsrlphwgkqyimbck.supabase.co';

const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrYndwc3JscGh3Z2txeWltYmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjc3NjAsImV4cCI6MjA5MDc0Mzc2MH0.JKZ-QoZDRI2dzZjehn3ShWUPpFtLX3b9196n_GDnTBE';

// ---------------------------------------------------------------------------
// Supabase client — stateless, no shared auth context
// ---------------------------------------------------------------------------
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MessageRow {
  id: string;
  ticket_id: string;
  location_id: string;
  role: 'ai' | 'client' | 'agent';
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  role: 'client' | 'agent';
  ghl_contact_id: string | null;
  location_id: string;
}

// ---------------------------------------------------------------------------
// setLocationContext
// Sets the app.location_id session variable required by RLS policies.
// Must be called before every query that hits support_messages.
// Uses set_config via Supabase RPC.
// ---------------------------------------------------------------------------
async function setLocationContext(locationId: string): Promise<void> {
  const { error } = await supabase.rpc('set_config', {
    setting_name: 'app.location_id',
    new_value:    locationId,
    is_local:     true,
  });
  // Log but don't throw — RLS may still allow the operation if the row carries location_id
  if (error) console.warn('[supabase] setLocationContext error (non-fatal):', error.message);
}

// ---------------------------------------------------------------------------
// Auth — getSession
// ---------------------------------------------------------------------------
export async function getSession() {
  if (DEMO_MODE) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ---------------------------------------------------------------------------
// Auth — getProfile
// ---------------------------------------------------------------------------
export async function getProfile(): Promise<UserProfile | null> {
  if (DEMO_MODE) return null;

  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, ghl_contact_id, location_id')
    .eq('id', session.user.id)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

// ---------------------------------------------------------------------------
// Auth — sendMagicLink (customer)
// ---------------------------------------------------------------------------
export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw new Error(`Magic link failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Auth — signInWithPassword (agent)
// ---------------------------------------------------------------------------
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign in failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Auth — signOut
// ---------------------------------------------------------------------------
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

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
// locationId: the GHL location ID from the current user's session context.
// RLS policy enforces isolation — this arg is set as the session config var.
// ---------------------------------------------------------------------------
export async function getMessages(ticketId: string, locationId: string): Promise<Message[]> {
  if (DEMO_MODE) {
    return DEMO_DATA.messages[ticketId] ?? [];
  }

  await setLocationContext(locationId);

  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`getMessages failed: ${error.message}`);
  return (data as MessageRow[]).map(rowToMessage);
}

// ---------------------------------------------------------------------------
// addMessage
// locationId: written to the row and used by the RLS set_config call.
// ---------------------------------------------------------------------------
export async function addMessage(
  ticketId: string,
  role: Message['role'],
  content: string,
  locationId: string,
  isInternal = false
): Promise<Message> {
  console.log('[supabase] addMessage called:', ticketId, role, isInternal);
  console.log('[supabase] IS_DEMO check (locationId):', locationId);

  if (locationId === DEMO_LOCATION_ID) {
    const syntheticMsg: Message = {
      id:         `demo-${Date.now()}`,
      ticketId,
      role,
      content,
      isInternal,
      createdAt:  new Date(),
    };
    if (!DEMO_DATA.messages[ticketId]) DEMO_DATA.messages[ticketId] = [];
    DEMO_DATA.messages[ticketId].push(syntheticMsg);
    return syntheticMsg;
  }

  await setLocationContext(locationId);

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id:   ticketId,
      role,
      content,
      is_internal: isInternal,
      location_id: locationId,
    })
    .select()
    .single();

  if (error) throw new Error(`addMessage failed: ${error.message}`);
  return rowToMessage(data as MessageRow);
}

// ---------------------------------------------------------------------------
// rekeyMessages: update ticket_id on all messages stored under an intake temp ID
// Called after ticket creation to link intake messages to the real opportunity ID
// ---------------------------------------------------------------------------
export async function rekeyMessages(
  oldTicketId: string,
  newTicketId: string,
  locationId:  string
): Promise<void> {
  if (!oldTicketId || !newTicketId || oldTicketId === newTicketId) return;
  if (locationId === 'location-demo') return;

  await setLocationContext(locationId);

  const { error } = await supabase
    .from('support_messages')
    .update({ ticket_id: newTicketId })
    .eq('ticket_id', oldTicketId);

  if (error) {
    console.warn('[supabase] rekeyMessages failed:', error.message);
  } else {
    console.log('[supabase] rekeyMessages:', oldTicketId, '→', newTicketId);
  }
}

// ---------------------------------------------------------------------------
// subscribeToTicketStatus
// Listens for UPDATE events on support_tickets for a given ghl_opportunity_id.
// Used by control.html to sync stage changes pushed by the GHL webhook receiver.
// ---------------------------------------------------------------------------
export interface TicketStatusUpdate {
  ghlOpportunityId: string;
  status: string;
  updatedAt: Date;
}

export function subscribeToTicketStatus(
  ghlOpportunityId: string,
  locationId: string,
  callback: (update: TicketStatusUpdate) => void
): RealtimeChannel {
  if (DEMO_MODE) {
    return { unsubscribe: () => Promise.resolve('ok' as const) } as unknown as RealtimeChannel;
  }

  return supabase
    .channel(`ticket-status:${locationId}:${ghlOpportunityId}`)
    .on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'support_tickets',
        filter: `ghl_opportunity_id=eq.${ghlOpportunityId}`,
      },
      (payload) => {
        const row = payload.new as {
          ghl_opportunity_id: string;
          location_id: string;
          status: string;
          updated_at: string;
        };
        // Secondary location guard (RLS already enforces server-side)
        if (row.location_id !== locationId) return;
        callback({
          ghlOpportunityId: row.ghl_opportunity_id,
          status:           row.status,
          updatedAt:        new Date(row.updated_at),
        });
      }
    )
    .subscribe();
}

// ---------------------------------------------------------------------------
// subscribeToTicket
// locationId scopes the realtime channel filter.
// ---------------------------------------------------------------------------
export function subscribeToTicket(
  ticketId: string,
  locationId: string,
  callback: (message: Message) => void
): RealtimeChannel {
  if (DEMO_MODE) {
    return { unsubscribe: () => Promise.resolve('ok' as const) } as unknown as RealtimeChannel;
  }

  return supabase
    .channel(`ticket:${locationId}:${ticketId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'support_messages',
        // Filter by both ticket_id and location_id for tenant isolation
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => {
        const row = payload.new as MessageRow;
        // Secondary guard: only deliver if location matches
        if (row.location_id === locationId) {
          callback(rowToMessage(row));
        }
      }
    )
    .subscribe();
}
