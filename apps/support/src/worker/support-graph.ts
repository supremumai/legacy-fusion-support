// support-graph.ts
// LegacyZero knowledge graph helpers — node/edge management and ticket-driven graph updates.
//
// The knowledge graph lives in Supabase tables: support_graph_nodes + support_graph_edges.
// It models relationships between platform concepts (features, triggers, errors, SOPs)
// and links them to approved KB articles for context retrieval.
//
// Phase 1 (current): write path is active (upsert nodes/edges after events).
//                    read path (getGraphInsightsForTicket) returns [] stub.
// Phase 5 (planned): BFS traversal activated in getGraphInsightsForTicket.
//
// All functions are non-fatal: any Supabase error is logged and swallowed.
// Graph failures must NEVER propagate to ticket creation or conversation flows.

import type { Env } from './support-proxy';
import type { GraphInsight } from './support-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNodeInput {
  node_key:    string;
  label:       string;
  node_type:   'feature' | 'concept' | 'error_type' | 'action' |
               'trigger_event' | 'category' | 'subcategory' | 'integration' | 'setting';
  description?: string | null;
  category?:   string | null;
  aliases?:    string[];
  kb_article_ids?: string[];
  sop_ids?:    string[];
  weight?:     number;
  canonical_file_path?: string | null;
}

export interface GraphEdgeInput {
  from_node:     string;
  to_node:       string;
  relationship:  'causes' | 'caused_by' | 'relates_to' | 'requires_config' |
                 'depends_on' | 'common_with' | 'escalates_to' | 'resolves_via' |
                 'subcategory_of' | 'feature_of';
  weight?:       number;
  bidirectional?: boolean;
  description?:  string | null;
}

export interface ResolvedTicketMemory {
  ticketId:          string;
  locationId:        string;
  category:          string;
  subcategory?:      string | null;
  featureArea?:      string | null;
  topicSummary:      string;
  resolutionSummary: string | null;
  resolvedBy:        'agent' | 'ai' | 'unresolved';
  kbArticleIds?:     string[];
}

export interface ApprovedKnowledgeArticle {
  id:           string;
  title:        string;
  category:     string;
  subcategory?: string | null;
  feature_area?: string | null;
  tags:         string[];
}

export interface GraphTicketContext {
  locationId:  string;
  category:    string;
  subcategory?: string | null;
  featureArea?: string | null;
  ticketId:    string;
}

// ---------------------------------------------------------------------------
// Supabase REST helpers
// ---------------------------------------------------------------------------

/** Headers for Supabase service-role writes */
function supabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    'Content-Type':  'application/json',
    'apikey':        serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Prefer':        'return=minimal',
  };
}

/** Upsert headers — resolves on conflict using specified columns */
function supabaseUpsertHeaders(serviceRoleKey: string, conflictCols: string): HeadersInit {
  return {
    'Content-Type':  'application/json',
    'apikey':        serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Prefer':        `resolution=merge-duplicates,return=minimal`,
  };
}

/** Simple Supabase REST POST */
async function supabasePost(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  body: Record<string, unknown>,
  prefer = 'return=minimal'
): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer':        prefer,
    },
    body: JSON.stringify(body),
  });

  const detail = res.ok ? '' : await res.text().catch(() => 'unknown');
  return { ok: res.ok, status: res.status, detail: detail.slice(0, 200) };
}

/** Supabase REST PATCH by filter */
async function supabasePatch(
  supabaseUrl: string,
  serviceRoleKey: string,
  tableWithFilter: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${tableWithFilter}`, {
    method:  'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(body),
  });

  const detail = res.ok ? '' : await res.text().catch(() => 'unknown');
  return { ok: res.ok, status: res.status, detail: detail.slice(0, 200) };
}

/** Fetch a single graph node by node_key */
async function getNodeByKey(
  supabaseUrl: string,
  serviceRoleKey: string,
  nodeKey: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/support_graph_nodes?node_key=eq.${encodeURIComponent(nodeKey)}&limit=1&select=id,node_key,weight,kb_article_ids,aliases`,
    {
      headers: {
        'apikey':        serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept':        'application/json',
      },
    }
  );
  if (!res.ok) return null;
  const rows = await res.json() as Record<string, unknown>[];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// slugify — converts a string to a stable node_key
// lowercase, spaces → hyphens, strip non-alphanumeric except hyphens
// ---------------------------------------------------------------------------
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// ===========================================================================
// upsertGraphNode
//
// INSERT a new node or UPDATE an existing one if node_key already exists.
// On update: increments weight slightly (recency signal), merges aliases,
// merges kb_article_ids, updates description if provided.
// ===========================================================================

