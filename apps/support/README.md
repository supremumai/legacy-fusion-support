# Legacy Fusion Support System

AI-driven support ticket management built on Cloudflare Workers, Vite, TypeScript, and Supabase.

Two surfaces:
- **Customer chat** (`chat.html`) — magic link login, LegacyZero AI intake, auto ticket creation, real-time message thread
- **Agent control center** (`control.html`) — 3-panel queue + workspace, AI summary card, reply/internal notes, ticket actions (Assign/Escalate/Resolve/Close), GHL pipeline sync

---

## Stack

| Layer | Technology |
|---|---|
| Worker / API proxy | Cloudflare Workers (TypeScript) |
| Frontend | Vite + Vanilla TypeScript |
| Database / Realtime | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth (magic link for customers, email+password for agents) |
| CRM | GoHighLevel (opportunities = tickets, contacts = customers) |
| AI | OpenAI GPT-4o or Anthropic Claude (switchable via env var) |

---

## 1. Supabase Setup

**Project ID:** `ckbwpsrlphwgkqyimbck`

Run all migration blocks in order via **Supabase Dashboard → SQL Editor**.
The full SQL is embedded as comment blocks at the top of `src/services/supabase.ts`.

### Tables

| Table | Purpose |
|---|---|
| `support_messages` | Chat thread messages per ticket |
| `profiles` | User roles and GHL contact mapping |
| `support_tickets` | GHL opportunity status mirror (updated by webhook) |

### Block 1 — `support_messages`
```sql
create table support_messages (
  id          uuid        primary key default gen_random_uuid(),
  ticket_id   text        not null,
  role        text        not null check (role in ('ai', 'client', 'agent')),
  content     text        not null,
  is_internal boolean     default false,
  location_id text        not null default '',
  created_at  timestamptz default now()
);

create index on support_messages(ticket_id, created_at);
alter table support_messages enable row level security;

create policy "agents_by_location" on support_messages
  for all using (
    location_id = current_setting('app.location_id', true)
    and auth.role() = 'authenticated'
  );

create policy "clients_by_location" on support_messages
  for select using (
    location_id = current_setting('app.location_id', true)
    and is_internal = false
  );
```

### Block 2 — `profiles`
```sql
create table profiles (
  id              uuid primary key references auth.users,
  role            text not null default 'client',
  ghl_contact_id  text,
  location_id     text not null default ''
);

alter table profiles enable row level security;

create policy "users_read_own_profile" on profiles
  for select using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'client');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Block 3 — `support_tickets`
```sql
create table support_tickets (
  id                  text primary key,
  ghl_opportunity_id  text unique,
  location_id         text not null,
  status              text not null,
  updated_at          timestamptz default now()
);

alter table support_tickets enable row level security;

create policy "agents_tickets" on support_tickets
  for all using (
    location_id = current_setting('app.location_id', true)
  );
```

### Agent role setup

To grant agent access to a team member, update their profile row:
```sql
update profiles set role = 'agent', location_id = '<your_location_id>'
where id = '<supabase_user_uuid>';
```

---

## 2. Cloudflare Worker — Secrets

Set all secrets via Wrangler CLI before deploying. **Never commit values.**

```bash
wrangler secret put GHL_AGENCY_TOKEN
wrangler secret put GHL_LOCATION_TOKEN
wrangler secret put GHL_LOCATION_ID
wrangler secret put GHL_WEBHOOK_SECRET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPPORT_CORS_ORIGIN
```

| Secret | Description |
|---|---|
| `GHL_AGENCY_TOKEN` | GHL agency-level API token |
| `GHL_LOCATION_TOKEN` | GHL location-level API token (used for all opportunity/contact calls) |
| `GHL_LOCATION_ID` | GHL sub-account location ID |
| `GHL_WEBHOOK_SECRET` | HMAC-SHA256 secret from GHL webhook configuration |
| `SUPABASE_URL` | Supabase project URL (`https://<project-id>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — server-side only, never in Vite bundle |
| `SUPPORT_CORS_ORIGIN` | Allowed browser origin (`https://app.gohighlevel.com` for production) |

### Deploy

