// Static imports — Vite compiles these to .js bundles with correct MIME types
import { sendMagicLink, signOut, subscribeToTicket, addMessage, getMessages, rekeyMessages } from '../services/supabase';
import { continueConversation, triageConversation } from '../services/legacyzero';
import { createTicket, listTickets, fetchMyTickets, MyTicketItem, MyTicketsGroup } from '../services/ghl';

// ---------------------------------------------------------------------------
// Demo mode guard — runtime URL param detection
// ---------------------------------------------------------------------------
const _urlParams  = new URLSearchParams(window.location.search);
const _userId     = _urlParams.get('userId') ?? '';
const _locationId = _urlParams.get('locationId') ?? '';
const _userName   = _urlParams.get('userName') ?? '';
const _userEmail  = _urlParams.get('userEmail') ?? '';
const IS_DEMO = _userId === 'user-legacy' || _locationId === 'location-demo';

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------
let currentUserId     = 'user-legacy';
let currentLocationId = 'location-demo';

// ---------------------------------------------------------------------------
// Demo seed data
// ---------------------------------------------------------------------------
const DEMO_DATA: {
  tickets: any[];
  messages: Record<string, any[]>;
} = {
  tickets: [
    { id: 'T-DEMO01', ghlOpportunityId: 'opp-01', title: 'Automation not triggering on new lead',     status: 'in_progress',    priority: 'high',   category: 'technical', slaDeadline: new Date(Date.now() + 4 * 3600000) },
    { id: 'T-DEMO02', ghlOpportunityId: 'opp-02', title: 'Invoice shows incorrect amount',            status: 'waiting_client', priority: 'medium', category: 'billing',   slaDeadline: new Date(Date.now() + 20 * 3600000) },
    { id: 'T-DEMO03', ghlOpportunityId: 'opp-03', title: 'How do I add a team member?',               status: 'resolved',       priority: 'low',    category: 'general',   slaDeadline: new Date(Date.now() - 2 * 3600000) },
    { id: 'T-DEMO04', ghlOpportunityId: 'opp-04', title: 'Pipeline stage not updating after call',    status: 'new',            priority: 'urgent', category: 'technical', slaDeadline: new Date(Date.now() + 1 * 3600000) },
    { id: 'T-DEMO05', ghlOpportunityId: 'opp-05', title: 'Need to cancel current plan',               status: 'waiting_internal', priority: 'medium', category: 'billing', slaDeadline: new Date(Date.now() + 12 * 3600000) },
  ],
  messages: {
    'T-DEMO01': [
      { id: 'm1', role: 'ai',     content: "Hi! I'm LegacyZero. I see you're having trouble with automation triggers. Can you tell me which workflow is affected?", isInternal: false, createdAt: new Date(Date.now() - 30 * 60000) },
      { id: 'm2', role: 'client', content: 'The "New Lead — Send Welcome Email" workflow. It stopped firing about 2 hours ago.',                                 isInternal: false, createdAt: new Date(Date.now() - 28 * 60000) },
      { id: 'm3', role: 'ai',     content: "Got it. I've flagged this as high priority and created a ticket. An agent will review the workflow logs shortly.",    isInternal: false, createdAt: new Date(Date.now() - 27 * 60000) },
      { id: 'm4', role: 'agent',  content: 'I can see the workflow was paused by a system update. Re-enabling it now — should be firing within 5 minutes.',      isInternal: false, createdAt: new Date(Date.now() - 10 * 60000) },
    ],
    'T-DEMO04': [
      { id: 'm5', role: 'ai',     content: "This looks urgent — pipeline stages not updating can block your whole team. Is this happening on all contacts or a specific one?", isInternal: false, createdAt: new Date(Date.now() - 5 * 60000) },
      { id: 'm6', role: 'client', content: 'All contacts after a logged call. The stage just stays where it was.',                                                            isInternal: false, createdAt: new Date(Date.now() - 3 * 60000) },
    ],
  },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let activeTicketId: string | null = null;
let activeChannel: any = null;
let liveTickets: any[] = [];
let myTicketsCache: MyTicketItem[] = [];
const renderedMsgIds = new Set<string>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function statusGroup(status: string) {
  if (['new', 'triaged', 'in_progress'].includes(status))                        return 'open';
  if (['waiting_client', 'waiting_internal', 'escalated'].includes(status))      return 'waiting';
  return 'resolved';
}

function statusBadgeClass(status: string) {
  const g = statusGroup(status);
  return g === 'open' ? 'badge-cyan' : g === 'waiting' ? 'badge-gold' : 'badge-green';
}

function slaLabel(deadline: Date) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return 'SLA: Overdue';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `SLA: ${h}h ${m}m` : `SLA: ${m}m`;
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '';
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 60000)   return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function showLoginScreen() {
  document.getElementById('loginScreen')!.classList.remove('hidden');
  document.getElementById('chatApp')!.classList.add('hidden');
}

