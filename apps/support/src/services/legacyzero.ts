import type { Message, AISummary, TicketCategory, TicketPriority } from '../types/ticket';

// ---------------------------------------------------------------------------
// Config
// All AI calls route through the Worker proxy (/ai/chat) to keep API keys
// out of the browser bundle and avoid CORS issues with direct Anthropic calls.
// ---------------------------------------------------------------------------
const WORKER_URL = 'https://legacy-fusion-support.hector-0b9.workers.dev';

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------
const TRIAGE_SYSTEM_PROMPT = `You are a support ticket triage system. You must respond with ONLY a valid JSON object. No markdown. No code fences. No explanation. No text before or after. Just the raw JSON object.

Required format:
{"category":"technical","priority":"high","problem":"one sentence description","suggestedAction":"one sentence recommendation"}

category must be one of: technical, billing, general, escalated
priority must be one of: urgent, high, medium, low`;

const CONVERSATION_SYSTEM_PROMPT =
  'You are LegacyZero, the AI support agent for Legacy Fusion. Be concise, warm, and professional. Collect the information needed to resolve the issue. Once you have enough context, confirm a ticket has been created and an agent will follow up.';

// ---------------------------------------------------------------------------
// Shared message format
// ---------------------------------------------------------------------------
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function messagesToChat(messages: Message[]): ChatMessage[] {
  return messages.map((m) => ({
    role:    m.role === 'client' ? 'user' : 'assistant',
    content: m.content,
  }));
}

// ---------------------------------------------------------------------------
// callWorkerAI
// POSTs to /ai/chat on the Worker proxy.
// The Worker holds the ANTHROPIC_API_KEY and makes the Anthropic call server-side.
// ---------------------------------------------------------------------------
async function callWorkerAI(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  console.log('[callWorkerAI] systemPrompt preview:', systemPrompt.slice(0, 80));
  console.log('[callWorkerAI] messages:', JSON.stringify(messages).slice(0, 200));
  const res = await fetch(`${WORKER_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Worker AI error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { response?: string; error?: string };
  if (data.error) throw new Error(`Worker AI error: ${data.error}`);
  if (!data.response) throw new Error('Worker AI returned empty response');
  return data.response;
}

// ---------------------------------------------------------------------------
// triageConversation
// Analyzes a conversation and returns an AISummary.
// ---------------------------------------------------------------------------
export async function triageConversation(messages: Message[]): Promise<AISummary> {
  const normalized: ChatMessage[] = messages
    .map(m => ({
      role:    (m.role === 'ai' || m.role === 'assistant') ? 'assistant' as const : 'user' as const,
      content: m.content,
    }))
    .filter(m => m.content && m.content.trim().length > 0);

  if (!normalized.find(m => m.role === 'user')) {
    normalized.push({ role: 'user', content: 'Please triage this support conversation.' });
  }

  // Anthropic requires the last message to be role:'user'
  if (normalized.length === 0 || normalized[normalized.length - 1].role === 'assistant') {
    normalized.push({ role: 'user', content: 'Based on this conversation, please provide the triage JSON.' });
  }

  console.log('[triage] sending prompt:', TRIAGE_SYSTEM_PROMPT.slice(0, 100));
  console.log('[triage] messages:', JSON.stringify(normalized));
  const raw = await callWorkerAI(TRIAGE_SYSTEM_PROMPT, normalized);

  let parsed: {
    category: TicketCategory;
    priority: TicketPriority;
    problem: string;
    suggestedAction: string;
  };

  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .replace(/^---.*$/gm, '')
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: extract first JSON object from response
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('no JSON object found');
      }
    }
  } catch {
    console.error('[LegacyZero] Triage parse failure. Raw response:', raw);
    throw new Error(`LegacyZero triage failed: could not parse AI response as JSON. Raw: ${raw}`);
  }

  if (!parsed.category || !parsed.priority || !parsed.problem || !parsed.suggestedAction) {
    throw new Error(`LegacyZero triage returned incomplete JSON. Raw: ${raw}`);
  }

  return {
    problem:         parsed.problem,
    category:        parsed.category,
    priority:        parsed.priority,
    suggestedAction: parsed.suggestedAction,
    generatedAt:     new Date(),
  };
}

// ---------------------------------------------------------------------------
// continueConversation
// Returns the AI's next reply string given conversation history + new message.
// ---------------------------------------------------------------------------
export async function continueConversation(
  messages: Message[],
  userMessage: string
): Promise<string> {
  const normalized: ChatMessage[] = messages
    .map(m => ({
      role:    (m.role === 'ai' || m.role === 'assistant') ? 'assistant' as const : 'user' as const,
      content: m.content,
    }))
    .filter(m => m.content && m.content.trim().length > 0);

  // Append the new user message
  normalized.push({ role: 'user', content: userMessage });

  return callWorkerAI(CONVERSATION_SYSTEM_PROMPT, normalized);
}