```bash
cd apps/support
wrangler publish --env production
```

**Worker URL:** `https://legacy-fusion-support.hector-0b9.workers.dev`

---

## 3. GHL Manual Setup

### a. Create Support Pipeline

In GHL → Pipelines → New Pipeline. Name it `Support`. Add these stages **in order** (names must match exactly — the Worker maps them):

1. `New`
2. `Triaged`
3. `In Progress`
4. `Waiting on Client`
5. `Waiting on Internal`
6. `Resolved`
7. `Closed`
8. `Escalated`

### b. Add Custom Fields on Opportunity

In GHL → Settings → Custom Fields → Opportunities. Create all five:

| Field Key | Type | Options |
|---|---|---|
| `lf_ticket_category` | Dropdown | `technical`, `billing`, `general`, `escalated` |
| `lf_ticket_priority` | Dropdown | `urgent`, `high`, `medium`, `low` |
| `lf_ai_summary` | Textarea | — |
| `lf_sla_deadline` | Date/Time | — |
| `lf_internal_id` | Text | — |

### c. Register GHL Webhook

In GHL → Settings → Webhooks → New Webhook:

| Field | Value |
|---|---|
| **URL** | `https://legacy-fusion-support.hector-0b9.workers.dev/webhooks/ghl` |
| **Event** | `opportunity.stageChange` |
| **Secret** | *(value you set in `GHL_WEBHOOK_SECRET`)* |

### d. Create Custom Menu Items

In GHL → Settings → Custom Menus → New Menu Item:

**Customer Portal:**
| Field | Value |
|---|---|
| Name | `Support` |
| URL | `https://legacy-fusion-support.hector-0b9.workers.dev/chat.html?contactId={{contact.id}}&locationId={{location.id}}` |
| Open in | Iframe |
| Visibility | Contacts only |

**Agent Control Center:**
| Field | Value |
|---|---|
| Name | `Support Center` |
| URL | `https://legacy-fusion-support.hector-0b9.workers.dev/control.html?userId={{user.id}}&locationId={{location.id}}` |
| Open in | Iframe |
| Visibility | Team only (hide from contacts) |

---

## 4. Health Check

After deploying the Worker, verify all connections are live:

```bash
curl https://legacy-fusion-support.hector-0b9.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "project": "legacy-fusion-support",
  "supabase": "connected",
  "ghl": "connected",
  "timestamp": "2026-04-02T20:00:00.000Z"
}
```

- `status: "ok"` — both services connected
- `status: "degraded"` — one or both services unreachable; check the `supabase` / `ghl` fields

---

## 5. Frontend Setup

### Environment Variables

Create `apps/support/.env`:

```env
VITE_SUPPORT_WORKER_URL=https://legacy-fusion-support.hector-0b9.workers.dev
VITE_SUPABASE_URL=https://ckbwpsrlphwgkqyimbck.supabase.co
VITE_SUPABASE_ANON_KEY=<your_supabase_anon_key>
VITE_DEMO_MODE=false
VITE_AI_PROVIDER=openai
VITE_OPENAI_API_KEY=<your_openai_key>
```

### Dev Server

```bash
cd apps/support
npm install
npm run dev
# Opens at http://localhost:5173/chat.html
```

### Production Build

```bash
npm run build
# Output: apps/support/dist/
```

---

## 6. Demo Mode

To test the full UI without live GHL or Supabase connections:

```env
VITE_DEMO_MODE=true
```

Demo mode:
- Skips all auth (auto-loads demo contact identity)
- Returns seeded tickets, contacts, and message threads from `src/services/tickets.ts`
- All Supabase calls are no-ops
- AI responses are mocked with a 400ms delay
- Ticket creation synthesizes a new ticket in memory

---

## Architecture Summary

```
GHL CRM
  ↓ iframe embed
chat.html / control.html (Vite + TS)
  ↓ fetch
Cloudflare Worker (support-proxy.ts)
  ↓ GHL v1 API           ↓ Supabase REST + Realtime
GHL Opportunities     support_messages / profiles / support_tickets

GHL Webhook → POST /webhooks/ghl → Worker → Supabase upsert → Realtime → control.html
```
