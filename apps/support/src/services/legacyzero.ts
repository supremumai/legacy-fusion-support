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
const TRIAGE_SYSTEM_PROMPT =
  'You are a support triage AI. Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation, no text before or after. Just the JSON object itself.\nFormat: {"category":"technical|billing|general|escalated","priority":"urgent|high|medium|low","problem":"one sentence","suggestedAction":"one sentence"}';

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
  const chatMessages = messagesToChat(messages);
  const raw = await callWorkerAI(TRIAGE_SYSTEM_PROMPT, chatMessages);

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
  const history = messagesToChat(messages);
  const chatMessages: ChatMessage[] = [
    ...history,
    { role: 'user', content: userMessage },
  ];
  return callWorkerAI(CONVERSATION_SYSTEM_PROMPT, chatMessages);
}