function showApp() {
  document.getElementById('loginScreen')!.classList.add('hidden');
  document.getElementById('chatApp')!.classList.remove('hidden');
}

async function initAuth() {
  if (IS_DEMO) {
    currentUserId     = 'user-legacy';
    currentLocationId = 'location-demo';
    showApp();
    return;
  }
  if (!_userId || !_locationId) {
    const card = document.querySelector('.login-card')!;
    document.getElementById('loginScreen')!.classList.remove('hidden');
    document.getElementById('loginInputState')!.classList.add('hidden');
    const denied = document.createElement('div');
    denied.className = 'login-denied';
    denied.innerHTML = '<span class="denied-icon">🔒</span><p class="confirm-text">Access denied — missing identity parameters.</p>';
    card.appendChild(denied);
    document.getElementById('chatApp')!.classList.add('hidden');
    return;
  }
  currentUserId     = _userId;
  currentLocationId = _locationId;
  showApp();
}

document.getElementById('loginSendBtn')!.addEventListener('click', async () => {
  const email   = (document.getElementById('loginEmail') as HTMLInputElement).value.trim();
  const errorEl = document.getElementById('loginError')!;
  errorEl.classList.add('hidden');
  if (!email) { errorEl.textContent = 'Please enter your email address.'; errorEl.classList.remove('hidden'); return; }
  (document.getElementById('loginSendBtn') as HTMLButtonElement).disabled = true;
  try {
    await sendMagicLink(email);
    document.getElementById('loginInputState')!.classList.add('hidden');
    document.getElementById('loginConfirm')!.classList.remove('hidden');
  } catch (err: any) {
    errorEl.textContent = err.message ?? 'Something went wrong. Please try again.';
    errorEl.classList.remove('hidden');
    (document.getElementById('loginSendBtn') as HTMLButtonElement).disabled = false;
  }
});

document.getElementById('loginEmail')!.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') document.getElementById('loginSendBtn')!.click();
});

document.getElementById('signOutBtn')!.addEventListener('click', async () => {
  if (IS_DEMO) return;
  await signOut();
  location.reload();
});

// ---------------------------------------------------------------------------
// Render sidebar
// ---------------------------------------------------------------------------
function renderSidebar(tickets: any[]) {
  const groups: Record<string, any[]> = { open: [], waiting: [], resolved: [] };
  tickets.forEach(t => groups[statusGroup(t.status)].push(t));
  ['open', 'waiting', 'resolved'].forEach(group => {
    const container = document.getElementById(`sidebar-${group}`)!;
    const label = container.querySelector('.sidebar-group-label')!;
    container.innerHTML = '';
    container.appendChild(label);
    groups[group].forEach(ticket => {
      const row = document.createElement('button');
      row.className = 'sidebar-ticket-row' + (ticket.id === activeTicketId ? ' active' : '');
      row.dataset['ticketId'] = ticket.id;
      const truncTitle = (ticket.title ?? 'Untitled').length > 48
        ? (ticket.title as string).slice(0, 48) + '…'
        : (ticket.title ?? 'Untitled');
      row.innerHTML = `
        <span class="ticket-row-subject">${truncTitle}</span>
        <span class="ticket-row-meta">
          <span class="badge-pill ${statusBadgeClass(ticket.status)} ticket-row-badge">${ticket.status.replace(/_/g, ' ')}</span>
          <span class="ticket-row-time">${timeAgo(ticket.createdAt)}</span>
        </span>
      `;
      row.addEventListener('click', () => loadTicket(ticket));
      container.appendChild(row);
    });
  });
}

