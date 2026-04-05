// Static imports — Vite compiles these to .js bundles with correct MIME types
import { signOut, signInWithPassword, getSession, getProfile, subscribeToTicket, subscribeToTicketStatus, addMessage, getMessages } from '../services/supabase';
import { updateTicketStatus, listTickets, getContact, getUsers, assignTicket, GHLUser, saveKnowledgeBase } from '../services/ghl';

// ---------------------------------------------------------------------------
// Demo mode guard — runtime URL param detection
// IS_DEMO is mutable — set to false after successful agent login
// ---------------------------------------------------------------------------
const _urlParams  = new URLSearchParams(window.location.search);
const _userId     = _urlParams.get('userId') ?? '';
const _locationId = _urlParams.get('locationId') ?? '';
let IS_DEMO = _userId === 'user-legacy' || _locationId === 'location-demo';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let activeFilter: { type: string; value: string } = { type: 'unassigned', value: 'unassigned' };
let activeTicketId: string | null = null;
let activeChannel: any = null;
let activeStatusChannel: any = null;
let currentUserId     = 'user-legacy';
let currentLocationId = 'location-demo';
let agentList: GHLUser[] = [];

// ---------------------------------------------------------------------------
// Demo seed data
// ---------------------------------------------------------------------------
const DEMO_DATA: { tickets: any[]; messages: Record<string, any[]> } = {
  tickets: [
    { id: 'T-DEMO04', ghlOpportunityId: 'opp-04', title: 'Pipeline stage not updating after call',    status: 'in_progress',    priority: 'urgent', category: 'technical', slaDeadline: new Date(Date.now() + 55 * 60000),    assignedTo: 'CL', contact: { name: 'Marcus Reid',   plan: 'Pro',     mrr: 497, memberSince: '2024-06-01', pastTickets: 3, ghlId: 'contact-04' }, aiSummary: { problem: 'Pipeline stage fails to update after call dispositions are logged.', category: 'technical', priority: 'urgent', suggestedAction: 'Check GHL webhook configuration.' } },
    { id: 'T-DEMO01', ghlOpportunityId: 'opp-01', title: 'Automation not triggering on new lead',     status: 'in_progress',    priority: 'high',   category: 'technical', slaDeadline: new Date(Date.now() + 4 * 3600000),   assignedTo: 'AV', contact: { name: 'Sofia Reyes',   plan: 'Growth',  mrr: 297, memberSince: '2024-09-15', pastTickets: 1, ghlId: 'contact-01' }, aiSummary: { problem: 'Welcome email automation stopped firing for new leads.', category: 'technical', priority: 'high', suggestedAction: 'Review workflow trigger settings.' } },
    { id: 'T-DEMO02', ghlOpportunityId: 'opp-02', title: 'Invoice shows incorrect amount',            status: 'waiting_client', priority: 'medium', category: 'billing',   slaDeadline: new Date(Date.now() + 20 * 3600000),  assignedTo: null, contact: { name: 'Daniel Torres', plan: 'Starter', mrr: 97,  memberSince: '2025-01-10', pastTickets: 0, ghlId: 'contact-02' }, aiSummary: { problem: 'Invoice amount does not match expected plan pricing.', category: 'billing', priority: 'medium', suggestedAction: 'Pull invoice and verify plan tier.' } },
    { id: 'T-DEMO05', ghlOpportunityId: 'opp-05', title: 'Need to cancel current plan',              status: 'waiting_internal',priority: 'medium', category: 'billing',   slaDeadline: new Date(Date.now() + 12 * 3600000),  assignedTo: 'LF', contact: { name: 'Priya Nair',    plan: 'Pro',     mrr: 497, memberSince: '2023-11-22', pastTickets: 2, ghlId: 'contact-05' }, aiSummary: { problem: 'Client wants to cancel Pro plan.', category: 'billing', priority: 'medium', suggestedAction: 'Assign to account manager for retention call.' } },
    { id: 'T-DEMO03', ghlOpportunityId: 'opp-03', title: 'How do I add a team member?',               status: 'resolved',       priority: 'low',    category: 'general',   slaDeadline: new Date(Date.now() - 2 * 3600000),   assignedTo: 'AV', contact: { name: 'Kevin Park',    plan: 'Starter', mrr: 97,  memberSince: '2025-03-05', pastTickets: 0, ghlId: 'contact-03' }, aiSummary: { problem: 'Client unsure how to add team members.', category: 'general', priority: 'low', suggestedAction: 'Send knowledge base article.' } },
  ],
  messages: {
    'T-DEMO04': [
      { id: 'm1', role: 'client', content: 'Pipeline stages are not updating after our reps log a call.', isInternal: false, createdAt: new Date(Date.now() - 50 * 60000) },
      { id: 'm2', role: 'ai',     content: "This sounds urgent — pipeline stage failures can block your whole team's workflow. Is this happening for all reps?", isInternal: false, createdAt: new Date(Date.now() - 49 * 60000) },
      { id: 'm3', role: 'client', content: 'All reps. Every call logged, the stage just stays where it was.', isInternal: false, createdAt: new Date(Date.now() - 47 * 60000) },
      { id: 'm4', role: 'agent',  content: "I'm looking into the webhook configuration now. Stand by.", isInternal: false, createdAt: new Date(Date.now() - 20 * 60000) },
      { id: 'm5', role: 'agent',  content: 'INTERNAL: Webhook endpoint returning 500 on GHL side. Escalating if not resolved in 30 min.', isInternal: true, createdAt: new Date(Date.now() - 18 * 60000) },
    ],
    'T-DEMO01': [
      { id: 'm6', role: 'client', content: 'The new lead welcome email workflow stopped firing about 2 hours ago.', isInternal: false, createdAt: new Date(Date.now() - 30 * 60000) },
      { id: 'm7', role: 'ai',     content: "Got it. I've created a ticket and flagged this as high priority.", isInternal: false, createdAt: new Date(Date.now() - 29 * 60000) },
      { id: 'm8', role: 'agent',  content: 'Workflow was paused by a system update. Re-enabling now.', isInternal: false, createdAt: new Date(Date.now() - 10 * 60000) },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PRIORITY_COLORS: Record<string, string> = { urgent: '#ff1744', high: '#ff9100', medium: '#00e5ff', low: '#8fa4b5' };

function slaLabel(deadline: Date) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return 'Overdue';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function slaIsUrgent(deadline: Date) { return (new Date(deadline).getTime() - Date.now()) < 3600000; }
function formatDate(str: string) { return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
function formatTime(date: Date) { return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function formatMRR(val: number | null) { return val != null ? `$${val.toLocaleString()}/mo` : '—'; }
function statusIsWaiting(s: string) { return s === 'waiting_client' || s === 'waiting_internal'; }

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function showAgentLogin() {
  document.getElementById('agentLogin')!.classList.remove('hidden');
  document.getElementById('controlApp')!.classList.add('hidden');
}
function showAgentDenied() {
  document.getElementById('agentLogin')!.classList.remove('hidden');
  document.getElementById('agentLoginForm')!.classList.add('hidden');
  document.getElementById('agentDenied')!.classList.remove('hidden');
  document.getElementById('controlApp')!.classList.add('hidden');
}
function showControlApp() {
  document.getElementById('agentLogin')!.classList.add('hidden');
  document.getElementById('controlApp')!.classList.remove('hidden');
}

async function initAuth() {
  // Demo mode: explicit sentinel values
  if (_userId === 'user-legacy' || _locationId === 'location-demo') {
    IS_DEMO = true;
    currentUserId     = 'user-legacy';
    currentLocationId = 'location-demo';
    console.log('[control] IS_DEMO:', IS_DEMO, '| locationId:', currentLocationId);
    showControlApp();
    return;
  }

  // Set URL-param values as initial fallback
  if (_userId)     currentUserId     = _userId;
  if (_locationId) currentLocationId = _locationId;

  try {
    const session = await getSession();
    if (session) {
      const profile = await getProfile();
      if (!profile || profile.role !== 'agent') {
        await signOut();
        showAgentDenied();
        return;
      }
      // Profile location always wins over URL param
      currentLocationId = profile.location_id || _locationId;
      currentUserId     = profile.id ?? _userId;
      IS_DEMO = false;
    }
    // No session → show app anyway (agent can login inline)
  } catch (err) {
    console.warn('[control] initAuth error:', err);
  }

  console.log('[control] locationId resolved:', currentLocationId);
  console.log('[control] IS_DEMO:', IS_DEMO);
  showControlApp();
}

document.getElementById('agentLoginBtn')!.addEventListener('click', async () => {
  const email    = (document.getElementById('agentEmail') as HTMLInputElement).value.trim();
  const password = (document.getElementById('agentPassword') as HTMLInputElement).value;
  const errorEl  = document.getElementById('agentLoginError')!;
  errorEl.classList.add('hidden');
  if (!email || !password) { errorEl.textContent = 'Email and password are required.'; errorEl.classList.remove('hidden'); return; }
  (document.getElementById('agentLoginBtn') as HTMLButtonElement).disabled = true;
  try {
    await signInWithPassword(email, password);
    await initAuth();
    // After auth resolves locationId, load live tickets
    await fetchLiveTickets();
  } catch (err: any) { errorEl.textContent = err.message ?? 'Sign in failed.'; errorEl.classList.remove('hidden'); (document.getElementById('agentLoginBtn') as HTMLButtonElement).disabled = false; }
});

document.getElementById('agentPassword')!.addEventListener('keydown', (e: Event) => {
  if ((e as KeyboardEvent).key === 'Enter') document.getElementById('agentLoginBtn')!.click();
});

document.getElementById('agentDeniedRetry')!.addEventListener('click', () => {
  document.getElementById('agentLoginForm')!.classList.remove('hidden');
  document.getElementById('agentDenied')!.classList.add('hidden');
  (document.getElementById('agentEmail') as HTMLInputElement).value = '';
  (document.getElementById('agentPassword') as HTMLInputElement).value = '';
  (document.getElementById('agentLoginBtn') as HTMLButtonElement).disabled = false;
});

document.getElementById('signOutBtn')!.addEventListener('click', async () => {
  if (IS_DEMO) return;
  await signOut();
  location.reload();
});

// ---------------------------------------------------------------------------
// Counts + ticket list
// ---------------------------------------------------------------------------
function updateCounts(tickets: any[]) {
  const c: Record<string, number> = { urgent:0, high:0, unassigned:0, billing:0, technical:0, general:0, in_progress:0, waiting:0, resolved:0 };
  tickets.forEach(t => {
    if (t.priority === 'urgent') c.urgent++;
    if (t.priority === 'high')   c.high++;
    if (!t.assignedTo)           c.unassigned++;
    if (t.category === 'billing')    c.billing++;
    if (t.category === 'technical')  c.technical++;
    if (t.category === 'general')    c.general++;
    if (t.status === 'in_progress')  c.in_progress++;
    if (statusIsWaiting(t.status))   c.waiting++;
    if (t.status === 'resolved' || t.status === 'closed') c.resolved++;
  });
  Object.keys(c).forEach(k => { const el = document.getElementById(`count-${k}`); if (el) el.textContent = String(c[k]); });
}

function filterTickets(tickets: any[]) {
  if (!activeFilter) return tickets;
  return tickets.filter(t => {
    if (activeFilter.type === 'all')        return true;
    if (activeFilter.type === 'unassigned') return !t.assignedTo;
    if (activeFilter.type === 'priority')   return t.priority === activeFilter.value;
    if (activeFilter.type === 'category')   return t.category === activeFilter.value;
    if (activeFilter.type === 'status')     return activeFilter.value === 'waiting' ? statusIsWaiting(t.status) : t.status === activeFilter.value;
    return true;
  });
}

function renderTicketList(tickets: any[]) {
  const list = document.getElementById('ticketList')!;
  list.innerHTML = '';
  const filtered = filterTickets(tickets);
  if (filtered.length === 0) { list.innerHTML = '<div class="ticket-list-empty">No tickets match this filter.</div>'; return; }
  filtered.forEach(ticket => {
    const row = document.createElement('button');
    row.className = 'ticket-row' + (ticket.id === activeTicketId ? ' active' : '');
    row.dataset['ticketId'] = ticket.id;
    const urgent = slaIsUrgent(ticket.slaDeadline);
    const displayName  = ticket.contactName ?? ticket.contact?.name ?? 'Unknown';
    const priority     = ticket.priority ?? 'medium';
    const category     = ticket.category ?? 'general';
    const priorityColor = PRIORITY_COLORS[priority] ?? '#8fa4b5';
    row.innerHTML = `
      <div class="ticket-row-top">
        <span class="priority-dot" style="background:${priorityColor}"></span>
        <span class="ticket-row-contact">${displayName}</span>
        ${ticket.assignedTo ? `<span class="agent-avatar">${ticket.assignedTo}</span>` : '<span class="agent-avatar unassigned">—</span>'}
      </div>
      <div class="ticket-row-snippet">${ticket.title}</div>
      <div class="ticket-row-bottom">
        <span class="badge-pill badge-cyan ticket-cat-badge">${category}</span>
        <span class="sla-timer ${urgent ? 'sla-urgent' : ''}">${ticket.slaDeadline ? slaLabel(ticket.slaDeadline) : '—'}</span>
      </div>
    `;
    row.addEventListener('click', () => loadWorkspace(ticket));
    list.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Realtime subscriptions
// ---------------------------------------------------------------------------
async function subscribeWorkspaceTicket(ticketId: string) {
  if (activeChannel) { try { await activeChannel.unsubscribe(); } catch (_) {} activeChannel = null; }
  if (IS_DEMO) return;
  activeChannel = subscribeToTicket(ticketId, currentLocationId, (msg: any) => {
    appendWsBubble(msg);
    document.getElementById('wsThread')!.scrollTop = document.getElementById('wsThread')!.scrollHeight;
    if (msg.role === 'client') flashTicketRow(ticketId);
  });
}

async function subscribeWorkspaceStatus(ghlOpportunityId: string) {
  if (activeStatusChannel) { try { await activeStatusChannel.unsubscribe(); } catch (_) {} activeStatusChannel = null; }
  if (IS_DEMO) return;
  activeStatusChannel = subscribeToTicketStatus(ghlOpportunityId, currentLocationId, (update: any) => {
    const ticket = liveTickets.find((t: any) => t.ghlOpportunityId === ghlOpportunityId);
    if (ticket) ticket.status = update.status;
    renderTicketList(liveTickets);
    updateCounts(liveTickets);
    if (activeTicketId && ticket && ticket.id === activeTicketId) {
      flashTicketRow(activeTicketId);
      showToast(`Status updated: ${update.status.replace('_', ' ')}`);
    }
  });
}

function appendWsBubble(message: any) {
  const thread = document.getElementById('wsThread')!;
  const el = document.createElement('div');
  el.className = `ws-bubble bubble-${message.role}${message.isInternal ? ' bubble-internal' : ''}`;
  el.innerHTML = `
    ${message.isInternal ? '<div class="internal-label">🔒 INTERNAL</div>' : ''}
    <div class="bubble-content">${message.content}</div>
    <div class="bubble-meta">${message.role === 'ai' ? 'LegacyZero' : message.role} · ${formatTime(message.createdAt)}</div>
  `;
  thread.appendChild(el);
}

function flashTicketRow(ticketId: string) {
  const row = document.querySelector(`.ticket-row[data-ticket-id="${ticketId}"]`);
  if (!row) return;
  row.classList.add('flash-cyan');
  setTimeout(() => row.classList.remove('flash-cyan'), 1000);
}

// ---------------------------------------------------------------------------
// Load workspace
// ---------------------------------------------------------------------------
async function loadWorkspace(ticket: any) {
  activeTicketId = ticket.id;
  document.getElementById('wsTicketId')!.textContent      = ticket.id;
  document.getElementById('wsSubject')!.textContent       = ticket.title;
  const s = ticket.aiSummary;
  document.getElementById('aiCategory')!.textContent     = s?.category ?? ticket.category ?? '—';
  const priorityEl = document.getElementById('aiPriority')!;
  const priorityVal = s?.priority ?? ticket.priority ?? '—';
  priorityEl.textContent = priorityVal;
  const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#f87171',
    high:   '#FDA929',
    medium: '#00e5ff',
    low:    '#8fa4b5',
  };
  priorityEl.style.color = PRIORITY_COLORS[priorityVal] ?? '';
  document.getElementById('aiSLA')!.textContent          = slaLabel(ticket.slaDeadline);
  const summaryTextEl = document.getElementById('aiSummaryText')!;
  summaryTextEl.textContent  = s?.problem || 'No summary available.';
  // Suggested action — append below summary if present
  const existingAction = document.getElementById('aiSuggestedAction');
  if (existingAction) existingAction.remove();
  if (s?.suggestedAction) {
    const actionEl = document.createElement('p');
    actionEl.id = 'aiSuggestedAction';
    actionEl.style.cssText = 'margin-top:6px;font-size:0.8rem;color:#8fa4b5;font-style:italic;';
    actionEl.textContent = `→ ${s.suggestedAction}`;
    summaryTextEl.insertAdjacentElement('afterend', actionEl);
  }
  // Seed context strip immediately with available data, then hydrate from GHL
  const c = ticket.contact;
  document.getElementById('ctxName')!.textContent        = c?.name ?? ticket.contactName ?? '—';
  document.getElementById('ctxPlanBadge')!.textContent   = c?.plan ?? '—';
  document.getElementById('ctxMRR')!.textContent         = formatMRR(c?.mrr ?? null);
  document.getElementById('ctxSince')!.textContent       = c?.memberSince ? formatDate(c.memberSince) : '—';
  document.getElementById('ctxPastTickets')!.textContent = String(c?.pastTickets ?? 0);
  const ghlId = c?.ghlId ?? ticket.ghlContactId;
  (document.getElementById('ctxGHLLink') as HTMLAnchorElement).href = ghlId ? `https://app.gohighlevel.com/contacts/${ghlId}` : '#';

  // Async hydrate contact from GHL if we have a real contact ID and not in demo
  if (!IS_DEMO && ticket.ghlContactId) {
    getContact(ticket.ghlContactId).then(contact => {
      if (activeTicketId !== ticket.id) return; // ticket changed while fetching
      document.getElementById('ctxName')!.textContent = contact.name ?? '—';
      (document.getElementById('ctxGHLLink') as HTMLAnchorElement).href =
        `https://app.gohighlevel.com/contacts/${contact.ghlContactId}`;
    }).catch(err => console.warn('[loadWorkspace] contact fetch failed:', err));
  }
  // Show workspace content immediately
  document.getElementById('workspaceEmpty')!.classList.add('hidden');
  const content = document.getElementById('workspaceContent')!;
  content.classList.remove('hidden');
  content.style.opacity = '0';
  requestAnimationFrame(() => { content.style.transition = 'opacity 0.2s ease'; content.style.opacity = '1'; });
  renderTicketList(liveTickets);

  // Load thread messages
  if (IS_DEMO) {
    renderWsThread(DEMO_DATA.messages[ticket.id] ?? []);
  } else {
    // Show loading state while fetching
    const thread = document.getElementById('wsThread')!;
    thread.innerHTML = '<div style="padding:16px;opacity:0.6;text-align:center;">Loading conversation…</div>';
    try {
      // Tickets created via chat flow: messages stored under ghlOpportunityId
      const msgs = await getMessages(ticket.ghlOpportunityId ?? ticket.id, currentLocationId);
      if (activeTicketId !== ticket.id) return; // ticket changed while fetching
      if (msgs.length === 0) {
        thread.innerHTML = '<div style="padding:16px;opacity:0.5;text-align:center;">No messages yet for this ticket.</div>';
      } else {
        renderWsThread(msgs);
      }
    } catch (err) {
      console.error('[loadWorkspace] getMessages failed:', err);
      if (activeTicketId !== ticket.id) return;
      thread.innerHTML = '<div style="padding:16px;opacity:0.5;text-align:center;">Could not load messages.</div>';
    }
  }

  await subscribeWorkspaceTicket(ticket.id);
  await subscribeWorkspaceStatus(ticket.ghlOpportunityId);
}

function renderWsThread(messages: any[]) {
  const thread = document.getElementById('wsThread')!;
  thread.innerHTML = '';
  messages.forEach(msg => {
    const el = document.createElement('div');
    el.className = `ws-bubble bubble-${msg.role}${msg.isInternal ? ' bubble-internal' : ''}`;
    el.innerHTML = `
      ${msg.isInternal ? '<div class="internal-label">🔒 INTERNAL</div>' : ''}
      <div class="bubble-content">${msg.content}</div>
      <div class="bubble-meta">${msg.role === 'ai' ? 'LegacyZero' : msg.role} · ${formatTime(msg.createdAt)}</div>
    `;
    thread.appendChild(el);
  });
  thread.scrollTop = thread.scrollHeight;
}

function showWorkspaceEmpty() {
  document.getElementById('workspaceContent')!.classList.add('hidden');
  document.getElementById('workspaceEmpty')!.classList.remove('hidden');
  activeTicketId = null;
  if (activeChannel)       { activeChannel.unsubscribe().catch(() => {}); activeChannel = null; }
  if (activeStatusChannel) { activeStatusChannel.unsubscribe().catch(() => {}); activeStatusChannel = null; }
}

// ---------------------------------------------------------------------------
// Queue filter
// ---------------------------------------------------------------------------
document.querySelectorAll('.queue-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.queue-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    activeFilter = { type: (item as HTMLElement).dataset['filter']!, value: (item as HTMLElement).dataset['value']! };
    renderTicketList(liveTickets);
  });
});

// ---------------------------------------------------------------------------
// Input area
// ---------------------------------------------------------------------------
const replyInput = document.getElementById('wsReplyInput') as HTMLTextAreaElement;
replyInput.addEventListener('input', () => {
  replyInput.style.height = 'auto';
  replyInput.style.height = Math.min(replyInput.scrollHeight, 160) + 'px';
});

function setWsInputBusy(busy: boolean) {
  ['btnSendReply','btnAddNote','wsReplyInput'].forEach(id => { (document.getElementById(id) as HTMLButtonElement | HTMLTextAreaElement).disabled = busy; });
}

function showWsError(msg: string) {
  let el = document.getElementById('wsInputError');
  if (!el) { el = document.createElement('p'); el.id = 'wsInputError'; el.className = 'ws-input-error'; document.querySelector('.ws-input-area')!.appendChild(el); }
  el.textContent = msg; el.classList.remove('hidden');
  setTimeout(() => el?.classList.add('hidden'), 4000);
}

function showKBPrompt(ticket: any) {
  document.getElementById('kbPrompt')?.remove();
  const prompt = document.createElement('div');
  prompt.id = 'kbPrompt';
  prompt.className = 'kb-prompt glass-card';
  const problem  = ticket.aiSummary?.problem  ?? ticket.title ?? '';
  const category = ticket.aiSummary?.category ?? ticket.category ?? 'general';
  prompt.innerHTML = `
    <p class="kb-prompt-title">💡 Save this resolution to the knowledge base?</p>
    <label class="kb-label">Problem</label>
    <textarea id="kbProblem" class="kb-textarea" rows="2">${problem}</textarea>
    <label class="kb-label">Solution</label>
    <textarea id="kbSolution" class="kb-textarea" rows="3" placeholder="Describe what resolved this ticket..."></textarea>
    <label class="kb-label">Tags <span class="kb-optional">(optional, comma-separated)</span></label>
    <input id="kbTags" class="kb-input" type="text" placeholder="e.g. automation, webhook">
    <div class="kb-actions">
      <button id="kbSaveBtn" class="btn-gold kb-save-btn">Save to KB</button>
      <button id="kbSkipBtn" class="kb-skip-btn">Skip</button>
    </div>
  `;
  document.querySelector('.workspace-panel')?.appendChild(prompt);

  document.getElementById('kbSkipBtn')!.addEventListener('click', () => prompt.remove());
  document.getElementById('kbSaveBtn')!.addEventListener('click', async () => {
    const problemVal  = (document.getElementById('kbProblem')  as HTMLTextAreaElement).value.trim();
    const solutionVal = (document.getElementById('kbSolution') as HTMLTextAreaElement).value.trim();
    const tagsVal     = (document.getElementById('kbTags')     as HTMLInputElement).value.trim();
    if (!solutionVal) { showWsError('Please enter the solution before saving.'); return; }
    const tags = tagsVal ? tagsVal.split(',').map(t => t.trim()).filter(Boolean) : [];
    (document.getElementById('kbSaveBtn') as HTMLButtonElement).disabled = true;
    try {
      await saveKnowledgeBase({
        ticketId:   ticket.id,
        locationId: currentLocationId,
        problem:    problemVal,
        solution:   solutionVal,
        category,
        tags,
        createdBy:  currentUserId,
      });
      prompt.remove();
      showToast('Saved to knowledge base ✓');
    } catch (e: any) {
      showWsError(e.message ?? 'KB save failed.');
      (document.getElementById('kbSaveBtn') as HTMLButtonElement).disabled = false;
    }
  });
}

async function handleSendReply() {
  if (!activeTicketId) return;
  const text = replyInput.value.trim(); if (!text) return;
  setWsInputBusy(true);
  const fakeMsg = { id: `opt-${Date.now()}`, role: 'agent', content: text, isInternal: false, createdAt: new Date() };
  appendWsBubble(fakeMsg);
  const optEl = document.getElementById('wsThread')!.lastElementChild as HTMLElement | null;
  replyInput.value = ''; replyInput.style.height = '';
  try { if (!IS_DEMO) await addMessage(activeTicketId, 'agent', text, currentLocationId, false); }
  catch (err: any) { optEl?.remove(); replyInput.value = text; showWsError(err.message ?? 'Failed to send reply.'); }
  finally { setWsInputBusy(false); replyInput.focus(); }
}

async function handleAddNote() {
  if (!activeTicketId) return;
  const text = replyInput.value.trim(); if (!text) return;
  setWsInputBusy(true);
  const fakeNote = { id: `opt-note-${Date.now()}`, role: 'agent', content: text, isInternal: true, createdAt: new Date() };
  appendWsBubble(fakeNote);
  const optEl = document.getElementById('wsThread')!.lastElementChild as HTMLElement | null;
  replyInput.value = ''; replyInput.style.height = '';
  try { if (!IS_DEMO) await addMessage(activeTicketId, 'agent', text, currentLocationId, true); }
  catch (err: any) { optEl?.remove(); replyInput.value = text; showWsError(err.message ?? 'Failed to save note.'); }
  finally { setWsInputBusy(false); replyInput.focus(); }
}

document.getElementById('btnSendReply')!.addEventListener('click', handleSendReply);
document.getElementById('btnAddNote')!.addEventListener('click', handleAddNote);
replyInput.addEventListener('keydown', (e: Event) => {
  if ((e as KeyboardEvent).key === 'Enter' && !(e as KeyboardEvent).shiftKey) { e.preventDefault(); handleSendReply(); }
});

// ---------------------------------------------------------------------------
// Ticket actions
// ---------------------------------------------------------------------------
// agentList populated at init — see fetchAgentList()

function setActionsBusy(busy: boolean) {
  ['btnAssign','btnEscalate','btnResolve','btnClose'].forEach(id => { const el = document.getElementById(id); if (el) (el as HTMLButtonElement).disabled = busy; });
}

function showToast(msg: string, color = 'cyan') {
  let toast = document.getElementById('actionToast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'actionToast'; toast.className = 'action-toast'; document.body.appendChild(toast); }
  toast.textContent = msg;
  toast.className = `action-toast toast-${color} toast-visible`;
  clearTimeout((toast as any)._hideTimer);
  (toast as any)._hideTimer = setTimeout(() => toast!.classList.remove('toast-visible'), 2000);
}

function mutateTicketStatus(ticketId: string, newStatus: string) {
  const ticket = liveTickets.find((t: any) => t.id === ticketId);
  if (ticket) ticket.status = newStatus;
}

function removeTicketFromList(ticketId: string) {
  liveTickets = liveTickets.filter((t: any) => t.id !== ticketId);
}

document.getElementById('btnAssign')!.addEventListener('click', () => {
  document.getElementById('assignDropdown')?.remove();
  const btn = document.getElementById('btnAssign')!;
  const dropdown = document.createElement('div');
  dropdown.id = 'assignDropdown'; dropdown.className = 'assign-dropdown glass-card';

  // Use live agentList; fall back to stubs if not loaded yet
  const options = agentList.length > 0
    ? agentList
    : [{ id: '', name: 'Legacy', email: '' }, { id: '', name: 'Cesar', email: '' }, { id: '', name: 'Antonio', email: '' }];

  options.forEach(agent => {
    const opt = document.createElement('button');
    opt.className = 'assign-option';
    opt.textContent = agent.name;
    opt.addEventListener('click', async () => {
      dropdown.remove();
      if (!activeTicketId) return;
      setActionsBusy(true);
      try {
        if (!IS_DEMO) {
          await assignTicket(activeTicketId, agent.id);
          if (liveTickets.find((t: any) => t.status === 'new' && t.id === activeTicketId)) {
            await updateTicketStatus(activeTicketId, 'triaged');
          }
        }
        const ticket = liveTickets.find((t: any) => t.id === activeTicketId);
        if (ticket) {
          ticket.assignedTo = agent.name.slice(0, 2).toUpperCase();
          ticket.assignedUserId = agent.id;
          if (ticket.status === 'new') ticket.status = 'triaged';
        }
        renderTicketList(liveTickets);
        showToast(`Assigned to ${agent.name}`);
      } catch (err: any) { showWsError(err.message ?? 'Assign failed.'); }
      finally { setActionsBusy(false); }
    });
    dropdown.appendChild(opt);
  });
  const rect = btn.getBoundingClientRect();
  dropdown.style.top  = `${rect.bottom + window.scrollY + 4}px`;
  dropdown.style.left = `${rect.left  + window.scrollX}px`;
  document.body.appendChild(dropdown);
  const closeOnOutside = (e: Event) => { if (!dropdown.contains(e.target as Node) && e.target !== btn) { dropdown.remove(); document.removeEventListener('click', closeOnOutside); } };
  setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
});

document.getElementById('btnEscalate')!.addEventListener('click', async () => {
  if (!activeTicketId) return; setActionsBusy(true);
  try {
    if (!IS_DEMO) await updateTicketStatus(activeTicketId, 'escalated');
    mutateTicketStatus(activeTicketId, 'escalated');
    renderTicketList(liveTickets); updateCounts(liveTickets);
    showToast('Escalated → GHL synced', 'gold');
  }
  catch (err: any) { showWsError(err.message ?? 'Escalate failed.'); }
  finally { setActionsBusy(false); }
});

document.getElementById('btnResolve')!.addEventListener('click', async () => {
  if (!activeTicketId) return; setActionsBusy(true);
  const resolvedTicketId = activeTicketId;
  try {
    if (!IS_DEMO) await updateTicketStatus(resolvedTicketId, 'resolved');
    mutateTicketStatus(resolvedTicketId, 'resolved');
    renderTicketList(liveTickets); updateCounts(liveTickets);
    showToast('Resolved ✓ — GHL marked Won');
    // Show KB capture prompt with ticket context
    const ticket = liveTickets.find((t: any) => t.id === resolvedTicketId);
    if (ticket) showKBPrompt(ticket);
  }
  catch (err: any) { showWsError(err.message ?? 'Resolve failed.'); }
  finally { setActionsBusy(false); }
});

document.getElementById('btnClose')!.addEventListener('click', async () => {
  if (!activeTicketId) return; setActionsBusy(true);
  try {
    if (!IS_DEMO) await updateTicketStatus(activeTicketId, 'closed');
    removeTicketFromList(activeTicketId);
    renderTicketList(liveTickets); updateCounts(liveTickets);
    showToast('Closed — GHL marked Lost', 'gold');
    showWorkspaceEmpty();
  }
  catch (err: any) { showWsError(err.message ?? 'Close failed.'); setActionsBusy(false); }
});

// ---------------------------------------------------------------------------
// Live ticket loader
// ---------------------------------------------------------------------------
let liveTickets: any[] = [];

function showTicketListLoading() {
  const list = document.getElementById('ticketList')!;
  list.innerHTML = '<div class="ticket-list-empty" style="padding:16px;opacity:0.6;">Loading tickets…</div>';
}

function showTicketListError(onRetry: () => void) {
  const list = document.getElementById('ticketList')!;
  list.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'ticket-list-empty';
  msg.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:8px;align-items:flex-start;';
  msg.innerHTML = '<span style="opacity:0.7;">Could not load tickets.</span>';
  const btn = document.createElement('button');
  btn.className = 'ws-btn';
  btn.textContent = 'Retry';
  btn.addEventListener('click', onRetry);
  msg.appendChild(btn);
  list.appendChild(msg);
}

async function fetchLiveTickets() {
  if (IS_DEMO) {
    liveTickets = DEMO_DATA.tickets;
    updateCounts(liveTickets);
    renderTicketList(liveTickets);
    const first = liveTickets.find((t: any) => !t.assignedTo) ?? liveTickets[0];
    if (first) await loadWorkspace(first);
    return;
  }

  showTicketListLoading();
  try {
    const tickets = await listTickets({ locationId: currentLocationId, limit: 50 });
    liveTickets = tickets;
    updateCounts(liveTickets);
    // Activate unassigned filter in the queue UI
    document.querySelectorAll('.queue-item').forEach(i => i.classList.remove('active'));
    document.querySelector('.queue-item[data-filter="unassigned"][data-value="unassigned"]')?.classList.add('active');
    renderTicketList(liveTickets);
    // Open first unassigned ticket, fallback to first ticket overall
    const first = liveTickets.find((t: any) => !t.assignedTo) ?? liveTickets[0];
    if (first) await loadWorkspace(first);
  } catch (err) {
    console.error('[control] fetchLiveTickets error:', err);
    showTicketListError(fetchLiveTickets);
  }
}

// ---------------------------------------------------------------------------
// Auto-refresh + manual refresh
// ---------------------------------------------------------------------------
let refreshInterval: ReturnType<typeof setInterval> | null = null;

async function silentRefresh() {
  if (IS_DEMO) return;
  try {
    const fresh = await listTickets({ locationId: currentLocationId, limit: 50 });
    const prevIds = new Set(liveTickets.map((t: any) => t.id));
    const newIds   = new Set(fresh.map((t: any) => t.id));

    // Find tickets that are truly new
    const addedIds = [...newIds].filter(id => !prevIds.has(id));

    if (fresh.length !== liveTickets.length || addedIds.length > 0) {
      liveTickets = fresh;
      updateCounts(liveTickets);
      renderTicketList(liveTickets);

      // Flash new ticket rows
      addedIds.forEach(id => {
        const row = document.querySelector(`.ticket-row[data-ticket-id="${id}"]`);
        if (row) {
          row.classList.add('flash-cyan');
          setTimeout(() => row.classList.remove('flash-cyan'), 1500);
        }
      });

      if (addedIds.length > 0) {
        console.log('[control] silentRefresh: new tickets detected:', addedIds);
      }
    }
  } catch (err) {
    console.warn('[control] silentRefresh error:', err);
  }
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(silentRefresh, 30000);
}

// Manual refresh button
document.getElementById('refreshTicketsBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('refreshTicketsBtn')!;
  btn.classList.add('spinning');
  await fetchLiveTickets();
  setTimeout(() => btn.classList.remove('spinning'), 400);
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function fetchAgentList() {
  try {
    agentList = await getUsers();
    console.log('[control] loaded', agentList.length, 'agents');
  } catch (e) {
    console.warn('[control] failed to load agent list:', e);
    agentList = [];
  }
}

async function init() {
  await initAuth();
  await Promise.all([fetchLiveTickets(), fetchAgentList()]);
  startAutoRefresh();
}

init();