export async function upsertGraphNode(
  env: Env,
  node: GraphNodeInput
): Promise<void> {
  try {
    const existing = await getNodeByKey(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, node.node_key);

    if (existing) {
      // Merge aliases and kb_article_ids with existing values
      const existingAliases    = (existing.aliases    as string[]) ?? [];
      const existingKBIds      = (existing.kb_article_ids as string[]) ?? [];
      const mergedAliases      = [...new Set([...existingAliases, ...(node.aliases ?? [])])];
      const mergedKBIds        = [...new Set([...existingKBIds, ...(node.kb_article_ids ?? [])])];
      const updatedWeight      = Math.min(((existing.weight as number) ?? 1.0) + 0.05, 3.0); // cap at 3.0

      const patchResult = await supabasePatch(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        `support_graph_nodes?node_key=eq.${encodeURIComponent(node.node_key)}`,
        {
          ...(node.description ? { description: node.description } : {}),
          aliases:        mergedAliases,
          kb_article_ids: mergedKBIds,
          weight:         updatedWeight,
          updated_at:     new Date().toISOString(),
          ...(node.canonical_file_path ? { canonical_file_path: node.canonical_file_path } : {}),
        }
      );

      if (!patchResult.ok) {
        console.warn(`[graph] upsertGraphNode patch failed: ${node.node_key} | ${patchResult.status} ${patchResult.detail}`);
      } else {
        console.log(`[graph] node updated: ${node.node_key} | weight=${updatedWeight.toFixed(2)}`);
      }
      return;
    }

    // New node — insert
    const insertResult = await supabasePost(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      'support_graph_nodes',
      {
        node_key:            node.node_key,
        label:               node.label,
        node_type:           node.node_type,
        description:         node.description   ?? null,
        category:            node.category       ?? null,
        aliases:             node.aliases        ?? [],
        kb_article_ids:      node.kb_article_ids ?? [],
        sop_ids:             node.sop_ids        ?? [],
        weight:              node.weight         ?? 1.0,
        canonical_file_path: node.canonical_file_path ?? null,
        active:              true,
        created_at:          new Date().toISOString(),
        updated_at:          new Date().toISOString(),
      }
    );

    if (!insertResult.ok) {
      console.warn(`[graph] upsertGraphNode insert failed: ${node.node_key} | ${insertResult.status} ${insertResult.detail}`);
    } else {
      console.log(`[graph] node created: ${node.node_key}`);
    }

  } catch (e) {
    console.warn('[graph] upsertGraphNode error (non-fatal):', node.node_key, e instanceof Error ? e.message : String(e));
  }
}

// ===========================================================================
// createGraphEdge
//
// INSERT a new directed edge between two nodes.
// Skips silently if the edge already exists (UNIQUE constraint on from/to/relationship).
// Also handles the bidirectional flag — if true, creates the reverse edge too.
// ===========================================================================

export async function createGraphEdge(
  env: Env,
  edge: GraphEdgeInput
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const edgeRow = {
      from_node:     edge.from_node,
      to_node:       edge.to_node,
      relationship:  edge.relationship,
      weight:        edge.weight      ?? 1.0,
      bidirectional: edge.bidirectional ?? false,
      description:   edge.description ?? null,
      active:        true,
      created_at:    now,
      updated_at:    now,
    };

    // Use upsert (ON CONFLICT DO NOTHING via merge-duplicates on unique constraint)
    const result = await supabasePost(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      'support_graph_edges',
      edgeRow,
      'resolution=merge-duplicates,return=minimal'
    );

    if (!result.ok && result.status !== 409) {
      console.warn(`[graph] createGraphEdge failed: ${edge.from_node}→${edge.to_node} | ${result.status} ${result.detail}`);
    } else {
      console.log(`[graph] edge: ${edge.from_node} --[${edge.relationship}]--> ${edge.to_node}`);
    }

    // If bidirectional: create the reverse edge too
    if (edge.bidirectional) {
      const reverseRelationship = reverseRel(edge.relationship);
      const reverseRow = {
        ...edgeRow,
        from_node:    edge.to_node,
        to_node:      edge.from_node,
        relationship: reverseRelationship,
      };

      const reverseResult = await supabasePost(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        'support_graph_edges',
        reverseRow,
        'resolution=merge-duplicates,return=minimal'
      );

      if (!reverseResult.ok && reverseResult.status !== 409) {
        console.warn(`[graph] reverse edge failed: ${edge.to_node}→${edge.from_node} | ${reverseResult.status} ${reverseResult.detail}`);
      }
    }

  } catch (e) {
    console.warn('[graph] createGraphEdge error (non-fatal):', edge.from_node, '→', edge.to_node, e instanceof Error ? e.message : String(e));
  }
}

