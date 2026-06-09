#!/usr/bin/env node
// import-brain-seeds.ts
// Reads generated seed JSON and upserts records into Supabase via service role key.
//
// Usage:
//   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx apps/support/scripts/import-brain-seeds.ts
//
// Or with .env file:
//   npx tsx --env-file=.env.local apps/support/scripts/import-brain-seeds.ts
//
// The script inserts in batches of 50 using ON CONFLICT DO UPDATE (idempotent).

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const SEEDS_DIR  = join(__dirname, 'seeds');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL  = process.env['SUPABASE_URL']  ?? 'https://ckbwpsrlphwgkqyimbck.supabase.co';
const SERVICE_KEY   = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const BATCH_SIZE    = 50;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required. Set it as an environment variable.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase upsert helper
// ---------------------------------------------------------------------------
async function upsertBatch(table: string, rows: unknown[]): Promise<{ inserted: number; error: string | null }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => 'unknown');
    return { inserted: 0, error: `HTTP ${res.status}: ${detail.slice(0, 300)}` };
  }

  return { inserted: rows.length, error: null };
}

// ---------------------------------------------------------------------------
// Batch insert
// ---------------------------------------------------------------------------
async function importTable(table: string, seedFile: string): Promise<void> {
  const path = join(SEEDS_DIR, seedFile);

  if (!existsSync(path)) {
    console.warn(`⚠️  Seed file not found: ${path} — skipping`);
    return;
  }

  const records = JSON.parse(readFileSync(path, 'utf-8')) as unknown[];

  if (!Array.isArray(records) || records.length === 0) {
    console.log(`  ${table}: 0 records (seed file is empty)`);
    return;
  }

  let totalInserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { inserted, error } = await upsertBatch(table, batch);

    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error}`);
      errors++;
    } else {
      totalInserted += inserted;
      process.stdout.write(`\r  ${table}: ${totalInserted}/${records.length} inserted...`);
    }
  }

  console.log(`\r  ✓ ${table}: ${totalInserted} records upserted${errors > 0 ? ` (${errors} batch errors)` : ''}`);
}

// ---------------------------------------------------------------------------
// Verify records exist
// ---------------------------------------------------------------------------
async function verifyTable(table: string, expectedMin: number): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1&active=eq.true`,
    {
      headers: {
        'apikey':        SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer':        'count=exact',
      },
    }
  );

  if (!res.ok) {
    console.error(`  ❌ Verify failed for ${table}: HTTP ${res.status}`);
    return;
  }

  const countHeader = res.headers.get('Content-Range') ?? '';
  const match = countHeader.match(/\/(\d+)$/);
  const count = match ? parseInt(match[1], 10) : '?';

  const ok = typeof count === 'number' ? count >= expectedMin : true;
  console.log(`  ${ok ? '✓' : '⚠️ '} ${table}: ${count} active rows (expected >= ${expectedMin})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n🧠 LegacyZero Brain Seed Import');
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   Seeds:    ${SEEDS_DIR}\n`);

  // Check if brain tables exist first
  console.log('📋 Checking tables...');
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/support_knowledge_articles?select=id&limit=1`,
    {
      headers: {
        'apikey':        SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    }
  );

  if (!checkRes.ok) {
    if (checkRes.status === 404 || checkRes.status === 400) {
      console.error('\n❌ Brain tables not found in Supabase.');
      console.error('   Run the migration first:');
      console.error('   supabase/migrations/20260609_brain_foundation.sql');
      console.error('   → Supabase Dashboard → SQL Editor → paste and run\n');
      process.exit(1);
    }
    console.warn(`⚠️  Unexpected status ${checkRes.status} — proceeding anyway`);
  } else {
    console.log('  ✓ Brain tables accessible\n');
  }

  // Import tables
  console.log('📥 Importing seed data...');
  await importTable('support_knowledge_articles', 'support_knowledge_articles.seed.json');
  await importTable('support_sop_chunks',         'support_sop_chunks.seed.json');

  // Verify
  console.log('\n🔍 Verification...');
  await verifyTable('support_knowledge_articles', 1);
  await verifyTable('support_sop_chunks',         1);

  console.log('\n✅ Import complete.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