// ---------------------------------------------------------------------------
// My Tickets sidebar — Supabase-backed, grouped Open/Waiting/Resolved
// ---------------------------------------------------------------------------
function renderMyTicketsSidebar(grouped: MyTicketsGroup): void {
  const STATUS_LABELS: Record<string, string> = {
    new:              'New',
    triaged:          'Triaged',
    in_progress:      'In Progress',
    waiting_client:   'Waiting',
    waiting_internal: 'Waiting',
    escalated:        'Escalated',
    resolved:         'Resolved',
    closed:           'Closed',
  };
  const STATUS_COLORS: Record<string, string> = {
    new:              '#06b6d4',
    triaged:          '#a78bfa',
    in_progress:      '#3b82f6',
    waiting_client:   '#f59e0b',
    waiting_internal: '#f97316',
    escalated:        '#ef4444',
    resolved:         '#22c55e',
    closed:           '#6b7280',
  };

  const renderItem = (t: MyTicketItem): string => {
    const truncTitle = t.title.length > 34 ? t.title.slice(0, 34) + '…' : t.title;
    const color      = STATUS_COLORS[t.status] ?? '#8fa4b5';
    const label      = STATUS_LABELS[t.status] ?? t.status;
    return `
      <button class="sidebar-ticket-item" data-ticket-id="${t.id}"
        onclick="window.handleSidebarTicketClick('${t.id}')">
        <div class="sidebar-ticket-row">
          <span class="sidebar-ticket-title">${truncTitle}</span>
          <span class="sidebar-ticket-badge" style="color:${color}">${label}</span>
        </div>
        <span class="sidebar-ticket-time">${timeAgo(t.updated_at)}</span>
      </button>`;
  };

  const inject = (id: string, items: MyTicketItem[]) => {
    const container = document.getElementById(id);
    if (!container) { console.warn('[chat] sidebar container not found:', id); return; }
    // Keep the existing label element, replace the rest
    const labelEl = container.querySelector('.sidebar-group-label');
    container.innerHTML = '';
    if (labelEl) container.appendChild(labelEl);
    const itemsHtml = items.length
      ? items.map(renderItem).join('')
      : '<div class="sidebar-empty">No tickets</div>';
    container.insertAdjacentHTML('beforeend', itemsHtml);
  };

  inject('sidebar-open',     grouped.open);
  inject('sidebar-waiting',  grouped.waiting);
  inject('sidebar-resolved', grouped.resolved);
}

async function loadMyTickets(): Promise<void> {
  if (IS_DEMO || !currentUserId || !currentLocationId) return;
  try {
    const grouped = await fetchMyTickets(currentUserId, currentLocationId);
    myTicketsCache = [...grouped.open, ...grouped.waiting, ...grouped.resolved];
    renderMyTicketsSidebar(grouped);
  } catch (err) {
    console.warn('[chat] loadMyTickets failed:', err);
  }
}