/** Map a relationship to its logical reverse for bidirectional edge creation */
function reverseRel(rel: GraphEdgeInput['relationship']): GraphEdgeInput['relationship'] {
  const map: Partial<Record<GraphEdgeInput['relationship'], GraphEdgeInput['relationship']>> = {
    causes:          'caused_by',
    caused_by:       'causes',
    requires_config: 'feature_of',
    depends_on:      'feature_of',
    subcategory_of:  'feature_of',
    feature_of:      'subcategory_of',
  };
  return map[rel] ?? 'relates_to';
}

// ===========================================================================
// updateGraphForResolvedTicket
//
// Called after a ticket is resolved. Upserts nodes representing:
//   - The support category node
//   - The subcategory node (if present)
//   - The feature area node (if present)
//   - A resolution pattern node (category-level, to track common resolutions)
//
// Creates edges:
//   - subcategory --[subcategory_of]--> category
//   - feature_area --[feature_of]--> subcategory (or category)
//   - resolution_pattern --[resolves_via]--> category
//
// If kbArticleIds are provided, links them to the feature node.
// ===========================================================================

export async function updateGraphForResolvedTicket(
  env: Env,
  memory: ResolvedTicketMemory
): Promise<void> {
  try {
    const category    = memory.category;
    const subcategory = memory.subcategory ?? null;
    const featureArea = memory.featureArea ?? null;

    // Node: category (top-level support domain)
    const categoryKey = `category-${slugify(category)}`;
    await upsertGraphNode(env, {
      node_key:    categoryKey,
      label:       category.charAt(0).toUpperCase() + category.slice(1),
      node_type:   'category',
      category,
      description: `Support category: ${category}`,
    });

    // Node: subcategory
    if (subcategory) {
      const subcategoryKey = `subcategory-${slugify(subcategory)}`;
      await upsertGraphNode(env, {
        node_key:    subcategoryKey,
        label:       subcategory.replace(/_/g, ' '),
        node_type:   'subcategory',
        category,
        description: `Support subcategory: ${subcategory}`,
      });

      // Edge: subcategory → category
      await createGraphEdge(env, {
        from_node:    subcategoryKey,
        to_node:      categoryKey,
        relationship: 'subcategory_of',
        weight:       1.0,
        description:  `${subcategory} is a subcategory of ${category}`,
      });
    }

    // Node: feature area
    if (featureArea) {
      const featureKey   = `feature-${slugify(featureArea)}`;
      const parentKey    = subcategory ? `subcategory-${slugify(subcategory)}` : categoryKey;

      await upsertGraphNode(env, {
        node_key:    featureKey,
        label:       featureArea,
        node_type:   'feature',
        category,
        description: `Platform feature: ${featureArea}`,
        kb_article_ids: memory.kbArticleIds ?? [],
      });

      // Edge: feature → parent (subcategory or category)
      await createGraphEdge(env, {
        from_node:    featureKey,
        to_node:      parentKey,
        relationship: 'feature_of',
        weight:       1.0,
        description:  `${featureArea} belongs to ${subcategory ?? category}`,
      });
    }

    // Node: resolution pattern (tracks what kinds of things get resolved)
    // Only create if the ticket was actually resolved (not unresolved)
    if (memory.resolvedBy !== 'unresolved' && memory.resolutionSummary) {
      const resPatternKey = `resolution-pattern-${slugify(category)}-${slugify(subcategory ?? 'general')}`;
      const targetKey     = featureArea
        ? `feature-${slugify(featureArea)}`
        : subcategory
          ? `subcategory-${slugify(subcategory)}`
          : categoryKey;

      await upsertGraphNode(env, {
        node_key:    resPatternKey,
        label:       `Resolution: ${category} / ${subcategory ?? 'general'}`,
        node_type:   'concept',
        category,
        description: `Common resolution pattern for ${category}/${subcategory ?? 'general'} tickets. Resolved by: ${memory.resolvedBy}.`,
      });

      await createGraphEdge(env, {
        from_node:    resPatternKey,
        to_node:      targetKey,
        relationship: 'resolves_via',
        weight:       1.2,
        description:  `Resolution pattern for ${category} issues`,
      });
    }

    console.log(`[graph] updateGraphForResolvedTicket complete: ${memory.ticketId} | ${category}/${subcategory ?? '—'}`);

  } catch (e) {
    console.warn('[graph] updateGraphForResolvedTicket error (non-fatal):', memory.ticketId, e instanceof Error ? e.message : String(e));
  }
}

// ===========================================================================
// updateGraphForApprovedKnowledge
//
// Called after a KB article is approved and promoted to knowledge_articles.
// Upserts a node representing the KB article itself, and links it to:
//   - Its category node
//   - Its subcategory node (if present)
//   - Its feature area node (if present)
//   - Any nodes that match its tags (if nodes with those keys exist)
//
// Also updates the kb_article_ids array on matched feature/subcategory nodes.
// ===========================================================================

