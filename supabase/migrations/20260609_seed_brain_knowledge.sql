-- Migration: seed_brain_knowledge_articles_and_sops
-- Run in Supabase dashboard SQL Editor after 20260609_brain_foundation.sql
-- Generated: 2026-06-09T06:51:58.721Z
-- Records: 15 knowledge articles + 94 SOP chunks

-- KNOWLEDGE ARTICLES
INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  'f00f389c-03ef-47e0-b6ea-fccc6fa60a1e' , NULL, 'Workflow Not Triggering on Contact or Form Submission' , 'A workflow is configured but does not run when expected. Contacts enter the system but no emails, SMS, or actions fire.' ,
  '1. Open Automations → find the workflow → confirm status shows Active (not Draft or Paused).
2. Check the trigger type — "Form Submitted" and "Contact Created" are different events. Select the one that matches how contacts enter.
3. Review trigger filters — tag or field filters silently exclude contacts. Temporarily remove all filters and test.
4. Check the contact record → Workflows tab → see if the contact is enrolled but stuck in a Wait step.
5. Enable "Allow Re-enrollment" in trigger settings if the contact has already completed this workflow before.
6. Test by manually enrolling a contact via Contacts → Add to Workflow.' , 'technical' , 'automation_workflows' , 'Workflows' ,
  ARRAY['workflow','automation','trigger','not-firing','draft'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'sops/automations/workflow-not-firing.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  'f39270d8-6295-4b91-86e1-8324867bfce5' , NULL, 'Emails Going to Spam or Not Being Delivered' , 'Automated or campaign emails are not reaching contacts, or are landing in spam folders instead of the inbox.' ,
  '1. Go to Settings → Email Services → verify a custom sending domain is configured.
2. If using the default GHL domain, switch to a custom domain for better deliverability.
3. For custom domains: use MXToolbox to verify SPF, DKIM, and DMARC records are correctly configured at your domain registrar.
4. Review email content — remove excessive caps, overly salesy phrases, and too many links.
5. Clean your contact list of invalid or bounced email addresses.
6. Send a test email to yourself to check spam folder placement.' , 'technical' , 'automation_workflows' , 'Email Sending Domain' ,
  ARRAY['email','spam','deliverability','spf','dkim','sending-domain'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'support/common-issues.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '9ed57828-f538-423f-879b-5bfc1cb9b130' , NULL, 'SMS Messages Not Being Delivered' , 'SMS messages set up in workflows or sent manually are not reaching contacts.' ,
  '1. Go to Settings → Phone Numbers → confirm an active number is configured on the location.
2. Check the contact''s phone number — must be a mobile number (landlines cannot receive SMS).
3. Check the contact''s DNC (Do Not Contact) status and SMS opt-out status on the contact record.
4. For bulk US campaigns: check A2P 10DLC registration status in Settings → Phone Numbers. Unregistered campaigns are blocked by carriers.
5. Check SMS credit balance in Settings → Billing.
6. Test by manually sending an SMS to the contact from the Conversations inbox.' , 'technical' , 'automation_workflows' , 'SMS' ,
  ARRAY['sms','not-sending','dnc','a2p','phone-number','opt-out'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'support/common-issues.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '69f214e4-9eb8-4a0f-ad98-6279dd908096' , NULL, 'Contacts Missing After CSV Import' , 'A CSV contact import completed but some or all contacts are not visible in the contacts list.' ,
  '1. Go to Contacts → Import History to check status and download the error report.
2. The error report shows which rows failed and why (common: missing required field, duplicate email).
3. If import is recent (under 15 minutes): wait and refresh — large imports take time to process.
4. Search for a specific contact by email to rule out a Smart List filter hiding contacts.
5. Verify CSV column headers match GHL''s expected format: First Name, Last Name, Email, Phone.
6. Confirm you are in the correct location/sub-account.' , 'technical' , 'pipeline_crm' , 'Contacts' ,
  ARRAY['import','contacts','csv','missing','not-showing'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'support/common-issues.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '2999ae2b-d040-4976-ab90-008dfcc71504' , NULL, 'Calendar Shows No Available Booking Times' , 'The calendar booking link shows no available time slots, preventing customers from booking appointments.' ,
  '1. Open Calendars → find the calendar → click Edit → go to Available Hours section.
2. Confirm at least one working day is selected and working hours are set (e.g., Mon–Fri, 9 AM–5 PM).
3. Check the assigned team member has availability configured in their user profile.
4. Try the booking link with a date 2–4 weeks in the future to rule out near-term slots being filled.
5. If Google Calendar sync is enabled: check if personal events in Google Calendar are blocking all available slots. Re-authorize sync if needed: Settings → Integrations → Google Calendar.
6. Confirm the calendar timezone is correct in Calendar settings.' , 'technical' , 'website_funnels' , 'Calendar' ,
  ARRAY['calendar','booking','no-availability','slots','google-sync'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'sops/calendars/booking-not-showing.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '3c87ab2e-3d58-426e-8af1-f212bd98c856' , NULL, 'Form Not Submitting or Not Creating Contacts' , 'A lead capture form does not submit, shows an error when submitted, or successfully submits but does not create a contact in the CRM.' ,
  '1. Open the form builder → confirm the form status is Published (not Draft).
2. Test the form in an incognito browser window to rule out login session or extension conflicts.
3. Temporarily disable reCAPTCHA in form settings and test again.
4. Look for hidden required fields in conditional logic that may be blocking submission.
5. If embedded on an external site: re-copy the embed code from GHL and replace the old version.
6. Search for a specific contact by email — the contact may exist but be filtered out of the main contacts view.' , 'technical' , 'website_funnels' , 'Forms' ,
  ARRAY['form','not-submitting','lead-capture','contact-not-created','recaptcha'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'support/common-issues.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '8025443c-c1c7-44b5-a5d7-510f4c90fe1d' , NULL, 'Pipeline Stage Not Saving or Reverting After Change' , 'Dragging an opportunity to a new pipeline stage does not save, or the stage reverts back after being manually changed.' ,
  '1. Hard refresh the browser (Ctrl+Shift+R) — GHL''s pipeline view sometimes shows stale cached state while the change is actually saved.
2. Check if a workflow has a "Move Opportunity to Stage" action that is overriding the manual change. Pause the workflow and test again.
3. Try changing the stage from inside the opportunity record (click the opportunity → find the Stage dropdown → save) instead of drag-and-drop.
4. Test in a different browser or incognito window to rule out extension conflicts.
5. Verify the user''s role has Opportunities edit permission in Settings → Roles.' , 'technical' , 'pipeline_crm' , 'Pipelines' ,
  ARRAY['pipeline','stage','not-saving','reverting','opportunity'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '8346d1b5-e1cf-4527-abf7-a5b37f3db3b5' , NULL, 'Invoice Charge Is Higher Than Expected' , 'A customer sees an invoice amount higher than their plan price and wants an explanation.' ,
  '1. Ask: "Did you or someone on your team change your plan or add any features recently?"
2. The most common cause is proration — when you upgrade mid-billing cycle, you''re charged the difference for the remaining days.
3. Guide to Settings → Billing → Invoice to see line items and identify the charge.
4. For SMS/call overages: check Settings → Billing → Usage to see credit consumption.
5. Check for add-ons: extra phone numbers, extra user seats, or email credits added by a team member.
6. If the dispute is over $200 or involves multiple billing periods, escalate to the billing team.' , 'billing' , 'invoice_charges' , 'Billing' ,
  ARRAY['invoice','charge','proration','unexpected-charge','billing'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'sops/billing/invoice-question.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  'fa0ecc7b-8b06-46bb-ad54-a2c9c2f673bd' , NULL, 'Custom Domain Not Working or Showing SSL Error' , 'A custom domain connected to a funnel or website is not loading, or visitors see an SSL certificate error.' ,
  '1. Ask when the DNS was changed — if under 72 hours, it may still be propagating (this is normal).
2. Check DNS propagation at dnschecker.org using your domain''s CNAME record.
3. In GHL: Settings → Domains → confirm the domain shows as Active and Connected.
4. The expected CNAME for funnels/websites typically points to sites.gohighlevel.com (verify in GHL domain settings).
5. Confirm the funnel or website the domain is assigned to is Published.
6. If 72+ hours have passed with correct DNS and SSL still fails, escalate to technical team (possible GHL provisioning issue).' , 'technical' , 'website_funnels' , 'Custom Domains' ,
  ARRAY['domain','ssl','not-loading','dns','cname','custom-domain'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'support/common-issues.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '1d652a03-b6f4-44a1-9ad7-6b4f798172ff' , NULL, 'Google Calendar Sync Broken or Not Working' , 'The Google Calendar integration has stopped syncing — GHL appointments no longer appear in Google Calendar, or personal Google Calendar events no longer block GHL availability.' ,
  '1. Go to Settings → Integrations → Google Calendar → click Disconnect → then Re-authorize.
2. When re-authorizing, grant ALL requested permissions including calendar read and write access.
3. For Google events to block GHL availability: in Calendar settings, ensure "Check for conflicts" option is enabled.
4. After reconnecting: test by creating a GHL appointment and checking if it appears in Google Calendar within 5 minutes.
5. Add a personal event in Google Calendar and verify it blocks the GHL booking slot.' , 'technical' , 'integrations' , 'Google Calendar' ,
  ARRAY['google-calendar','sync','integration','calendar-sync','oauth'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'support/common-issues.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  'ed89ef39-5342-46cd-a031-d0ae55579479' , NULL, 'Cannot Log In — Password Reset Process' , 'A user cannot log in to their Legacy Fusion account due to a forgotten or incorrect password.' ,
  '1. Go to the login page and click "Forgot Password".
2. Enter the email address associated with the account.
3. Check your email inbox AND spam/junk folder for the reset link (arrives within 1–2 minutes).
4. Click the link and set a new password. The link expires in 24 hours.
5. If the reset email is not arriving: confirm you are using the exact email address on the account; try a different email address if there is any doubt.
6. After password reset: try logging in in an incognito window to rule out browser cache issues.' , 'general' , 'account_settings' , 'Account Access' ,
  ARRAY['login','password','reset','forgot-password','access'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'sops/account-access/login-issue.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '1f99ffeb-0619-4f6e-97e0-0eec6995ed94' , NULL, 'Team Member Cannot Access a Feature or Module' , 'A logged-in team member cannot see or use a specific feature — it may be missing from their menu or showing a "Permission Denied" error.' ,
  '1. Admin: go to Settings → Team Members → find the user → check their assigned Role.
2. Go to Settings → Roles → open that role → find the module that is inaccessible → confirm the permission is enabled (not Off or View-only).
3. Update the role permission to enable the needed access. Changes apply to all users with that role immediately.
4. Have the affected user log out completely and log back in — permissions can be cached in the active session.
5. If the feature is plan-gated (e.g., API access on Core plan), a plan upgrade is required — not a permissions fix.' , 'general' , 'user_management' , 'Roles and Permissions' ,
  ARRAY['permissions','role','access','team-member','permission-denied'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'sops/account-access/permission-denied.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '6c8a5cbb-9a59-4bd3-854f-38cb32aa21e8' , NULL, 'Workflow Trigger Type Mismatch — Form Submitted vs Contact Created' , 'A workflow set to trigger on "Contact Created" does not fire when a contact submits a form, or vice versa.' ,
  '"Form Submitted" and "Contact Created" are two different trigger events in GHL.
- "Form Submitted" fires only when a contact fills out a specific form.
- "Contact Created" fires whenever a new contact is added from any source (manual, import, API, or form).

To trigger specifically on form submission: set the trigger to "Form Submitted" and select the specific form.
To trigger on any new contact regardless of source: use "Contact Created".

If your workflow should fire when a contact submits your lead capture form, use "Form Submitted" — not "Contact Created". Most lead nurture workflows should use "Form Submitted" for form-based lead capture.' , 'technical' , 'automation_workflows' , 'Triggers' ,
  ARRAY['trigger','form-submitted','contact-created','workflow','trigger-type'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'sops/automations/trigger-troubleshooting.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '32a7321a-22ef-4b19-8f19-2564f4c35efd' , NULL, 'Duplicate Contacts — How to Merge' , 'The same person appears as two or more separate contact records in the CRM.' ,
  '1. Open the primary contact record (the one with the most complete data and history).
2. Click the ⋮ menu → select "Merge" (or select both contacts in the list view → Bulk Actions → Merge).
3. Select the duplicate record to merge into the primary.
4. GHL will combine field values (primary takes precedence), merge conversation history, and move opportunities to the primary.
5. After merging: verify the primary record shows complete data, confirm workflow enrollments are intact.

To prevent future duplicates: enable GHL''s duplicate detection (Settings → Business Profile), use "Update if Exists" in integrations, and standardize email collection across all lead sources.' , 'technical' , 'pipeline_crm' , 'Contacts' ,
  ARRAY['duplicate','contacts','merge','deduplication','import'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'sops/contacts/duplicate-contact-merge.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_knowledge_articles (
  id, location_id, title, problem, solution, category, subcategory, feature_area,
  tags, source, source_ticket_id, approved_by, approved_at, canonical_file_path,
  active, retrieval_count, helpful_count, created_at, updated_at
) VALUES (
  '219f6945-8141-4d73-9706-37e785f2b25c' , NULL, 'How to Export Contacts to CSV' , 'A customer wants to export their contact list as a CSV file.' ,
  '1. Go to Contacts in the left sidebar.
2. Apply any filters you want (or select All Contacts for a full export).
3. Click the ⋮ menu (three dots) in the top right corner of the contacts list.
4. Select "Export" or "Export to CSV".
5. The file will download automatically or be emailed to your account email depending on the size of the export.
6. For large exports (50,000+ contacts): the file may be emailed to you rather than downloaded immediately.' , 'general' , 'training_how_to' , 'Contacts' ,
  ARRAY['export','contacts','csv','download','how-to'], 'canonical' , NULL, 'legacito' ,
  '2026-06-09T06:48:28.733Z' , 'support/common-issues.md' ,
  true, 0, 0,
  '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, problem=EXCLUDED.problem, solution=EXCLUDED.solution,
  tags=EXCLUDED.tags, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;


-- SOP CHUNKS
INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '9e408c02-1777-4365-81d8-77a0dfb1c9fb' , 'account-access-login-issue' , 'Login Issues and Account Access' , 0,
  'Problem' , 'A customer or team member cannot log in to their Legacy Fusion account. This may be a forgotten password, locked account, suspended account, email not recognized, or two-factor authentication failure.

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '95bda35a-1861-4f7f-8054-c9c7b2afbb6b' , 'account-access-login-issue' , 'Login Issues and Account Access' , 1,
  '⚠️ CRITICAL: Escalation Gate' , '**Before any troubleshooting:** Check if this is an escalation scenario:

- If the customer says **"I think my account was hacked"** or suspects unauthorized access → **T3 escalation: STOP, escalate immediately**
- If the customer says **"My account appears suspended"** and they believe this is an error → **T2 escalation**
- If **multiple team members** are locked out simultaneously → **T2 escalation**

For suspected security issues: do NOT guide through password reset steps — escalate.

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '22f3ad6d-afa3-4519-9290-bcae38d1bb3d' , 'account-access-login-issue' , 'Login Issues and Account Access' , 2,
  'Step 1 — Identify the Type of Login Issue' , 'Ask:
- "What happens when you try to log in — what does the error say?"
- Common responses:
  - "Wrong password" / "Incorrect email or password"
  - "Account not found"
  - "Account suspended"
  - "I''m not receiving the 2FA code"
  - "I can see the login page but it won''t let me in"

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'f8e47e44-5110-4e1c-a0e8-f7f22a5bc307' , 'account-access-login-issue' , 'Login Issues and Account Access' , 3,
  'Step 2 — Password Reset (Most Common)' , 'If the issue is a forgotten or incorrect password:

1. Direct the customer to the GHL login page (their specific white-labeled login URL or `app.gohighlevel.com`)
2. Click **"Forgot Password"**
3. Enter the email address associated with the account
4. Check email (including spam/junk folder) for the reset link
5. Click the link in the email and set a new password
6. Link expires in 24 hours — if not received or expired, request a new one

**If the reset email isn''t arriving:**
- Confirm the correct email address is being used
- Check spam/junk folders
- Some corporate email servers block automated emails — try a personal email if possible

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '9b29483f-df95-4f7b-9ef7-699cbcc3e9ca' , 'account-access-login-issue' , 'Login Issues and Account Access' , 4,
  'Step 3 — Email Not Recognized' , 'If "account not found" error appears:

1. Confirm the exact email address — try variations (has the customer ever used an alias or different email?)
2. Check if the invite to the account was accepted (team members may have received an invite link but never completed setup)
3. Confirm they are trying to log in at the correct URL (white-label vs. default GHL)

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'ba33901b-998e-4a63-ab7f-0fccb6c01b67' , 'account-access-login-issue' , 'Login Issues and Account Access' , 5,
  'Step 4 — Two-Factor Authentication Issues' , 'If the customer can enter their password but cannot receive or use the 2FA code:

1. **SMS 2FA not arriving:** Check if the phone number is correct; check for carrier-level blocking; ask them to wait 2 minutes and try again
2. **Authenticator app (TOTP) not working:** Check if their device time is correct — TOTP codes are time-sensitive (30-second window)
3. **Lost access to 2FA device:** Cannot be resolved by LegacyZero — escalate to account owner who can remove 2FA

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '140ea45a-eb22-46bd-a55f-91e6fc3ce302' , 'account-access-login-issue' , 'Login Issues and Account Access' , 6,
  'Step 5 — Account Suspended' , 'If the account shows as suspended:

**Possible reasons:**
- Failed billing (payment method expired or declined)
- Terms of service violation
- Manual suspension by agency/admin

**For billing-related suspension:**
1. Guide to Settings → Billing → check payment method status
2. Update the payment method if expired or declined
3. If account suspension doesn''t lift automatically after payment update: escalate

**For other suspensions:** Escalate — LegacyZero cannot unsuspend accounts.

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'd66e3659-f10a-4a9a-9bbf-f644edf3ff46' , 'account-access-login-issue' , 'Login Issues and Account Access' , 7,
  'Step 6 — Locked Out After Too Many Attempts' , 'GHL may temporarily lock an account after multiple failed login attempts.

**Fix:** Wait 15–30 minutes and try again, OR use the password reset flow to reset and immediately set a new password. The lock usually clears with a successful password reset.

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '033ec261-f9f0-47c5-b461-76ff0cdd2d6d' , 'account-access-login-issue' , 'Login Issues and Account Access' , 8,
  'Step 7 — Sub-Account / Location Access' , 'If the user can log in but cannot access a specific sub-account or location:

1. Confirm they are using the correct login for that location (different locations may have different user records)
2. Confirm the agency admin has granted them access to that specific location
3. In the agency account: Settings → Team Members → check that the user is assigned to the correct locations

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'f5de7050-42be-4782-a4c7-727e42a19a84' , 'account-access-login-issue' , 'Login Issues and Account Access' , 9,
  'Resolution Confirmation' , 'Resolved when:
- The customer or team member can successfully log in AND
- They can access the expected features and locations

---' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '6c50ca31-2c35-4c3d-a7d2-f55c445c478a' , 'account-access-login-issue' , 'Login Issues and Account Access' , 10,
  'Escalation Triggers' , '- **T2:** Account appears suspended with no clear billing-related reason, or customer believes suspension is an error
- **T3:** Customer suspects unauthorized access or security breach
- Multiple users locked out simultaneously (T2)
- Customer cannot resolve 2FA lock and needs 2FA removed from account (requires admin or manual support action)' , 'technical' , 'account_settings' ,
  ARRAY['account-settings','account-access'], 'both' , 'sops/account-access/login-issue.md' , 'sops/account-access/login-issue.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '478c2358-0b1a-43ac-a9f4-e2fe4a44ad30' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 0,
  'Problem' , 'A logged-in user cannot access a feature, module, or section of Legacy Fusion. They may see a "Permission Denied" error, the menu item may not appear, or an action (edit, delete, create) is greyed out.

---' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'e8a74082-3ffd-42f0-87ba-c2c6da9d175f' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 1,
  'Step 1 — Identify What Is Inaccessible' , 'Ask:
- "What feature or section are you trying to access?"
- "What do you see — is it missing from the menu, or do you see an error when you try to use it?"

Common examples:
- "Billing settings" — Admin role required
- "Can''t edit contacts" — Contacts edit permission needed
- "Pipeline is not visible" — Pipelines permission needed
- "Can''t send campaigns" — Marketing permission needed
- "Can''t add users" — User management (Admin) required

---' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '1310c0fe-8f61-4850-acef-1a963416d1d1' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 2,
  'Step 2 — Identify the User''s Current Role' , '**For the affected user:**
Ask them to go to their profile or ask their account admin to check.

**For the account admin:**
Go to **Settings → Team Members → [User]** → check the assigned Role.

Common roles and what they include:
- **Admin** — Full access to all settings, billing, team management
- **Manager / Standard User** — Access to CRM, pipelines, conversations, calendar — but not billing or user management
- **View Only** — Can view but cannot edit anything
- **Custom Role** — Could be anything the admin configured

---' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '8ce9b407-3179-479f-b2d1-959d0a6e34c8' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 3,
  'Step 3 — Check the Role Permissions' , 'Go to **Settings → Roles** → open the role assigned to the user.

Find the module that is inaccessible:
- Is the permission toggle for that module enabled?
- Is it set to "View Only" when "Edit" is needed?

**Module permission levels (typical):**
- Off — feature is completely hidden
- View — user can see but not modify
- Edit — user can create and modify
- Delete — user can delete (separate from edit in some modules)

**Fix:** Enable the required permission on the role. The change takes effect immediately for all users with that role.

---' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'e1df491a-2d3c-46bd-9546-ab921ed739f3' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 4,
  'Step 4 — Check Sub-Account Access (For Agency Users)' , 'If the user can access the agency account but cannot see a specific sub-account/location:

Go to **Settings → Team Members → [User]** → scroll to "Locations Access":
- Is the specific location listed and toggled on?
- If "All Locations" is selected, they should see everything

**Fix:** Toggle on access to the specific location(s) the user needs.

---' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '31b8e20e-6827-477a-a7ce-b588ce19d1c5' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 5,
  'Step 5 — Billing Access Specifically' , 'Billing settings are restricted to Admin role only by design. There is no sub-permission for "billing view" in standard GHL — it''s all-or-nothing at the Admin level.

If a user needs billing access:
- Option A: Assign them the Admin role (gives full access to everything)
- Option B: The Admin accesses billing on their behalf and shares the information

**If the customer says "my admin gave me access to billing but I still can''t see it":**
- Confirm the role change was saved and the user logged out and back in
- Browser cache sometimes shows old permissions until a fresh login

---' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '2de85eda-90ea-4902-87ab-0824ae814765' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 6,
  'Step 6 — Changes Not Taking Effect After Role Update' , 'If the admin updated the role but the user still cannot access the feature:

1. Have the affected user **log out completely** and log back in
2. Roles are sometimes cached in the session — a fresh login forces the new permissions to load
3. If a custom role was edited: confirm the changes were saved (some GHL versions require an explicit "Save" click)

---' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '805150e4-c0a7-47aa-912f-d213dfee69ca' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 7,
  'Step 7 — Confirm Plan Limitations' , 'Some features are not a permission issue — they are plan restrictions:
- API access requires Legacy Edge or Elite
- Advanced reporting requires Edge or Elite
- White-label requires Elite
- Extra user seats beyond the plan limit cannot be added

If the feature is plan-gated: explain the plan requirement and offer to connect with account manager for upgrade discussion.

---' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '0ea5915e-8d58-4234-9a4a-bbd2e063d5db' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 8,
  'Resolution Confirmation' , 'Resolved when:
- The affected user can access the feature they needed AND
- The permission change does not inadvertently grant more access than intended

Always confirm with the admin: "Is this permission level appropriate for this user''s role in the business?"

---' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'a495f349-aa39-4103-959f-d58e1f32ca01' , 'account-access-permission-denied' , 'Permission Denied / Feature Not Accessible' , 9,
  'Escalation Triggers' , 'Escalate if:
- Admin has granted all permissions, user has logged out and back in, and access is still denied (platform issue)
- Role editor is saving but permissions are not applying correctly
- User shows correct role in settings but experiences incorrect restrictions (role/session mismatch)' , 'general' , 'user_management' ,
  ARRAY['user-management','roles-and-permissions'], 'both' , 'sops/account-access/permission-denied.md' , 'sops/account-access/permission-denied.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'a74f8559-87e7-4f6d-9cf5-e5ef51447a57' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 0,
  'Problem' , 'A workflow was created and configured but contacts are not entering it. The workflow may be in Draft state, or it may be published but not active for new enrollments.

This is the single most common root cause of "workflow not firing" issues.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '9af7374b-d800-48a2-9e6d-2c51e5e89fdb' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 1,
  'Step 1 — Find the Workflow' , 'Go to **Automations** in the left navigation sidebar.

Find the workflow in the list. The status is shown next to the workflow name:
- **Draft** — not yet activated. Will not fire.
- **Active** — running normally.
- **Paused** — temporarily stopped. Will not enroll new contacts.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '2b63c852-1325-454b-bca1-89bef239fec5' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 2,
  'Step 2 — Open the Workflow' , 'Click the workflow name to open it.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '4a8da85a-cb51-438b-89d3-30c769770f18' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 3,
  'Step 3 — Check the Status Toggle' , 'In the top-right area of the workflow editor, look for a toggle or button showing the current status.

- If it shows **Draft** or has a "Publish" button → click "Publish" or toggle to Active.
- If it shows **Active** → the workflow is already published. The issue is elsewhere (see SOP: workflow-not-firing).
- If it shows **Paused** → click "Resume" or toggle to Active to re-enable.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '757d10cf-f389-4494-ac00-cec64294d494' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 4,
  'Step 4 — Confirm the Workflow Has a Valid Trigger' , 'Before activating, verify the workflow has at least one trigger configured. A workflow with no trigger cannot automatically enroll contacts.

Click the trigger block at the top:
- If it shows "No Trigger" or is empty → add the correct trigger before publishing
- If a trigger is configured → confirm the trigger type and settings look correct

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '1da36eb2-f60c-458c-ad76-fd0e8c0ac20e' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 5,
  'Step 5 — Confirm No Draft Actions Are Present' , 'Some GHL versions prevent publishing if any action blocks inside the workflow have invalid or incomplete configurations.

Scroll through the workflow and look for any blocks showing:
- A red warning indicator
- "Incomplete" or "Error" state
- Missing template selection (email/SMS actions with no template assigned)

Fix any invalid blocks before publishing.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'cc7fb889-566a-4cfc-b14a-739289895373' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 6,
  'Step 6 — Publish and Test' , 'Once the toggle is set to Active:

1. Create a test contact (or use an existing one)
2. Manually trigger the workflow event (submit the form, add the tag, etc.)
3. Go to the contact record → Workflows tab → confirm the contact enrolled
4. Wait for the first action''s expected time (immediate, or after a Wait step)
5. Confirm the action ran (email received, SMS sent, stage changed, etc.)

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'b908b8be-cf24-4c9f-9c06-83e8f10f6504' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 7,
  'Post-Publish Checklist' , '- [ ] Workflow toggle shows "Active"
- [ ] At least one trigger is configured
- [ ] All action blocks have valid templates/configurations
- [ ] Trigger filters are set correctly (not over-filtering)
- [ ] Re-enrollment is enabled if contacts should repeat the workflow
- [ ] Test contact successfully enrolled and first action ran

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '726d82f4-5c3a-4c91-a875-ec92079d0d33' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 8,
  'Resolution Confirmation' , 'Resolved when a live contact successfully enters the workflow through the configured trigger and completes at least the first action. Confirm with the customer that their use case is working as expected.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'b5904df2-7221-4f84-926a-0bc827cd1079' , 'automation-publish-workflow-check' , 'Publish and Activate a Workflow' , 9,
  'Escalation Triggers' , 'Escalate if:
- Workflow was Active but was automatically moved to Paused or Draft by GHL (platform issue)
- Publishing fails with a GHL error message
- Workflow is Active but new contacts are not being enrolled despite meeting all trigger conditions' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/publish-workflow-check.md' , 'sops/automations/publish-workflow-check.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '47cf1322-1f69-40c1-a956-a545a9c2b766' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 0,
  'Problem' , 'A workflow''s trigger is not activating, or it is activating for the wrong contacts, or it fires unexpectedly. This SOP covers the most common trigger types and their specific failure modes.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'ab72c858-18a4-41bd-9c5c-16820a163614' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 1,
  'Trigger Type: Form Submitted' , '**Symptoms:** Contacts fill out the form but don''t enter the workflow.

**Step 1:** Confirm the trigger is set to "Form Submitted" (not "Contact Created").

**Step 2:** In the trigger settings, confirm the **specific form** is selected. "Any Form" fires for all forms — "Specific Form" fires only for the one selected.

**Step 3:** Check if the form is the current published version. If the form was recreated, the workflow may be pointing to an old/deleted form.

**Step 4:** Test by submitting the form yourself using a unique email. Check if the contact appears AND if they''re enrolled in the workflow.

**Step 5:** Check trigger filters — a tag filter like "tag = Lead" won''t work for brand-new contacts who don''t yet have the tag at the moment of form submission.

**Fix for tag filter issue:** Move the "Add Tag" action before any filter-based branching, or remove the tag requirement from the trigger.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '3ab9379f-7e50-41b2-a01a-4f5abaf8b7cc' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 2,
  'Trigger Type: Contact Created' , '**Symptoms:** Workflow doesn''t fire when a new contact is added.

**Step 1:** Confirm the trigger is "Contact Created" — not "Form Submitted" or another event.

**Step 2:** Verify: this trigger fires when a contact is CREATED from any source (manual entry, form, import, API). If the customer is only importing contacts, and imports don''t trigger automations on some GHL plans, consider using a different trigger or manually enrolling post-import.

**Step 3:** Check trigger filters — a new contact added manually may not have any tags yet, causing a tag filter to exclude them.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '34aa3a57-69d5-4756-98c6-33590d543795' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 3,
  'Trigger Type: Tag Added' , '**Symptoms:** Adding a tag to a contact doesn''t trigger the workflow.

**Step 1:** Confirm the exact tag name matches exactly (case-sensitive, no extra spaces). "Hot Lead" ≠ "hot lead" ≠ " Hot Lead".

**Step 2:** Check re-enrollment: if the contact already has this tag, adding it again may not re-trigger (depending on GHL version). Remove the tag first, then re-add it to test.

**Step 3:** Verify the workflow is Active (not Draft).

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '3d906f21-ab9e-4618-bfe7-f3c7d9dca9fc' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 4,
  'Trigger Type: Appointment Booked' , '**Symptoms:** Customer books an appointment but doesn''t receive confirmation or enter the workflow.

**Step 1:** Confirm the trigger is set to the correct **Calendar** (not "Any Calendar" if you intended a specific one, and vice versa).

**Step 2:** Check the appointment status filter — "Confirmed" vs. "New" (unconfirmed). If the booking requires manual confirmation, the trigger may fire only after confirmation.

**Step 3:** Check if the contact''s email field is populated — email-based triggers silently fail if the contact has no email.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '5b01e168-adee-4d32-a5c0-6798e165f977' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 5,
  'Trigger Type: Stage Changed / Pipeline Stage' , '**Symptoms:** Moving an opportunity doesn''t trigger the workflow.

**Step 1:** Confirm the trigger is set to the correct pipeline AND the correct stage.

**Step 2:** Verify the opportunity is being moved manually (drag) or via automation. The trigger fires on any stage change to the target stage.

**Step 3:** Check if there''s a filter requiring a specific assigned user or contact field. If the opportunity doesn''t match, it won''t trigger.

**Step 4:** Confirm the opportunity has a contact attached. Opportunities without a linked contact may not fire contact-based workflow actions.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '06e42dfe-16aa-445c-a47e-0d50b11cd0c3' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 6,
  'Trigger Type: Date / Time (Birthday, Anniversary, Field Date)' , '**Symptoms:** Date-based trigger not firing on expected date.

**Step 1:** Verify the contact has the date field populated in the correct format.

**Step 2:** Confirm the trigger is set to fire X days before/after the date, or on the exact date. Off-by-one day issues are common with timezone mismatches.

**Step 3:** Check the account timezone in Settings → Business Profile. The trigger fires based on the account timezone, not the customer''s local time.

**Step 4:** Date triggers typically run once per day at a specific time — if the date has passed today, the trigger won''t fire again until next year (for annual dates).

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '78451355-0806-4e5a-bad5-4e64c83cc683' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 7,
  'Trigger Filters Causing Silent Exclusions' , 'The most common trigger issue across all trigger types is a filter that silently excludes contacts without any error message.

**Common filter gotchas:**
- Tag filters on new contacts (tags are added AFTER creation, not at the moment of the trigger)
- Field value filters checking a field that is empty on the contact
- Pipeline filters when the contact is not yet in any pipeline at trigger time
- "AND" filter logic when "OR" logic was intended

**Debugging approach:** Remove ALL filters from the trigger → test → confirm it fires → add filters back one at a time to identify which one is excluding the contact.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '4d2ac42a-df68-47b5-ad95-75085b41ec5b' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 8,
  'Resolution Confirmation' , 'Resolved when: the correct contacts are entering the workflow from the intended trigger event, and incorrect contacts are being filtered out properly.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '6b981891-6878-4f27-a8f6-5a794b4b6b61' , 'automation-trigger-troubleshooting' , 'Workflow Trigger Troubleshooting' , 9,
  'Escalation Triggers' , 'Escalate to technical team if:
- Trigger fires correctly but immediately shows an error with no clear cause
- Contact meets all filter conditions and the workflow is Active, but still no enrollment
- GHL shows the event occurred (form submission, contact created) in the activity log, but the workflow has no enrollment record' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','triggers'], 'both' , 'sops/automations/trigger-troubleshooting.md' , 'sops/automations/trigger-troubleshooting.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'eb37b9b6-65cd-4eaf-8aa6-671fd978ed7b' , 'automation-workflow-not-firing' , 'Workflow Not Firing' , 0,
  'Problem' , 'A workflow (automation) exists and is configured but does not run when expected. Contacts are entering the system but the workflow''s actions (emails, SMS, stage changes, etc.) are not executing.

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/workflow-not-firing.md' , 'sops/automations/workflow-not-firing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'c2181979-e9e9-45fe-99b8-ef2c6046127b' , 'automation-workflow-not-firing' , 'Workflow Not Firing' , 1,
  'Diagnostic Steps' , '### Step 1 — Confirm Workflow Status

Go to **Automations** (left sidebar) → find the workflow.

Check the status toggle at the top of the workflow:
- **Active (green)** — workflow WILL fire for new enrollments
- **Draft (grey)** — workflow will NOT fire. It must be published/activated.
- **Paused** — workflow is temporarily stopped. Re-activate to resume.

**Fix:** If Draft or Paused → toggle to Active. Test again.

---

### Step 2 — Check the Trigger Configuration

Open the workflow → click on the **Trigger** block.

Verify:
- Is the trigger event correct? (e.g., "Form Submitted" vs. "Contact Created" — these are different)
- Is the correct form selected (for Form Submitted triggers)?
- Is the correct pipeline/stage selected (for Stage Changed triggers)?
- Are there any **filters** on the trigger? Filters limit which contacts qualify. Temporarily remove all filters and test.

**Common mistakes:**
- Selecting "Contact Created" instead of "Form Submitted" — contact creation happens at ANY contact add, form-specific submission is a different event
- Tag filter set to a tag the test contact doesn''t have
- Pipeline filter set to the wrong pipeline

---

### Step 3 — Check the Contact''s Enrollment Status

Go to **Contacts** → find the contact → scroll to the **Workflows** tab.

Look for:
- Is the contact enrolled in this workflow? If yes: what step are they on?
- Is there a **Wait** step the contact is sitting in? (The workflow IS running — it''s just waiting)
- Did the workflow complete? Check completion timestamp.
- Did the workflow error? Look for a red error indicator next to a step.

**Fix:** If the contact is stuck in a Wait step — this is expected behavior. The workflow is running.
If there''s an error: read the error message — it usually tells you exactly what failed.

---

### Step 4 — Check Re-enrollment Settings

If the contact has gone through this workflow before and should go through it again:

Open the workflow → Trigger settings → scroll to **"Allow Re-enrollment"**

- If re-enrollment is **off** and the contact already completed the workflow → they will NOT be enrolled again
- **Fix:** Enable re-enrollment, or remove the contact from the workflow''s "completed" list and re-trigger manually

---

### Step 5 — Verify the Test Contact Qualifies

For filter-based triggers, verify the test contact meets ALL filter conditions:
- Has the required tag(s)
- Has the required field values
- Is in the correct pipeline/stage (if that''s the trigger)

**Quick test:** Temporarily remove ALL trigger filters → manually enroll one test contact → confirm the workflow runs → then re-add filters one by one to identify which one is blocking.

---

### Step 6 — Manual Enrollment Test

If the trigger still won''t fire automatically, test the workflow in isolation:

' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/workflow-not-firing.md' , 'sops/automations/workflow-not-firing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '7b2a7f85-31d4-4b0d-8c84-93725ede2255' , 'automation-workflow-not-firing' , 'Workflow Not Firing' , 2,
  'Resolution Confirmation' , 'The workflow is considered resolved when:
- A test contact successfully enrolls via the trigger AND
- All intended actions execute in order AND
- The contact reaches the expected end state or the intended step

Ask the customer to confirm: "Has the test contact received the expected email/SMS and moved to the right stage?"

---' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/workflow-not-firing.md' , 'sops/automations/workflow-not-firing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'ee3e2078-d4b9-4829-9866-43467cef40c7' , 'automation-workflow-not-firing' , 'Workflow Not Firing' , 3,
  'Escalation Triggers' , 'Escalate to technical team if:
- Workflow executes some contacts but skips others with no clear filter reason
- Workflow shows "running" but actions are silently skipped with no error message
- GHL is showing contact as enrolled but actions have no execution history at all (platform-level logging issue)' , 'technical' , 'automation_workflows' ,
  ARRAY['automation-workflows','workflows'], 'both' , 'sops/automations/workflow-not-firing.md' , 'sops/automations/workflow-not-firing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'e2119497-bd42-4c14-aa90-c8974a4dbac7' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 0,
  'Problem' , 'A customer sees a charge on their invoice that is unexpected, higher than expected, or doesn''t match their plan price. They want an explanation before deciding whether to dispute.

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '79fff92d-6771-47c9-a46f-af272a40af31' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 1,
  'Step 1 — Acknowledge Without Committing' , 'Before asking questions, acknowledge the concern.

> "Let''s take a look at what that charge is for. A few questions will help me explain it."

Do NOT say "we wouldn''t charge you incorrectly" or "our billing system is accurate." Stay neutral.

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '772ea25d-bf2e-4415-8d36-ffc50e37cf53' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 2,
  'Step 2 — Ask the Key Questions' , '1. "What amount were you charged and what were you expecting?"
2. "Did you or anyone on your team make any changes to the plan or add any features recently?"
3. "What billing cycle is this for — this month or a previous month?"

These three questions cover the 80% of cases.

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '969d2f58-1e35-419b-bbd1-e5769af59b55' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 3,
  'Step 3 — Explain Proration (Most Common Cause)' , 'If the customer upgraded their plan mid-cycle:

> "When you upgrade your plan partway through a billing period, you''re charged the difference for the remaining days. For example, if you upgraded on the 15th of a 30-day month, you''d be charged roughly half the difference between your old plan and new plan."

**How to verify:** Guide customer to **Settings → Billing → Invoice** to see the line items. A proration line item will typically say "Proration" or "Partial month."

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '60ac58ed-9d9e-411e-a3a4-47ea18501def' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 4,
  'Step 4 — Check for Add-On Charges' , 'If there''s a line item the customer doesn''t recognize:

Guide to **Settings → Billing → Subscription** or **Billing → Usage**:
- Look for extra phone numbers purchased
- Extra user seats
- SMS/call usage overages
- Email credit overages

> "Sometimes a team member adds a feature without the account owner knowing. Can you check if any of these add-ons were purchased?"

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '10f360a5-c34b-433b-a1ba-e595755154ba' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 5,
  'Step 5 — Check for SMS/Call Overages' , 'If the unexpected charge looks like usage-based:

Guide to **Settings → Billing → Usage**:
- SMS credits consumed this period
- Call minutes used
- Any campaigns sent this month

> "SMS and calls are usage-based. If your team ran a campaign or sent a high volume of messages, those credits show up as a line item on the invoice."

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'e1d14a5e-90b1-4433-b3d0-7ee320ea3bab' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 6,
  'Step 6 — Charge After Cancellation' , 'If the customer says they cancelled but were still charged:

**Important:** In Legacy Fusion, plan cancellations (downgrades) take effect at the end of the current billing period, not immediately.

> "When a plan is cancelled or downgraded, the change takes effect at the end of your current billing cycle. So if you cancelled on [date] and your cycle ends [date], the last charge would have been on [date]."

**How to confirm:** Check the cancellation effective date in Settings → Billing.

If the charge occurred AFTER the confirmed cancellation date: this is a legitimate dispute → escalate (T5 if > $200).

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '098ae7d8-23e9-48e7-bcdb-0cb72675eba1' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 7,
  'Step 7 — Annual vs. Monthly Confusion' , 'If the charge is much larger than expected:

Check if the account was switched to annual billing. An annual plan charges the full year upfront.

> "If your account was switched to annual billing, the full year would have been charged at once. Annual billing typically includes a discount compared to monthly."

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'a991a2f7-c976-4a8d-9b60-08d7cb99de72' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 8,
  'Step 8 — Determine if Escalation Is Needed' , 'Escalate to billing specialist if:
- The charge is over $200 and genuinely unexplained after the above steps (T5 trigger)
- The customer reports charges on a cancelled account after the confirmed cancellation date
- The same charge has appeared multiple times in the same billing period (double billing)
- The customer is threatening legal action (T6 trigger — stop conversation, escalate immediately)

**Under $200:** You can explain and resolve tier-1 without escalating.

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'ee775a14-1273-4fad-8159-6688cc4cb805' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 9,
  'Resolution Confirmation' , 'Resolved when:
- The customer understands what the charge was for (proration, add-on, usage) AND
- If the charge was in error: it has been escalated to the billing team for review AND
- The customer confirms they understand the resolution path

**Do NOT promise refunds.** Only the billing team can authorize refunds. If a refund is warranted, escalate and say: "I''m flagging this for our billing team. They''ll review and reach out to you within [SLA]."

---' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '03cf4dea-da37-4088-ab21-690fad753983' , 'billing-invoice-question' , 'Invoice and Charge Questions' , 10,
  'Escalation Triggers' , '- T5: Dispute amount > $200
- T5: Multiple unexplained charges across billing periods
- T6: Legal threat or demand for data related to billing
- Any charge after confirmed cancellation date' , 'billing' , 'invoice_charges' ,
  ARRAY['invoice-charges','billing'], 'both' , 'sops/billing/invoice-question.md' , 'sops/billing/invoice-question.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '96627511-9844-4efc-8e70-1314f8635ae2' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 0,
  'Problem' , 'Customers trying to book an appointment see no available time slots, the booking page shows an error, or the calendar widget is not loading on the website/funnel.

---' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '4acb9b80-f40a-42ee-8a14-4bcbd03aaf3f' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 1,
  'Step 1 — Check Available Hours Configuration' , 'Open **Calendars** in the left sidebar → find the calendar → click **Edit**.

Go to the **Availability** or **Working Hours** section:
- Are working days selected? (At least one day must be checked)
- Are working hours set for those days? (e.g., 9 AM – 5 PM)
- If ALL days are unchecked or all times are blank → no availability = no bookings

**Fix:** Select working days and set working hours. Save the calendar.

---' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'bbbe7b2e-25c6-4b3a-b82e-598d637f4cbe' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 2,
  'Step 2 — Check Assigned Team Member Availability' , 'If the calendar is assigned to a specific team member (not round-robin):

1. Open the calendar → check which team member is assigned
2. Go to **Settings → Team Members → [User]** → check if they have availability set within their user profile

Some GHL setups require both the calendar-level availability AND the user-level availability to be configured.

**Fix:** Ensure the assigned user has availability set in their profile matching the calendar''s configured hours.

---' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '58ecb807-0ef7-40c7-908f-829170a8dcfd' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 3,
  'Step 3 — Check If All Slots Are Already Booked' , 'If availability IS configured but nothing shows:

1. Try the booking link with a date range 2–4 weeks out
2. Check if the calendar has an "Advance Booking Limit" (e.g., can only book 2 weeks ahead — if that limit is reached, nothing shows in the far future)
3. Check if existing appointments are filling all slots for the near-term dates

Go to **Calendars → [Calendar] → Appointments** to see existing bookings.

---' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '1667c651-a4ac-4646-b793-f5a8de2189a6' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 4,
  'Step 4 — Check Google Calendar Sync (If Enabled)' , 'If the calendar has Google Calendar sync enabled and is showing no availability:

1. Go to the calendar settings → sync options
2. Check if "Check for Conflicts" or "Block from Google" is enabled
3. Open Google Calendar and check if there are events blocking the expected time slots
4. If the sync token has expired, re-authorize: Settings → Integrations → Google Calendar → Disconnect → Re-authorize

**Common scenario:** Customer has a recurring personal event in Google Calendar (like "Lunch 12–1 PM daily") that is blocking all midday slots.

**Fix:** Delete or modify the blocking Google Calendar events, OR temporarily disable the GHL→Google conflict checking to confirm this is the cause.

---' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '1eb5cfbe-1ba4-480d-96ae-ae134c1be9c4' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 5,
  'Step 5 — Check Timezone Configuration' , 'If slots appear but at unexpected times, or the customer says "I see 9 PM slots but you close at 5 PM":

1. Open the calendar → confirm the timezone setting
2. Check Settings → Business Profile → confirm the account timezone
3. The booking page shows times in the visitor''s browser timezone by default — this is expected

If the calendar timezone is wrong (set to UTC when the business is in EST):
**Fix:** Calendar → Edit → update timezone → save.

---' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '8525e97c-398b-47dc-92fd-a3765e3c4715' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 6,
  'Step 6 — Test the Booking Link Directly' , 'Open the booking link in an incognito window. This rules out any logged-in session affecting what is shown.

If the booking link itself shows an error page:
- Confirm the calendar is Active (not archived or deleted)
- Check if the calendar has a custom URL that may have changed
- Try the default GHL booking link instead of a custom one

---' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '80d60807-9650-41a5-99aa-8fe299d97d3b' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 7,
  'Step 7 — Calendar Widget Not Loading on Website/Funnel' , 'If the calendar widget is embedded on a page and not loading:

1. View the page source and confirm the embed code is present
2. Check if the funnel/website page has any JavaScript errors (browser console)
3. Re-copy the embed code from the calendar settings and replace the existing embed code
4. Confirm the page itself is published and accessible

---' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '5755b0a8-5a0e-4d8e-a21f-3a841f940bc4' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 8,
  'Resolution Confirmation' , 'Resolved when:
- A customer can visit the booking link in an incognito window AND
- Available time slots are visible for the expected dates AND
- A test appointment can be successfully booked

---' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'dc031ef6-3d09-48a6-9aef-06604be7db6d' , 'calendars-booking-not-showing' , 'Calendar Booking Not Showing Availability' , 9,
  'Escalation Triggers' , 'Escalate to technical team if:
- Availability is correctly configured, Google Calendar sync is disabled, and still no slots show
- Booking link returns a 500 error or GHL system error (not a configuration issue)
- Calendar embed widget shows no content even after fresh embed code' , 'technical' , 'website_funnels' ,
  ARRAY['website-funnels','calendar'], 'both' , 'sops/calendars/booking-not-showing.md' , 'sops/calendars/booking-not-showing.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'd9b7b22f-7c93-47ff-9b49-060f3b87fc5c' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 0,
  'Problem' , 'Changes made to a contact record (field values, tags, notes, or custom fields) are not saving, are reverting after save, or are not reflecting in reports and views as expected.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'bb5dd82b-3fe1-4831-b056-e271d1f1491b' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 1,
  'Step 1 — Confirm Permissions' , 'Verify the user trying to make changes has the correct role permissions.

Go to **Settings → Team Members → [User] → Role Settings**:
- The user''s role must have **Contacts: Edit** permission enabled
- If the user only has read access, changes will silently not save or will show an error

**Fix:** Admin → Settings → Roles → update role to include Contacts edit permission.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '01115d26-faad-469a-9a4b-1a85a3413706' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 2,
  'Step 2 — Check for a Conflicting Workflow' , 'If a field or tag keeps reverting after being changed manually, a workflow may be overwriting it.

**Check:** Does any workflow have an action that:
- Removes the tag being added
- Sets the custom field to a different value
- Moves the contact back to a previous state

**How to find:** Go to **Automations** → search for actions involving that field or tag → check if any workflow fires on a trigger that would re-run after the manual change.

**Fix:** Edit or pause the conflicting workflow, or change the field/tag in the workflow itself.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'e4036eaa-54c8-458b-aac7-e983cc1a4a64' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 3,
  'Step 3 — Browser/Cache Issue' , 'If the contact update appears to not save but the change IS actually persisting:

1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache and cookies
3. Try in an incognito window or different browser

Sometimes GHL''s UI does not update visually even after a successful save. A refresh confirms the actual state.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'fb78d900-db59-4131-b159-8647f352b9e2' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 4,
  'Step 4 — Custom Field Not Saving' , 'If a specific custom field is not saving:

1. Check the field type — some field types have validation requirements (number fields won''t save text, date fields need a specific date format)
2. Confirm the field still exists (Settings → Custom Fields) — if it was deleted, the form shows the label but data cannot save
3. Check if there''s a character limit being exceeded (some text fields have limits)

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'a999abc1-d56a-4def-a0bf-7f587b122e4f' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 5,
  'Step 5 — Tag Not Persisting' , 'If a tag is being added but disappears:

1. Check if another workflow is removing the tag (see Step 2)
2. Check the exact tag name — adding "Hot Lead" and "hot lead" are different tags in GHL
3. Confirm the save button was clicked (in some GHL views, tag changes require explicit save)

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '68688b30-fd22-4d39-b043-86eb224434e3' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 6,
  'Step 6 — Smart List Not Reflecting Update' , 'If a contact was updated but doesn''t appear in (or disappear from) a Smart List:

1. Smart Lists refresh on a short delay — wait 1–2 minutes and refresh the page
2. Confirm the Smart List filter conditions are exactly met by the updated contact
3. Try rebuilding the Smart List filter from scratch to rule out a stale filter

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '9e8b2a6c-ff79-4158-95e7-a410fe35bb8d' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 7,
  'Step 7 — Contact Updates Not Appearing in Reports' , 'Reports may have a lag of up to 24 hours. Wait one business day and check again before escalating.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'e8b2ac19-4850-48d8-bc71-9e3512c9187d' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 8,
  'Resolution Confirmation' , 'Resolved when:
- The field/tag/note change persists after a page refresh AND
- No workflow is overwriting the change AND
- The contact appears correctly in any relevant Smart Lists

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '2520b5d8-7f7e-4060-ac69-088dc33f7f0e' , 'contacts-contact-not-updating' , 'Contact Record Not Updating' , 9,
  'Escalation Triggers' , 'Escalate if:
- User has correct permissions, no conflicting workflow, and the change still won''t save (platform issue)
- All steps in this SOP have been tried and the issue persists
- Multiple agents are experiencing the same update failure on the same contact record' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/contact-not-updating.md' , 'sops/contacts/contact-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '0789ac6b-841a-4e33-8c61-a11461164c25' , 'contacts-duplicate-contact-merge' , 'Duplicate Contact Handling and Merge' , 0,
  'Problem' , 'The same person appears as two or more separate contact records. This happens when a contact was added via different channels (form, manual, import, API) with slightly different information, and GHL''s duplicate detection did not match them.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/duplicate-contact-merge.md' , 'sops/contacts/duplicate-contact-merge.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '0aa5bbb0-b906-4d43-8fc2-9a5c1f5a002b' , 'contacts-duplicate-contact-merge' , 'Duplicate Contact Handling and Merge' , 1,
  'Step 1 — Confirm They Are Duplicates' , 'Before merging, verify both records represent the same person.

Compare:
- Name (may be slightly different spelling or formatting)
- Email address (different email? may be a legitimate different contact)
- Phone number (mobile vs. landline vs. different number)
- Creation date (one very recent suggests a re-submission or re-import)

**Caution:** Do not merge contacts if there is meaningful doubt they are the same person. Merges are not easily reversible.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/duplicate-contact-merge.md' , 'sops/contacts/duplicate-contact-merge.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '45f02e7d-4ae8-46f2-a49f-f688cfaa69f1' , 'contacts-duplicate-contact-merge' , 'Duplicate Contact Handling and Merge' , 2,
  'Step 2 — Identify Which Record to Keep (Primary)' , 'The "primary" contact will retain:
- All conversation history
- All opportunity records
- The merged fields from both contacts

Choose as primary:
- The record with the most complete information
- The record with the longer history (more messages, notes, activity)
- The record connected to active workflows or pipeline opportunities

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/duplicate-contact-merge.md' , 'sops/contacts/duplicate-contact-merge.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'fa014675-5640-4599-a582-7ad54f88259b' , 'contacts-duplicate-contact-merge' , 'Duplicate Contact Handling and Merge' , 3,
  'Step 3 — Merge the Contacts' , 'In GHL, open the **primary** contact record.

Look for the merge option:
- Click the ⋮ (three dots menu) on the contact record → select "Merge"
- Or: go to the Contacts list → select both contacts → use bulk action "Merge"

Select the secondary (duplicate) contact to merge into the primary.

GHL will:
- Combine field values (primary record''s values take precedence unless the field is empty)
- Merge conversation history
- Move opportunities to the primary record
- Remove the duplicate record

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/duplicate-contact-merge.md' , 'sops/contacts/duplicate-contact-merge.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '839d992b-7bb6-434e-8176-005a4be06cf7' , 'contacts-duplicate-contact-merge' , 'Duplicate Contact Handling and Merge' , 4,
  'Step 4 — After Merge Verification' , 'After merging:
1. Check the primary contact record to confirm the combined data looks correct
2. Verify conversation history is complete
3. Confirm any active workflow enrollments are still showing correctly
4. Check any pipeline opportunities are attached to the correct contact

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/duplicate-contact-merge.md' , 'sops/contacts/duplicate-contact-merge.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '2e89772e-0af8-43ea-935d-47b5a6aa2e09' , 'contacts-duplicate-contact-merge' , 'Duplicate Contact Handling and Merge' , 5,
  'Step 5 — Preventing Future Duplicates' , '**Primary causes of duplicates:**
1. Contact re-submits a form with a slightly different email (Gmail alias, typo)
2. Contact added manually and then via form later
3. Import of a list that included contacts already in the system
4. Lead source integrations (Zapier, Meta Leads, etc.) not matching existing contacts

**Prevention:**
- Enable GHL''s built-in duplicate detection (matches on email or phone number)
- Standardize data collection (one email field, one phone format)
- Before bulk imports: export and cross-check against existing contact list
- For integrations: use "Update if Exists" setting instead of "Create New"

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/duplicate-contact-merge.md' , 'sops/contacts/duplicate-contact-merge.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'c9c06298-6b95-475e-af71-2bb1cd38e809' , 'contacts-duplicate-contact-merge' , 'Duplicate Contact Handling and Merge' , 6,
  'Resolution Confirmation' , 'Resolved when:
- Duplicate records are merged into a single contact
- The primary record shows complete, accurate data
- No duplicate record exists for the same person

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/duplicate-contact-merge.md' , 'sops/contacts/duplicate-contact-merge.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '4a8c406d-4f8c-491f-9476-723a27081a3e' , 'contacts-duplicate-contact-merge' , 'Duplicate Contact Handling and Merge' , 7,
  'Escalation Triggers' , 'Escalate to technical team if:
- GHL merge function is producing data corruption (fields disappearing, conversations lost)
- Customer has hundreds of duplicates from a bad import (may need bulk merge script assistance)
- A merged contact shows unexpected behavior in workflows after merge

**Note for T1:** If the duplicate issue was caused by an import that corrupted data (not just duplicated it), check if this is a data loss scenario (T1 escalation trigger).' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','contacts'], 'both' , 'sops/contacts/duplicate-contact-merge.md' , 'sops/contacts/duplicate-contact-merge.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '219f441e-cab7-4257-bebe-5bad27dbcf9b' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 0,
  'Problem' , 'An opportunity is stuck in a pipeline stage, or moving it to a new stage doesn''t save, or the stage reverts after being changed. This may happen during manual drag-and-drop or after an automation is supposed to move it.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'f2319211-3168-47a9-be7c-000d88c31cdd' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 1,
  'Step 1 — Try a Hard Refresh' , 'Before diagnosing further, refresh the browser (Ctrl+Shift+R or Cmd+Shift+R).

GHL''s pipeline view can show a stale cached state while the actual data is already updated. Many "stage not updating" reports are resolved by a simple refresh.

If the stage is correctly saved after refresh: no further action needed.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '78580c6b-898f-4441-a6ff-bf01276cc66d' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 2,
  'Step 2 — Check User Permissions' , 'The user attempting to move the stage must have Opportunities edit permission.

Go to **Settings → Team Members → [User] → Role**:
- Confirm "Opportunities: Edit" is enabled in the role
- If the user only has "View" access, drag-and-drop changes will silently not save

**Fix:** Admin updates the role to include Opportunities edit access.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  'e681df54-c8a1-46e6-a02f-02c4e2c60b81' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 3,
  'Step 3 — Check for a Conflicting Workflow' , 'If the stage reverts immediately or shortly after being changed manually, a workflow is likely overriding it.

**Check:** Go to **Automations** → search for any workflow with a "Move Opportunity to Stage" action → check if it would fire after the manual stage change.

**Common conflict scenario:** Customer manually moves deal to "Won" → a workflow fires on "Stage Changed" → the workflow moves it back to "In Progress" as part of a sequence.

**Fix:** Pause the conflicting workflow, adjust its conditions, or change the manual stage change process to align with the automation logic.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '7aad4390-7715-4569-a873-1ad35ac5cb43' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 4,
  'Step 4 — Verify the Opportunity Has the Required Data' , 'Some GHL configurations require fields to be populated before stage changes are allowed (e.g., custom opportunity fields marked as required at certain stages).

Check:
- Is the opportunity missing required custom fields?
- Is a monetary value required to move to certain stages?

**Fix:** Fill in the required fields, then try the stage change again.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '7a279585-e7eb-4d24-962d-8a9898ef0c05' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 5,
  'Step 5 — Try a Different Browser or Incognito Mode' , 'If the drag-and-drop isn''t working, try:
1. A different browser (Chrome vs. Firefox vs. Safari)
2. Incognito/private browsing window
3. Clearing browser cache completely

GHL''s pipeline UI is JavaScript-heavy and browser extension conflicts or cached JS can cause drag-and-drop failures.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '17b3b9af-9b35-483f-8b66-569be42e61f4' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 6,
  'Step 6 — Manual Stage Change via Opportunity Record' , 'If drag-and-drop is failing, try changing the stage from inside the opportunity record:

1. Click the opportunity to open the full record
2. Look for the Stage dropdown inside the record
3. Select the new stage from the dropdown
4. Save

This uses a different code path than drag-and-drop and often works even when the visual drag fails.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '7a2c96ff-423d-4350-bbef-50ba039cceb8' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 7,
  'Step 7 — For Automation-Based Stage Changes' , 'If a workflow is supposed to move the stage but isn''t:

1. Open the workflow → find the "Move Opportunity to Stage" action
2. Confirm the correct pipeline AND stage are selected
3. Check the workflow is Active
4. Check the contact has an opportunity in the specified pipeline (the action fails silently if no opportunity exists)
5. Check the contact''s Workflows tab to see if the workflow ran and if the step shows an error

**Common issue:** The contact has no opportunity attached in that pipeline. Create the opportunity first, then the workflow stage-change action will work.

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '7df584ae-cd4c-4fd8-9d8b-a0051b88e480' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 8,
  'Resolution Confirmation' , 'Resolved when:
- The opportunity is in the correct stage after change AND
- The change persists after a full page refresh AND
- No workflow is reverting the stage

---' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;

INSERT INTO support_sop_chunks (
  id, sop_id, sop_title, chunk_index, chunk_title, content, category, subcategory,
  tags, audience, source_file, canonical_file_path, version, active, created_at, updated_at
) VALUES (
  '4d9e8da1-5313-4d2b-b07b-54b9d059ad64' , 'opportunities-pipeline-stage-not-updating' , 'Pipeline Stage Not Updating' , 9,
  'Escalation Triggers' , 'Escalate if:
- Stage changes fail for ALL users simultaneously (possible platform issue)
- Stage changes succeed in the UI but do not persist after page reload despite correct permissions
- An opportunity stage change that should trigger a workflow is silently not triggering' , 'technical' , 'pipeline_crm' ,
  ARRAY['pipeline-crm','pipelines'], 'both' , 'sops/opportunities/pipeline-stage-not-updating.md' , 'sops/opportunities/pipeline-stage-not-updating.md' ,
  1, true, '2026-06-09T06:48:28.733Z' , '2026-06-09T06:48:28.733Z' 
) ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, chunk_title=EXCLUDED.chunk_title, version=EXCLUDED.version,
  active=EXCLUDED.active, updated_at=EXCLUDED.updated_at;


-- Verify
SELECT 'knowledge_articles' as tbl, count(*) as rows FROM support_knowledge_articles WHERE active=true
UNION ALL
SELECT 'sop_chunks', count(*) FROM support_sop_chunks WHERE active=true;
