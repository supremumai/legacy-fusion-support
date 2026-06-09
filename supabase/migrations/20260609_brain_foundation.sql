-- Migration: 20260609_brain_foundation
-- LegacyZero runtime brain foundation — 8 tables
-- Run in Supabase dashboard SQL editor (SQL Editor → New Query)
-- DO NOT modify existing tables: support_tickets, support_messages, profiles, knowledge_base
--
-- Table creation order (dependency-safe):
--   1. support_knowledge_articles
--   2. support_ticket_memories
--   3. support_resolution_events
--   4. support_sop_chunks
--   5. support_graph_nodes
--   6. support_graph_edges  (references graph_nodes.node_key)
--   7. support_ai_evaluations
--   8. support_learning_queue

-- ===========================================================================
-- 1. support_knowledge_articles
--    Approved KB articles queried by LegacyZero at ticket creation and
--    during conversation turns. Global (location_id IS NULL) or
--    location-scoped articles. Agent-approved only — never auto-promoted.
-- ===========================================================================
create table if not exists support_knowledge_articles (
  id                  uuid        primary key default gen_random_uuid(),
  location_id         text,                              -- NULL = global (all locations)
  title               text        not null,
  problem             text        not null,
  solution            text        not null,
  category            text        not null
                        check (category in ('technical','billing','general')),
  subcategory         text,
  feature_area        text,
  tags                text[]      not null default '{}',
  source              text        not null default 'canonical'
                        check (source in ('canonical','agent_approved','ai_suggested')),
  source_ticket_id    text,                              -- originating ticket (no customer data)
  approved_by         text,                              -- agent user_id or 'legacito'
  approved_at         timestamptz,
  canonical_file_path text,                              -- path in legacyzero-brain repo, e.g. knowledge/global/technical/workflow-trigger.md
  canonical_git_commit text,                             -- git commit SHA when last synced from canonical brain
  active              boolean     not null default true,
  retrieval_count     integer     not null default 0,
  helpful_count       integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_ska_category
  on support_knowledge_articles (category);
create index if not exists idx_ska_subcategory
  on support_knowledge_articles (subcategory);
create index if not exists idx_ska_location_id
  on support_knowledge_articles (location_id);
create index if not exists idx_ska_active
  on support_knowledge_articles (active);
create index if not exists idx_ska_source
  on support_knowledge_articles (source);
create index if not exists idx_ska_tags
  on support_knowledge_articles using gin (tags);

alter table support_knowledge_articles enable row level security;

-- Agents and LegacyZero Worker can read articles for their location or global articles
create policy "ska_read_by_location_or_global" on support_knowledge_articles
  for select using (
    location_id = current_setting('app.location_id', true)
    or location_id is null
  );

-- Service role (Worker) has full write access
create policy "ska_service_role_all" on support_knowledge_articles
  for all using (true)
  with check (true);


-- ===========================================================================
-- 2. support_ticket_memories
--    Per-contact support history. Written after each resolved ticket.
--    Injected into LegacyZero context on new tickets from the same contact.
--    Stores summary, not raw conversation — no PII beyond contact reference.
-- ===========================================================================
create table if not exists support_ticket_memories (
  id                    uuid        primary key default gen_random_uuid(),
  location_id           text        not null,
  contact_id            text        not null,            -- GHL contact ID (not email/name)
  ticket_id             text        not null,            -- source support_tickets.id
  topic_summary         text        not null,            -- 1-sentence summary of the issue
  resolution_summary    text,                            -- 1-sentence summary of how it was resolved
  category              text        not null
                          check (category in ('technical','billing','general','escalated')),
  subcategory           text,
  resolved_by           text        not null default 'agent'
                          check (resolved_by in ('agent','ai','unresolved')),
  ticket_created_at     timestamptz not null,
  ticket_resolved_at    timestamptz,
  exported_to_canonical boolean     not null default false,  -- true once synced to legacyzero-brain
  canonical_file_path   text,                                -- path in legacyzero-brain repo if exported
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_stm_contact_id
  on support_ticket_memories (contact_id);
create index if not exists idx_stm_location_contact
  on support_ticket_memories (location_id, contact_id);
create index if not exists idx_stm_category
  on support_ticket_memories (category);
create index if not exists idx_stm_resolved_by
  on support_ticket_memories (resolved_by);

alter table support_ticket_memories enable row level security;

create policy "stm_read_by_location" on support_ticket_memories
  for select using (
    location_id = current_setting('app.location_id', true)
  );

create policy "stm_service_role_all" on support_ticket_memories
  for all using (true)
  with check (true);


-- ===========================================================================
-- 3. support_resolution_events
--    Records of what resolved what. Written after a ticket moves to
--    'resolved' status. Source of truth for the learning pipeline.
--    Used to identify high-value patterns for KB extraction.
-- ===========================================================================
create table if not exists support_resolution_events (
  id                    uuid        primary key default gen_random_uuid(),
  location_id           text        not null,
  ticket_id             text        not null,            -- support_tickets.id
  contact_id            text,                            -- GHL contact ID
  resolution_type       text        not null
                          check (resolution_type in ('ai_resolved','agent_resolved','customer_confirmed','auto_closed')),
  category              text        not null
                          check (category in ('technical','billing','general','escalated')),
  subcategory           text,
  resolution_summary    text        not null,            -- what actually fixed it (no PII)
  kb_article_ids_used   uuid[]      not null default '{}',  -- which KB articles were retrieved for this ticket
  sop_ids_used          text[]      not null default '{}',  -- which SOPs were retrieved
  ai_response_count     integer     not null default 0,  -- how many AI messages were sent before resolution
  agent_intervened      boolean     not null default false,
  resolution_time_minutes integer,                       -- minutes from ticket creation to resolution
  resolved_at           timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index if not exists idx_sre_ticket_id
  on support_resolution_events (ticket_id);
create index if not exists idx_sre_location_id
  on support_resolution_events (location_id);
create index if not exists idx_sre_category
  on support_resolution_events (category);
create index if not exists idx_sre_resolution_type
  on support_resolution_events (resolution_type);
create index if not exists idx_sre_resolved_at
  on support_resolution_events (resolved_at);
create index if not exists idx_sre_kb_articles_used
  on support_resolution_events using gin (kb_article_ids_used);

alter table support_resolution_events enable row level security;

create policy "sre_read_by_location" on support_resolution_events
  for select using (
    location_id = current_setting('app.location_id', true)
  );

create policy "sre_service_role_all" on support_resolution_events
  for all using (true)
  with check (true);


-- ===========================================================================
-- 4. support_sop_chunks
--    Chunked sections of Standard Operating Procedures.
--    Global (no location_id) — SOPs apply to all agents.
--    Audience: 'agent', 'ai', or 'both'.
--    Injected into agent summary and LegacyZero context by category.
-- ===========================================================================
create table if not exists support_sop_chunks (
  id                  uuid        primary key default gen_random_uuid(),
  sop_id              text        not null,              -- parent SOP key, e.g. 'billing-refund-request'
  sop_title           text        not null,
  chunk_index         integer     not null,              -- order within parent SOP, 0-indexed
  chunk_title         text,                              -- optional section heading
  content             text        not null,
  category            text        not null
                        check (category in ('technical','billing','general','escalated')),
  subcategory         text,
  tags                text[]      not null default '{}',
  audience            text        not null default 'both'
                        check (audience in ('agent','ai','both')),
  source_file         text,                              -- path in legacyzero-brain, e.g. sops/billing/refund-request.md
  canonical_file_path text,                              -- canonical brain repo path (may differ from source_file)
  version             integer     not null default 1,
  active              boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists idx_ssc_sop_id_chunk_index
  on support_sop_chunks (sop_id, chunk_index);
create index if not exists idx_ssc_sop_id
  on support_sop_chunks (sop_id);
create index if not exists idx_ssc_category
  on support_sop_chunks (category);
create index if not exists idx_ssc_audience
  on support_sop_chunks (audience);
create index if not exists idx_ssc_active
  on support_sop_chunks (active);
create index if not exists idx_ssc_tags
  on support_sop_chunks using gin (tags);

alter table support_sop_chunks enable row level security;

-- SOPs are global — all authenticated users can read active chunks
create policy "ssc_read_active" on support_sop_chunks
  for select using (active = true);

create policy "ssc_service_role_all" on support_sop_chunks
  for all using (true)
  with check (true);


-- ===========================================================================
-- 5. support_graph_nodes
--    Nodes in the LegacyZero support knowledge graph.
--    Represent platform features, concepts, error types, events.
--    Global — no location_id.
-- ===========================================================================
create table if not exists support_graph_nodes (
  id                  uuid        primary key default gen_random_uuid(),
  node_key            text        not null unique,       -- stable machine-readable key, e.g. 'workflow-trigger'
  label               text        not null,              -- human-readable, e.g. 'Workflow Trigger'
  node_type           text        not null
                        check (node_type in (
                          'feature','concept','error_type','action',
                          'trigger_event','category','subcategory','integration','setting'
                        )),
  description         text,
  category            text
                        check (category in ('technical','billing','general',null)),
  aliases             text[]      not null default '{}', -- customer language variants
  kb_article_ids      uuid[]      not null default '{}', -- direct links to knowledge_articles
  sop_ids             text[]      not null default '{}', -- direct links to sop_chunks.sop_id
  weight              float       not null default 1.0,
  canonical_file_path text,                              -- path in legacyzero-brain repo if managed there
  active              boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists idx_sgn_node_key
  on support_graph_nodes (node_key);
create index if not exists idx_sgn_node_type
  on support_graph_nodes (node_type);
create index if not exists idx_sgn_category
  on support_graph_nodes (category);
create index if not exists idx_sgn_active
  on support_graph_nodes (active);
create index if not exists idx_sgn_aliases
  on support_graph_nodes using gin (aliases);
create index if not exists idx_sgn_kb_article_ids
  on support_graph_nodes using gin (kb_article_ids);

alter table support_graph_nodes enable row level security;

create policy "sgn_read_active" on support_graph_nodes
  for select using (active = true);

create policy "sgn_service_role_all" on support_graph_nodes
  for all using (true)
  with check (true);


-- ===========================================================================
-- 6. support_graph_edges
--    Directed relationships between graph nodes.
--    Used for BFS traversal to find related KB articles from a starting concept.
--    Global — no location_id.
-- ===========================================================================
create table if not exists support_graph_edges (
  id              uuid        primary key default gen_random_uuid(),
  from_node       text        not null references support_graph_nodes(node_key) on delete cascade,
  to_node         text        not null references support_graph_nodes(node_key) on delete cascade,
  relationship    text        not null
                    check (relationship in (
                      'causes','caused_by','relates_to','requires_config',
                      'depends_on','common_with','escalates_to','resolves_via',
                      'subcategory_of','feature_of'
                    )),
  weight          float       not null default 1.0,
  bidirectional   boolean     not null default false,
  description     text,
  active          boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- no self-loops, no duplicate (from, to, relationship) triplets
  constraint no_self_loop check (from_node <> to_node),
  constraint unique_edge   unique (from_node, to_node, relationship)
);

create index if not exists idx_sge_from_node
  on support_graph_edges (from_node);
create index if not exists idx_sge_to_node
  on support_graph_edges (to_node);
create index if not exists idx_sge_relationship
  on support_graph_edges (relationship);
create index if not exists idx_sge_active
  on support_graph_edges (active);
create index if not exists idx_sge_from_to
  on support_graph_edges (from_node, to_node);

alter table support_graph_edges enable row level security;

create policy "sge_read_active" on support_graph_edges
  for select using (active = true);

create policy "sge_service_role_all" on support_graph_edges
  for all using (true)
  with check (true);


-- ===========================================================================
-- 7. support_ai_evaluations
--    LegacyZero self-grading after each response.
--    Written by the Worker after /ai/chat returns.
--    Used for quality tracking and identifying low-confidence resolutions.
-- ===========================================================================
create table if not exists support_ai_evaluations (
  id                    uuid        primary key default gen_random_uuid(),
  location_id           text        not null,
  ticket_id             text        not null,            -- support_tickets.id
  message_id            uuid,                            -- support_messages.id of the AI response graded
  turn_index            integer     not null default 0,  -- which conversation turn this is (0-indexed)
  model                 text        not null,            -- e.g. 'claude-haiku-4-5-20251001'
  response_text         text        not null,            -- the AI response being evaluated (truncated at 1000 chars)
  accuracy_score        float,                           -- 0.0–1.0 — was the response correct?
  completeness_score    float,                           -- 0.0–1.0 — did it fully address the issue?
  tone_score            float,                           -- 0.0–1.0 — appropriate tone for customer state?
  escalation_correct    boolean,                         -- did the escalation decision match the trigger rules?
  overall_score         float,                           -- computed average of above scores
  kb_articles_used      uuid[]      not null default '{}',  -- which KB articles were injected for this turn
  flagged_for_review    boolean     not null default false,  -- true if overall_score < 0.6
  review_reason         text,                            -- why flagged
  created_at            timestamptz not null default now()
);

create index if not exists idx_sae_ticket_id
  on support_ai_evaluations (ticket_id);
create index if not exists idx_sae_location_id
  on support_ai_evaluations (location_id);
create index if not exists idx_sae_overall_score
  on support_ai_evaluations (overall_score);
create index if not exists idx_sae_flagged
  on support_ai_evaluations (flagged_for_review);
create index if not exists idx_sae_created_at
  on support_ai_evaluations (created_at);
create index if not exists idx_sae_kb_articles_used
  on support_ai_evaluations using gin (kb_articles_used);

alter table support_ai_evaluations enable row level security;

create policy "sae_read_by_location" on support_ai_evaluations
  for select using (
    location_id = current_setting('app.location_id', true)
  );

create policy "sae_service_role_all" on support_ai_evaluations
  for all using (true)
  with check (true);


-- ===========================================================================
-- 8. support_learning_queue
--    Pending knowledge candidates awaiting agent review.
--    Written by the Worker after a resolution event is evaluated as learnable.
--    Read by the Learning Queue UI panel in control.html.
--    Agent approves or rejects — Worker then promotes to knowledge_articles.
--    NEVER auto-promoted without human approval.
-- ===========================================================================
create table if not exists support_learning_queue (
  id                    uuid        primary key default gen_random_uuid(),
  location_id           text        not null,
  ticket_id             text        not null,            -- source support_tickets.id
  source_type           text        not null default 'resolution_event'
                          check (source_type in ('resolution_event','agent_flagged','ai_suggested')),
  suggested_title       text        not null,
  suggested_problem     text        not null,
  suggested_solution    text        not null,
  category              text        not null
                          check (category in ('technical','billing','general')),
  subcategory           text,
  suggested_tags        text[]      not null default '{}',
  ai_confidence         float       not null default 0.0,   -- from learning suggestion prompt
  status                text        not null default 'pending'
                          check (status in ('pending','approved','rejected','low_confidence')),
  reviewed_by           text,                               -- agent user_id who reviewed
  reviewed_at           timestamptz,
  rejection_reason      text,                               -- required if status = 'rejected'
  promoted_article_id   uuid,                               -- knowledge_articles.id if approved + promoted
  exported_to_canonical boolean     not null default false, -- true after Legacito commits to canonical brain
  canonical_file_path   text,                               -- path in legacyzero-brain repo once exported
  canonical_git_commit  text,                               -- git SHA of the canonical brain commit
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_slq_location_id
  on support_learning_queue (location_id);
create index if not exists idx_slq_status
  on support_learning_queue (status);
create index if not exists idx_slq_ticket_id
  on support_learning_queue (ticket_id);
create index if not exists idx_slq_category
  on support_learning_queue (category);
create index if not exists idx_slq_created_at
  on support_learning_queue (created_at);
create index if not exists idx_slq_ai_confidence
  on support_learning_queue (ai_confidence);
create index if not exists idx_slq_exported
  on support_learning_queue (exported_to_canonical);
create index if not exists idx_slq_suggested_tags
  on support_learning_queue using gin (suggested_tags);

alter table support_learning_queue enable row level security;

-- Agents see their location's queue
create policy "slq_read_by_location" on support_learning_queue
  for select using (
    location_id = current_setting('app.location_id', true)
  );

-- Agents can update (approve/reject) their location's items
create policy "slq_update_by_location" on support_learning_queue
  for update using (
    location_id = current_setting('app.location_id', true)
  );

-- Service role full access (Worker inserts, promotes, exports)
create policy "slq_service_role_all" on support_learning_queue
  for all using (true)
  with check (true);


-- ===========================================================================
-- Verification queries (run manually after migration to confirm success)
-- ===========================================================================
--
-- select count(*) from support_knowledge_articles;  -- expect 0
-- select count(*) from support_ticket_memories;     -- expect 0
-- select count(*) from support_resolution_events;   -- expect 0
-- select count(*) from support_sop_chunks;          -- expect 0
-- select count(*) from support_graph_nodes;         -- expect 0
-- select count(*) from support_graph_edges;         -- expect 0
-- select count(*) from support_ai_evaluations;      -- expect 0
-- select count(*) from support_learning_queue;      -- expect 0
--
-- select tablename from pg_tables
-- where schemaname = 'public'
-- and tablename like 'support_%'
-- order by tablename;
-- expect 12 rows (4 existing + 8 new)