export async function updateGraphForApprovedKnowledge(
  env: Env,
  article: ApprovedKnowledgeArticle
): Promise<void> {
  try {
    const category    = article.category;
    const subcategory = article.subcategory ?? null;
    const featureArea = article.feature_area ?? null;

    // Node: the KB article itself
    const articleKey = `kb-article-${article.id.slice(0, 8)}`;
    await upsertGraphNode(env, {
      node_key:       articleKey,
      label:          article.title,
      node_type:      'concept',
      category,
      description:    `KB Article: ${article.title}`,
      kb_article_ids: [article.id],
      aliases:        article.tags,
    });

    // Ensure category node exists
    const categoryKey = `category-${slugify(category)}`;
    await upsertGraphNode(env, {
      node_key:  categoryKey,
      label:     category.charAt(0).toUpperCase() + category.slice(1),
      node_type: 'category',
      category,
    });

    // Edge: article → category
    await createGraphEdge(env, {
      from_node:    articleKey,
      to_node:      categoryKey,
      relationship: 'subcategory_of',
      weight:       1.0,
      description:  `KB article in ${category} category`,
    });

    // Subcategory node + edge
    if (subcategory) {
      const subcategoryKey = `subcategory-${slugify(subcategory)}`;
      await upsertGraphNode(env, {
        node_key:       subcategoryKey,
        label:          subcategory.replace(/_/g, ' '),
        node_type:      'subcategory',
        category,
        kb_article_ids: [article.id],
      });

      await createGraphEdge(env, {
        from_node:    articleKey,
        to_node:      subcategoryKey,
        relationship: 'subcategory_of',
        weight:       1.2,
        description:  `KB article covers ${subcategory}`,
      });
    }

    // Feature area node + edge + update kb_article_ids on that node
    if (featureArea) {
      const featureKey = `feature-${slugify(featureArea)}`;
      await upsertGraphNode(env, {
        node_key:       featureKey,
        label:          featureArea,
        node_type:      'feature',
        category,
        kb_article_ids: [article.id],
      });

      await createGraphEdge(env, {
        from_node:    featureKey,
        to_node:      articleKey,
        relationship: 'resolves_via',
        weight:       1.5,
        description:  `${featureArea} issues can be resolved via this KB article`,
      });
    }

    // Tag-based node linking: for each tag, check if a graph node with that node_key exists
    // and add the article ID to its kb_article_ids
    for (const tag of (article.tags ?? []).slice(0, 5)) {
      const tagKey = slugify(tag);
      const existing = await getNodeByKey(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, tagKey);
      if (existing) {
        const existingKBIds = (existing.kb_article_ids as string[]) ?? [];
        if (!existingKBIds.includes(article.id)) {
          await supabasePatch(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY,
            `support_graph_nodes?node_key=eq.${encodeURIComponent(tagKey)}`,
            {
              kb_article_ids: [...existingKBIds, article.id],
              updated_at:     new Date().toISOString(),
            }
          );
          console.log(`[graph] linked article ${article.id} to tag node: ${tagKey}`);
        }
      }
    }

    console.log(`[graph] updateGraphForApprovedKnowledge complete: ${article.id} | "${article.title}"`);

  } catch (e) {
    console.warn('[graph] updateGraphForApprovedKnowledge error (non-fatal):', article.id, e instanceof Error ? e.message : String(e));
  }
}

// ===========================================================================
// getGraphInsightsForTicket
//
// Phase 1: Returns [] — graph traversal not yet active.
// Phase 5: Will perform BFS from the category/subcategory/feature nodes to
//          collect related concepts, return top N by weight.
//
// This is the read path used by support-context.ts fetchGraphInsights().
// When Phase 5 activates: remove the early return and implement BFS traversal.
// ===========================================================================

export async function getGraphInsightsForTicket(
  env: Env,
  ticketContext: GraphTicketContext
): Promise<GraphInsight[]> {
  // Phase 1 stub — graph traversal not yet active
  // Phase 5 implementation plan:
  //   1. Resolve start node_keys from category/subcategory/featureArea
  //   2. BFS: fetch edges WHERE from_node IN [start_nodes] AND active=true, depth max 2
  //   3. Accumulate to_node node_keys, fetch their graph_nodes rows
  //   4. Collect and deduplicate kb_article_ids from all visited nodes
  //   5. Return top N GraphInsight objects sorted by weight * edge_weight
  console.log(`[graph] getGraphInsightsForTicket: Phase 1 stub | ${ticketContext.category}/${ticketContext.subcategory ?? '—'}`);
  return [];
}