(window as any).handleSidebarTicketClick = async function (ticketId: string): Promise<void> {
  const ticket = myTicketsCache.find(t => t.id === ticketId);
  if (!ticket) { console.warn('[chat] ticket not found in cache:', ticketId); return; }
  document.querySelectorAll('.sidebar-ticket-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.sidebar-ticket-item[data-ticket-id="${ticketId}"]`)?.classList.add('active');
  await loadTicket(ticket);
};

function renderThread(messages: any[]) {
  const thread = document.getElementById('messageThread')!;
  thread.innerHTML = '';
  messages.forEach(msg => {
    const el = document.createElement('div');
    el.className = `message-bubble bubble-${msg.role}`;
    el.innerHTML = `
      <div class="bubble-content">${msg.content}</div>
      <div class="bubble-meta">${msg.role === 'ai' ? 'LegacyZero' : msg.role} · ${formatTime(msg.createdAt)}</div>
    `;
    thread.appendChild(el);
  });
  thread.scrollTop = thread.scrollHeight;
}

// ---------------------------------------------------------------------------
// Realtime subscription
// ---------------------------------------------------------------------------
async function subscribeTicket(ticketId: string) {
  if (activeChannel) { try { await activeChannel.unsubscribe(); } catch (_) {} activeChannel = null; }
  if (IS_DEMO) return;
  activeChannel = subscribeToTicket(ticketId, currentLocationId, (msg: any) => {
    appendThreadBubble(msg.role, msg.content, msg.id);
  });
}

// ---------------------------------------------------------------------------
// Load ticket
// ---------------------------------------------------------------------------
async function loadTicket(ticket: any) {
  activeTicketId = ticket.id;
  renderedMsgIds.clear();
  document.getElementById('activeTicketId')!.textContent      = ticket.id;
  document.getElementById('activeTicketSubject')!.textContent = ticket.title;
  document.getElementById('slaBadge')!.textContent            = slaLabel(ticket.slaDeadline);
  document.getElementById('welcomeState')!.classList.add('hidden');
  document.getElementById('threadState')!.classList.remove('hidden');
  // Load messages from Supabase in live mode; fall back to demo data
  if (IS_DEMO) {
    renderThread(DEMO_DATA.messages[ticket.id] || []);
  } else {
    renderThread([]);
    try {
      const msgs = await getMessages(ticket.id, currentLocationId);
      if (activeTicketId === ticket.id) renderThread(msgs);
    } catch (e) {
      console.warn('[loadTicket] failed to load messages:', e);
    }
  }
  renderSidebar(IS_DEMO ? DEMO_DATA.tickets : liveTickets);
  await subscribeTicket(ticket.id);
}

// ---------------------------------------------------------------------------
// Intake flow
// ---------------------------------------------------------------------------
let intakeMessages: any[] = [];
let aiResponseCount = 0;
let isSending = false;
let intakeTempTicketId = '';

const DEMO_AI_RESPONSES = [
  "Thanks for reaching out. Can you tell me a bit more about the issue — when did it start and what exactly are you seeing?",
  "Got it. Is this affecting just you, or others on your team too?",
  "I have enough context now. I've flagged this as a priority issue and created a support ticket. An agent will follow up shortly.",
];

const DEMO_TRIAGE_RESULT = { category: 'technical' as const, priority: 'medium' as const, problem: 'User-reported issue.', suggestedAction: 'Agent to review.' };

async function mockAIResponse(index: number) {
  await new Promise(r => setTimeout(r, 400));
  return DEMO_AI_RESPONSES[Math.min(index, DEMO_AI_RESPONSES.length - 1)];
}

function appendIntakeBubble(role: string, content: string) {
  const wrap = document.getElementById('welcomeInputWrap')!;
  let thread = document.getElementById('intakeThread') as HTMLElement | null;
  if (!thread) {
    thread = document.createElement('div');
    thread.id = 'intakeThread';
    thread.className = 'intake-thread';
    wrap.parentElement!.insertBefore(thread, wrap);
  }
  const el = document.createElement('div');
  el.className = `message-bubble bubble-${role}`;
  el.innerHTML = `<div class="bubble-content">${content}</div><div class="bubble-meta">${role === 'ai' ? 'LegacyZero' : role} · ${formatTime(new Date())}</div>`;
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
}

function showTyping(parentId: string) {
  const thread = document.getElementById(parentId);
  const el = document.createElement('div');
  el.id = 'typingIndicator';
  el.className = 'message-bubble bubble-ai typing-indicator';
  el.innerHTML = `<div class="bubble-content"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  if (thread) thread.appendChild(el);
}

function removeTyping() { document.getElementById('typingIndicator')?.remove(); }

function setSending(val: boolean) {
  isSending = val;
  ['welcomeSendBtn','welcomeInput','threadSendBtn','threadInput'].forEach(id => {
    (document.getElementById(id) as HTMLButtonElement | HTMLTextAreaElement).disabled = val;
  });
}

async function handleWelcomeSend() {
  if (isSending) return;
  const input = document.getElementById('welcomeInput') as HTMLTextAreaElement;
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = '';
  setSending(true);
  // Assign a stable temp ID for this intake session
  if (!intakeTempTicketId) intakeTempTicketId = `intake-${currentUserId}-${Date.now()}`;
  const clientMsg = { id: `intake-${Date.now()}`, role: 'client', content: text, isInternal: false, createdAt: new Date() };
  intakeMessages.push(clientMsg);
  appendIntakeBubble('client', text);
  // Persist intake message immediately — don't wait for ticket creation
  if (!IS_DEMO) {
    addMessage(intakeTempTicketId, 'client', text, currentLocationId, false).catch(e =>
      console.error('[intake] addMessage client error:', e)
    );
  }
  showTyping('intakeThread');
  try {
    console.log('[intake] passing', intakeMessages.length, 'messages to continueConversation');
    const aiText = IS_DEMO ? await mockAIResponse(aiResponseCount) : await continueConversation(intakeMessages, text);
    removeTyping();
    aiResponseCount++;
    const aiMsg = { id: `intake-ai-${Date.now()}`, role: 'ai', content: aiText, isInternal: false, createdAt: new Date() };
    intakeMessages.push(aiMsg);
    appendIntakeBubble('ai', aiText);
    // Persist AI response immediately
    if (!IS_DEMO) {
      addMessage(intakeTempTicketId, 'ai', aiText, currentLocationId, false).catch(e =>
        console.error('[intake] addMessage ai error:', e)
      );
    }
    console.log('[intake] aiResponseCount:', aiResponseCount);
    if (aiResponseCount >= 2) await createTicketFromIntake();
  } catch (err) {
    removeTyping();
    appendIntakeBubble('ai', 'Sorry, something went wrong. Please try again.');
    console.error('[Intake]', err);
  } finally {
    setSending(false);
    input.focus();
  }
}

async function createTicketFromIntake() {
  console.log('[intake] triggering ticket creation...');
  const title = intakeMessages.find(m => m.role === 'client')?.content.slice(0, 80) ?? 'New support request';
  let newTicket: any;

  try {
    const triage = IS_DEMO ? DEMO_TRIAGE_RESULT : await triageConversation(intakeMessages);
    console.log('[intake] triage result:', triage);

    if (IS_DEMO) {
      newTicket = {
        id: `T-${Date.now().toString(36).toUpperCase()}`,
        ghlOpportunityId: `opp-${Date.now()}`,
        title, category: triage.category, priority: triage.priority,
        status: 'new', slaDeadline: new Date(Date.now() + 48 * 3600000),
        createdAt: new Date(), updatedAt: new Date(),
      };
      DEMO_DATA.messages[newTicket.id] = [...intakeMessages];
      DEMO_DATA.tickets.unshift(newTicket);
    } else {
      const params = { userId: _userId, locationId: _locationId, userName: _userName, userEmail: _userEmail, title, category: triage.category, priority: triage.priority, summary: triage.problem };
      console.log('[createTicket] params:', params);

      let rekeyId: string;
      try {
        newTicket = await createTicket(params);
        // Use the ticket ID for message storage
        rekeyId = newTicket.id;
        console.log('[intake] GHL ticket created, rekeying to:', rekeyId);
      } catch (ghlErr) {
        // GHL failed — generate local fallback so conversation can continue
        const fallbackId = 'T-' + Date.now().toString(36).toUpperCase();
        console.warn('[createTicket] GHL failed, using fallback ID:', fallbackId, ghlErr);
        newTicket = {
          id: fallbackId,
          ghlOpportunityId: fallbackId,
          title, category: triage.category, priority: triage.priority,
          status: 'new', slaDeadline: new Date(Date.now() + 48 * 3600000),
          createdAt: new Date(), updatedAt: new Date(),
        };
        rekeyId = fallbackId;
        console.log('[createTicket] rekeying to fallback ID:', rekeyId);
      }

      // Await rekey so messages are under the correct ID before thread mode starts
      const realId = newTicket.id;
      if (intakeTempTicketId && realId) {
        try {
          await rekeyMessages(intakeTempTicketId, realId, currentLocationId);
          console.log('[intake] rekeyMessages complete:', intakeTempTicketId, '→', realId);
        } catch (e) {
          console.warn('[intake] rekeyMessages error:', e);
        }
      }
      // Ensure thread sends use the real GHL opportunity ID, not the internal fallback
      newTicket.id = realId;
      activeTicketId = realId;
      console.log('[intake] currentTicketId set to:', activeTicketId);
    }

    console.log('[intake] ticket resolved:', newTicket.id);
  } catch (err) {
    // Triage failed — show graceful message, do not surface error to user
    console.error('[intake] createTicketFromIntake error:', err);
    appendIntakeBubble('ai', 'Your issue has been noted. Our team will follow up shortly.');
    return;
  }

  intakeMessages = []; aiResponseCount = 0; intakeTempTicketId = '';
  // Prepend new ticket to live list so it appears at the top of Open group
  if (!IS_DEMO) liveTickets = [newTicket, ...liveTickets.filter(t => t.id !== newTicket.id)];
  renderSidebar(IS_DEMO ? DEMO_DATA.tickets : liveTickets);
  await loadTicket(newTicket);
  // Refresh My Tickets sidebar to include new ticket
  loadMyTickets().catch(err => console.warn('[chat] loadMyTickets refresh failed:', err));
  document.getElementById('intakeThread')?.remove();
}

async function handleThreadSend() {
  if (isSending || !activeTicketId) return;
  const input = document.getElementById('threadInput') as HTMLTextAreaElement;
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = '';
  setSending(true);
  const clientMsg = { id: `msg-${Date.now()}`, role: 'client', content: text, isInternal: false, createdAt: new Date() };
  appendThreadBubble('client', text, clientMsg.id);

  // Build full conversation history BEFORE calling AI
  let historyForAI: any[] = [];
  if (IS_DEMO) {
    if (!DEMO_DATA.messages[activeTicketId]) DEMO_DATA.messages[activeTicketId] = [];
    DEMO_DATA.messages[activeTicketId].push(clientMsg);
    historyForAI = [...DEMO_DATA.messages[activeTicketId]];
  } else {
    // Persist client message first, then load full history for context
    await addMessage(activeTicketId, 'client', text, currentLocationId, false);
    try {
      historyForAI = await getMessages(activeTicketId, currentLocationId);
    } catch (e) {
      console.warn('[thread] getMessages failed, falling back to single message:', e);
      historyForAI = [clientMsg];
    }
  }

  showTyping('messageThread');
  try {
    const aiText = IS_DEMO ? await mockAIResponse(Math.floor(Math.random() * 2)) : await continueConversation(historyForAI, text);
    removeTyping();
    const aiMsg = { id: `msg-ai-${Date.now()}`, role: 'ai', content: aiText, isInternal: false, createdAt: new Date() };
    appendThreadBubble('ai', aiText, aiMsg.id);
    if (IS_DEMO) DEMO_DATA.messages[activeTicketId!].push(aiMsg);
    else await addMessage(activeTicketId!, 'ai', aiText, currentLocationId, false);
  } catch (err) {
    removeTyping();
    appendThreadBubble('ai', 'Sorry, something went wrong. Please try again.');
    console.error('[Thread]', err);
  } finally {
    setSending(false);
    input.focus();
  }
}

function appendThreadBubble(role: string, content: string, msgId: string | null = null) {
  if (msgId) { if (renderedMsgIds.has(msgId)) return; renderedMsgIds.add(msgId); }
  const thread = document.getElementById('messageThread')!;
  const el = document.createElement('div');
  el.className = `message-bubble bubble-${role}`;
  el.innerHTML = `<div class="bubble-content">${content}</div><div class="bubble-meta">${role === 'ai' ? 'LegacyZero' : role} · ${formatTime(new Date())}</div>`;
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
document.querySelectorAll('.quick-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const input = document.getElementById('threadInput') as HTMLTextAreaElement;
    input.value = (pill as HTMLElement).dataset['prompt'] ?? '';
    input.focus();
  });
});

document.getElementById('welcomeSendBtn')!.addEventListener('click', handleWelcomeSend);
document.getElementById('welcomeInput')!.addEventListener('keydown', (e: Event) => {
  if ((e as KeyboardEvent).key === 'Enter' && !(e as KeyboardEvent).shiftKey) { e.preventDefault(); handleWelcomeSend(); }
});

document.getElementById('threadSendBtn')!.addEventListener('click', handleThreadSend);
document.getElementById('threadInput')!.addEventListener('keydown', (e: Event) => {
  if ((e as KeyboardEvent).key === 'Enter' && !(e as KeyboardEvent).shiftKey) { e.preventDefault(); handleThreadSend(); }
});

['threadInput', 'welcomeInput'].forEach(id => {
  const el = document.getElementById(id)!;
  el.addEventListener('input', () => {
    (el as HTMLTextAreaElement).style.height = 'auto';
    (el as HTMLTextAreaElement).style.height = Math.min((el as HTMLTextAreaElement).scrollHeight, 160) + 'px';
  });
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  await initAuth();
  if (IS_DEMO) {
    liveTickets = DEMO_DATA.tickets;
    renderSidebar(liveTickets);
    const first = liveTickets.find((t: any) => statusGroup(t.status) === 'open');
    if (first) await loadTicket(first);
  } else {
    // Load customer's real tickets from GHL
    try {
      liveTickets = await listTickets({ locationId: currentLocationId, contactId: currentUserId });
      console.log('[init] loaded', liveTickets.length, 'tickets for contact:', currentUserId);
    } catch (e) {
      console.warn('[init] failed to load tickets:', e);
      liveTickets = [];
    }
    renderSidebar(liveTickets);
    const first = liveTickets.find((t: any) => statusGroup(t.status) === 'open');
    if (first) await loadTicket(first);
    // Load real My Tickets from Supabase
    await loadMyTickets();
  }
}

init();
