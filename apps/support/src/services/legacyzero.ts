import type { Message, AISummary, TicketCategory, TicketPriority } from '../types/ticket';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
type AIProvider = 'anthropic' | 'openai';

const AI_PROVIDER = (
  (import.meta as Record<string, unknown> & { env: Record<string, string> }).env
    .VITE_AI_PROVIDER as AIProvider | undefined
) ?? 'openai';

const ANTHROPIC_API_KEY = (
  import.meta as Record<string, unknown> & { env: Record<string, string> }
).env.VITE_ANTHROPIC_API_KEY as string;

const OPENAI_API_KEY = (
  import.meta as Record<string, unknown> & { env: Record<string, string> }
).env.VITE_OPENAI_API_KEY as string;

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------
const TRIAGE_SYSTEM_PROMPT =
  'You are LegacyZero, the AI support agent for Legacy Fusion. Analyze the conversation and return ONLY valid JSON: { category, priority, problem, suggestedAction }. category: technical | billing | general | escalated. priority: urgent (system down/data loss) | high (blocking work) | medium (inconvenience) | low (question/feature).';

const CONVERSATION_SYSTEM_PROMPT =
  'You are LegacyZero, the AI support agent for Legacy Fusion. Be concise, warm, and professional. Collect the information needed to resolve the issue. Once you have enough context, confirm a ticket has been created and an agent will follow up.';

// ---------------------------------------------------------------------------
// Shared message format
// ---------------------------------------------------------------------------
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function messagesToChat(messages: Message[]): ChatMessage[] {
  return messages.map((m) => ({
    role: m.role === 'client' ? 'user' : m.role === 'agent' ? 'assistant' : 'assistant',
    content: m.content,
  }));
}

// ---------------------------------------------------------------------------
// Private: callAI
// Abstracts provider selection. Returns the assistant reply string.
// ---------------------------------------------------------------------------
async function callAI(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const chat: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...messages];

  if (AI_PROVIDER === 'anthropic') {
    return callAnthropic(chat);
  }

  return callOpenAI(chat);
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------
async function callOpenAI(messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response');
  return content;
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------
async function callAnthropic(messages: ChatMessage[]): Promise<string> {
  // Anthropic uses a separate system param; extract it from the first message
  const systemMsg = messages[0]?.role === 'system' ? messages[0].content : '';
  const chatMessages = systemMsg ? messages.slice(1) : messages;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemMsg,
      messages: chatMessages.map((m) => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const block = data.content?.find((b) => b.type === 'text');
  if (!block) throw new Error('Anthropic returned empty response');
  return block.text;
}

// ---------------------------------------------------------------------------
// triageConversation
// Analyzes a conversation and returns an AISummary.
// Throws on parse failure — callers should handle and surface the error.
// ---------------------------------------------------------------------------
export async function triageConversation(messages: Message[]): Promise<AISummary> {
  const chatMessages = messagesToChat(messages);
  const raw = await callAI(TRIAGE_SYSTEM_PROMPT, chatMessages);

  let parsed: {
    category: TicketCategory;
    priority: TicketPriority;
    problem: string;
    suggestedAction: string;
  };

  try {
    // Strip markdown code fences if the model wrapped the JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error('[LegacyZero] Triage parse failure. Raw response:', raw);
    throw new Error(`LegacyZero triage failed: could not parse AI response as JSON. Raw: ${raw}`);
  }

  // Validate required fields
  if (!parsed.category || !parsed.priority || !parsed.problem || !parsed.suggestedAction) {
    throw new Error(
      `LegacyZero triage returned incomplete JSON. Missing fields. Raw: ${raw}`
    );
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
// Returns the AI's next reply string given the full conversation history
// and the new user message.
// ---------------------------------------------------------------------------
export async function continueConversation(
  messages: Message[],
  userMessage: string
): Promise<string> {
  const history = messagesToChat(messages);

  // Append the new user message
  const chatMessages: ChatMessage[] = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  const reply = await callAI(CONVERSATION_SYSTEM_PROMPT, chatMessages);
  return reply;
}
