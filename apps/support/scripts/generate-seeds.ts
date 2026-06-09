#!/usr/bin/env node
// generate-seeds.ts
// Reads legacyzero-brain canonical files and generates seed JSON for Supabase import.
// Run: npx tsx apps/support/scripts/generate-seeds.ts
// Output: apps/support/scripts/seeds/support_knowledge_articles.seed.json
//         apps/support/scripts/seeds/support_sop_chunks.seed.json

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const BRAIN_DIR  = join(__dirname, '../../../../projects/legacyzero-brain');
const SEEDS_OUT  = join(__dirname, 'seeds');

if (!existsSync(SEEDS_OUT)) mkdirSync(SEEDS_OUT, { recursive: true });

const now = new Date().toISOString();

// ===========================================================================
// KNOWLEDGE ARTICLES — derived from common-issues.md and sops/
// Each top-level issue in common-issues.md becomes one KB article.
// ===========================================================================

const knowledgeArticles = [
  // From common-issues.md issue #1
  {
    id: randomUUID(),
    location_id: null,
    title: 'Workflow Not Triggering on Contact or Form Submission',
    problem: 'A workflow is configured but does not run when expected. Contacts enter the system but no emails, SMS, or actions fire.',
    solution: `1. Open Automations → find the workflow → confirm status shows Active (not Draft or Paused).
2. Check the trigger type — "Form Submitted" and "Contact Created" are different events. Select the one that matches how contacts enter.
3. Review trigger filters — tag or field filters silently exclude contacts. Temporarily remove all filters and test.
4. Check the contact record → Workflows tab → see if the contact is enrolled but stuck in a Wait step.
5. Enable "Allow Re-enrollment" in trigger settings if the contact has already completed this workflow before.
6. Test by manually enrolling a contact via Contacts → Add to Workflow.`,
    category: 'technical',
    subcategory: 'automation_workflows',
    feature_area: 'Workflows',
    tags: ['workflow', 'automation', 'trigger', 'not-firing', 'draft'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'sops/automations/workflow-not-firing.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From common-issues.md issue #2
  {
    id: randomUUID(),
    location_id: null,
    title: 'Emails Going to Spam or Not Being Delivered',
    problem: 'Automated or campaign emails are not reaching contacts, or are landing in spam folders instead of the inbox.',
    solution: `1. Go to Settings → Email Services → verify a custom sending domain is configured.
2. If using the default GHL domain, switch to a custom domain for better deliverability.
3. For custom domains: use MXToolbox to verify SPF, DKIM, and DMARC records are correctly configured at your domain registrar.
4. Review email content — remove excessive caps, overly salesy phrases, and too many links.
5. Clean your contact list of invalid or bounced email addresses.
6. Send a test email to yourself to check spam folder placement.`,
    category: 'technical',
    subcategory: 'automation_workflows',
    feature_area: 'Email Sending Domain',
    tags: ['email', 'spam', 'deliverability', 'spf', 'dkim', 'sending-domain'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'support/common-issues.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From common-issues.md issue #3
  {
    id: randomUUID(),
    location_id: null,
    title: 'SMS Messages Not Being Delivered',
    problem: 'SMS messages set up in workflows or sent manually are not reaching contacts.',
    solution: `1. Go to Settings → Phone Numbers → confirm an active number is configured on the location.
2. Check the contact's phone number — must be a mobile number (landlines cannot receive SMS).
3. Check the contact's DNC (Do Not Contact) status and SMS opt-out status on the contact record.
4. For bulk US campaigns: check A2P 10DLC registration status in Settings → Phone Numbers. Unregistered campaigns are blocked by carriers.
5. Check SMS credit balance in Settings → Billing.
6. Test by manually sending an SMS to the contact from the Conversations inbox.`,
    category: 'technical',
    subcategory: 'automation_workflows',
    feature_area: 'SMS',
    tags: ['sms', 'not-sending', 'dnc', 'a2p', 'phone-number', 'opt-out'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'support/common-issues.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From common-issues.md issue #4
  {
    id: randomUUID(),
    location_id: null,
    title: 'Contacts Missing After CSV Import',
    problem: 'A CSV contact import completed but some or all contacts are not visible in the contacts list.',
    solution: `1. Go to Contacts → Import History to check status and download the error report.
2. The error report shows which rows failed and why (common: missing required field, duplicate email).
3. If import is recent (under 15 minutes): wait and refresh — large imports take time to process.
4. Search for a specific contact by email to rule out a Smart List filter hiding contacts.
5. Verify CSV column headers match GHL's expected format: First Name, Last Name, Email, Phone.
6. Confirm you are in the correct location/sub-account.`,
    category: 'technical',
    subcategory: 'pipeline_crm',
    feature_area: 'Contacts',
    tags: ['import', 'contacts', 'csv', 'missing', 'not-showing'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'support/common-issues.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From common-issues.md issue #5
  {
    id: randomUUID(),
    location_id: null,
    title: 'Calendar Shows No Available Booking Times',
    problem: 'The calendar booking link shows no available time slots, preventing customers from booking appointments.',
    solution: `1. Open Calendars → find the calendar → click Edit → go to Available Hours section.
2. Confirm at least one working day is selected and working hours are set (e.g., Mon–Fri, 9 AM–5 PM).
3. Check the assigned team member has availability configured in their user profile.
4. Try the booking link with a date 2–4 weeks in the future to rule out near-term slots being filled.
5. If Google Calendar sync is enabled: check if personal events in Google Calendar are blocking all available slots. Re-authorize sync if needed: Settings → Integrations → Google Calendar.
6. Confirm the calendar timezone is correct in Calendar settings.`,
    category: 'technical',
    subcategory: 'website_funnels',
    feature_area: 'Calendar',
    tags: ['calendar', 'booking', 'no-availability', 'slots', 'google-sync'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'sops/calendars/booking-not-showing.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From common-issues.md issue #6
  {
    id: randomUUID(),
    location_id: null,
    title: 'Form Not Submitting or Not Creating Contacts',
    problem: 'A lead capture form does not submit, shows an error when submitted, or successfully submits but does not create a contact in the CRM.',
    solution: `1. Open the form builder → confirm the form status is Published (not Draft).
2. Test the form in an incognito browser window to rule out login session or extension conflicts.
3. Temporarily disable reCAPTCHA in form settings and test again.
4. Look for hidden required fields in conditional logic that may be blocking submission.
5. If embedded on an external site: re-copy the embed code from GHL and replace the old version.
6. Search for a specific contact by email — the contact may exist but be filtered out of the main contacts view.`,
    category: 'technical',
    subcategory: 'website_funnels',
    feature_area: 'Forms',
    tags: ['form', 'not-submitting', 'lead-capture', 'contact-not-created', 'recaptcha'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'support/common-issues.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From common-issues.md issue #7
  {
    id: randomUUID(),
    location_id: null,
    title: 'Pipeline Stage Not Saving or Reverting After Change',
    problem: 'Dragging an opportunity to a new pipeline stage does not save, or the stage reverts back after being manually changed.',
    solution: `1. Hard refresh the browser (Ctrl+Shift+R) — GHL's pipeline view sometimes shows stale cached state while the change is actually saved.
2. Check if a workflow has a "Move Opportunity to Stage" action that is overriding the manual change. Pause the workflow and test again.
3. Try changing the stage from inside the opportunity record (click the opportunity → find the Stage dropdown → save) instead of drag-and-drop.
4. Test in a different browser or incognito window to rule out extension conflicts.
5. Verify the user's role has Opportunities edit permission in Settings → Roles.`,
    category: 'technical',
    subcategory: 'pipeline_crm',
    feature_area: 'Pipelines',
    tags: ['pipeline', 'stage', 'not-saving', 'reverting', 'opportunity'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'sops/opportunities/pipeline-stage-not-updating.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From common-issues.md issue #9
  {
    id: randomUUID(),
    location_id: null,
    title: 'Invoice Charge Is Higher Than Expected',
    problem: 'A customer sees an invoice amount higher than their plan price and wants an explanation.',
    solution: `1. Ask: "Did you or someone on your team change your plan or add any features recently?"
2. The most common cause is proration — when you upgrade mid-billing cycle, you're charged the difference for the remaining days.
3. Guide to Settings → Billing → Invoice to see line items and identify the charge.
4. For SMS/call overages: check Settings → Billing → Usage to see credit consumption.
5. Check for add-ons: extra phone numbers, extra user seats, or email credits added by a team member.
6. If the dispute is over $200 or involves multiple billing periods, escalate to the billing team.`,
    category: 'billing',
    subcategory: 'invoice_charges',
    feature_area: 'Billing',
    tags: ['invoice', 'charge', 'proration', 'unexpected-charge', 'billing'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'sops/billing/invoice-question.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From common-issues.md issue #12
  {
    id: randomUUID(),
    location_id: null,
    title: 'Custom Domain Not Working or Showing SSL Error',
    problem: 'A custom domain connected to a funnel or website is not loading, or visitors see an SSL certificate error.',
    solution: `1. Ask when the DNS was changed — if under 72 hours, it may still be propagating (this is normal).
2. Check DNS propagation at dnschecker.org using your domain's CNAME record.
3. In GHL: Settings → Domains → confirm the domain shows as Active and Connected.
4. The expected CNAME for funnels/websites typically points to sites.gohighlevel.com (verify in GHL domain settings).
5. Confirm the funnel or website the domain is assigned to is Published.
6. If 72+ hours have passed with correct DNS and SSL still fails, escalate to technical team (possible GHL provisioning issue).`,
    category: 'technical',
    subcategory: 'website_funnels',
    feature_area: 'Custom Domains',
    tags: ['domain', 'ssl', 'not-loading', 'dns', 'cname', 'custom-domain'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'support/common-issues.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From common-issues.md issue #14
  {
    id: randomUUID(),
    location_id: null,
    title: 'Google Calendar Sync Broken or Not Working',
    problem: 'The Google Calendar integration has stopped syncing — GHL appointments no longer appear in Google Calendar, or personal Google Calendar events no longer block GHL availability.',
    solution: `1. Go to Settings → Integrations → Google Calendar → click Disconnect → then Re-authorize.
2. When re-authorizing, grant ALL requested permissions including calendar read and write access.
3. For Google events to block GHL availability: in Calendar settings, ensure "Check for conflicts" option is enabled.
4. After reconnecting: test by creating a GHL appointment and checking if it appears in Google Calendar within 5 minutes.
5. Add a personal event in Google Calendar and verify it blocks the GHL booking slot.`,
    category: 'technical',
    subcategory: 'integrations',
    feature_area: 'Google Calendar',
    tags: ['google-calendar', 'sync', 'integration', 'calendar-sync', 'oauth'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'support/common-issues.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From account-access login-issue SOP
  {
    id: randomUUID(),
    location_id: null,
    title: 'Cannot Log In — Password Reset Process',
    problem: 'A user cannot log in to their Legacy Fusion account due to a forgotten or incorrect password.',
    solution: `1. Go to the login page and click "Forgot Password".
2. Enter the email address associated with the account.
3. Check your email inbox AND spam/junk folder for the reset link (arrives within 1–2 minutes).
4. Click the link and set a new password. The link expires in 24 hours.
5. If the reset email is not arriving: confirm you are using the exact email address on the account; try a different email address if there is any doubt.
6. After password reset: try logging in in an incognito window to rule out browser cache issues.`,
    category: 'general',
    subcategory: 'account_settings',
    feature_area: 'Account Access',
    tags: ['login', 'password', 'reset', 'forgot-password', 'access'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'sops/account-access/login-issue.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // From permission-denied SOP
  {
    id: randomUUID(),
    location_id: null,
    title: 'Team Member Cannot Access a Feature or Module',
    problem: 'A logged-in team member cannot see or use a specific feature — it may be missing from their menu or showing a "Permission Denied" error.',
    solution: `1. Admin: go to Settings → Team Members → find the user → check their assigned Role.
2. Go to Settings → Roles → open that role → find the module that is inaccessible → confirm the permission is enabled (not Off or View-only).
3. Update the role permission to enable the needed access. Changes apply to all users with that role immediately.
4. Have the affected user log out completely and log back in — permissions can be cached in the active session.
5. If the feature is plan-gated (e.g., API access on Core plan), a plan upgrade is required — not a permissions fix.`,
    category: 'general',
    subcategory: 'user_management',
    feature_area: 'Roles and Permissions',
    tags: ['permissions', 'role', 'access', 'team-member', 'permission-denied'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'sops/account-access/permission-denied.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // Workflow trigger type mismatch
  {
    id: randomUUID(),
    location_id: null,
    title: 'Workflow Trigger Type Mismatch — Form Submitted vs Contact Created',
    problem: 'A workflow set to trigger on "Contact Created" does not fire when a contact submits a form, or vice versa.',
    solution: `"Form Submitted" and "Contact Created" are two different trigger events in GHL.
- "Form Submitted" fires only when a contact fills out a specific form.
- "Contact Created" fires whenever a new contact is added from any source (manual, import, API, or form).

To trigger specifically on form submission: set the trigger to "Form Submitted" and select the specific form.
To trigger on any new contact regardless of source: use "Contact Created".

If your workflow should fire when a contact submits your lead capture form, use "Form Submitted" — not "Contact Created". Most lead nurture workflows should use "Form Submitted" for form-based lead capture.`,
    category: 'technical',
    subcategory: 'automation_workflows',
    feature_area: 'Triggers',
    tags: ['trigger', 'form-submitted', 'contact-created', 'workflow', 'trigger-type'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'sops/automations/trigger-troubleshooting.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // Duplicate contacts
  {
    id: randomUUID(),
    location_id: null,
    title: 'Duplicate Contacts — How to Merge',
    problem: 'The same person appears as two or more separate contact records in the CRM.',
    solution: `1. Open the primary contact record (the one with the most complete data and history).
2. Click the ⋮ menu → select "Merge" (or select both contacts in the list view → Bulk Actions → Merge).
3. Select the duplicate record to merge into the primary.
4. GHL will combine field values (primary takes precedence), merge conversation history, and move opportunities to the primary.
5. After merging: verify the primary record shows complete data, confirm workflow enrollments are intact.

To prevent future duplicates: enable GHL's duplicate detection (Settings → Business Profile), use "Update if Exists" in integrations, and standardize email collection across all lead sources.`,
    category: 'technical',
    subcategory: 'pipeline_crm',
    feature_area: 'Contacts',
    tags: ['duplicate', 'contacts', 'merge', 'deduplication', 'import'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'sops/contacts/duplicate-contact-merge.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },

  // How to export contacts
  {
    id: randomUUID(),
    location_id: null,
    title: 'How to Export Contacts to CSV',
    problem: 'A customer wants to export their contact list as a CSV file.',
    solution: `1. Go to Contacts in the left sidebar.
2. Apply any filters you want (or select All Contacts for a full export).
3. Click the ⋮ menu (three dots) in the top right corner of the contacts list.
4. Select "Export" or "Export to CSV".
5. The file will download automatically or be emailed to your account email depending on the size of the export.
6. For large exports (50,000+ contacts): the file may be emailed to you rather than downloaded immediately.`,
    category: 'general',
    subcategory: 'training_how_to',
    feature_area: 'Contacts',
    tags: ['export', 'contacts', 'csv', 'download', 'how-to'],
    source: 'canonical' as const,
    source_ticket_id: null,
    approved_by: 'legacito',
    approved_at: now,
    canonical_file_path: 'support/common-issues.md',
    canonical_git_commit: null,
    active: true,
    retrieval_count: 0,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  },
];

// ===========================================================================
// SOP CHUNKS — generated from sops/**/*.md front matter + content
// ===========================================================================

interface SOPChunk {
  id: string;
  sop_id: string;
  sop_title: string;
  chunk_index: number;
  chunk_title: string | null;
  content: string;
  category: string;
  subcategory: string | null;
  tags: string[];
  audience: string;
  source_file: string;
  canonical_file_path: string;
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function readSOPFile(filePath: string): { meta: Record<string, string>; sections: Array<{ title: string | null; content: string }> } {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');

  // Parse frontmatter
  const meta: Record<string, string> = {};
  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    while (i < lines.length && lines[i].trim() !== '---') {
      const match = lines[i].match(/^(\w+):\s*(.+)$/);
      if (match) meta[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
      i++;
    }
    i++; // skip closing ---
  }

  // Parse sections split by ## headings
  const sections: Array<{ title: string | null; content: string }> = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      if (currentLines.join('\n').trim()) {
        sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
      }
      currentTitle = line.replace(/^## /, '').trim();
      currentLines = [];
    } else if (line.startsWith('# ') && !line.startsWith('## ')) {
      // Top-level heading — skip as section title, use as document title context
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.join('\n').trim()) {
    sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
  }

  return { meta, sections };
}

function sopFilesToChunks(sopDir: string): SOPChunk[] {
  const chunks: SOPChunk[] = [];

  function walkDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const { meta, sections } = readSOPFile(fullPath);
        const relPath = fullPath.replace(BRAIN_DIR + '/', '');

        const sopId       = meta['sop_id']     ?? entry.name.replace('.md', '');
        const sopTitle    = meta['title']       ?? sopId;
        const category    = meta['category']   ?? 'general';
        const subcategory = meta['subcategory'] ?? null;
        const audience    = meta['audience']   ?? 'both';
        const version     = parseInt(meta['version'] ?? '1', 10);

        // Derive tags from subcategory and feature_area
        const rawTags: string[] = [];
        if (meta['subcategory']) rawTags.push(meta['subcategory'].replace(/_/g, '-'));
        if (meta['feature_area']) rawTags.push(meta['feature_area'].toLowerCase().replace(/\s+/g, '-'));

        sections.forEach((section, idx) => {
          if (!section.content.trim()) return;
          chunks.push({
            id:                 randomUUID(),
            sop_id:             sopId,
            sop_title:          sopTitle,
            chunk_index:        idx,
            chunk_title:        section.title,
            content:            section.content.slice(0, 2800), // max 2800 chars per chunk
            category,
            subcategory:        subcategory ?? null,
            tags:               rawTags,
            audience,
            source_file:        relPath,
            canonical_file_path: relPath,
            version,
            active:             true,
            created_at:         now,
            updated_at:         now,
          });
        });
      }
    }
  }

  walkDir(sopDir);
  return chunks;
}

const sopChunks = sopFilesToChunks(join(BRAIN_DIR, 'sops'));

// Write output files
const kbPath  = join(SEEDS_OUT, 'support_knowledge_articles.seed.json');
const sopPath = join(SEEDS_OUT, 'support_sop_chunks.seed.json');

writeFileSync(kbPath,  JSON.stringify(knowledgeArticles, null, 2), 'utf-8');
writeFileSync(sopPath, JSON.stringify(sopChunks, null, 2), 'utf-8');

console.log(`✓ Knowledge articles: ${knowledgeArticles.length} records → ${kbPath}`);
console.log(`✓ SOP chunks: ${sopChunks.length} records → ${sopPath}`);
