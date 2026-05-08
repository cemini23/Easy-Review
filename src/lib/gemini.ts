import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CategoryDef, Operator, Review } from '@/lib/types';

interface Provider {
  name: string;
  generate: (prompt: string) => Promise<string>;
}

function buildProviders(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GEMINI_API_KEY) {
    list.push({ name: 'gemini', generate: geminiGenerate });
  }
  if (process.env.GROQ_API_KEY) {
    list.push({ name: 'groq', generate: groqGenerate });
  }
  if (process.env.DEEPSEEK_API_KEY) {
    list.push({ name: 'deepseek', generate: deepseekGenerate });
  }
  return list;
}

async function geminiGenerate(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
  });
  const r = await model.generateContent(prompt);
  return r.response.text().trim();
}

async function groqGenerate(prompt: string): Promise<string> {
  return openaiCompat({
    baseUrl: 'https://api.groq.com/openai/v1',
    key: process.env.GROQ_API_KEY!,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    prompt,
  });
}

async function deepseekGenerate(prompt: string): Promise<string> {
  return openaiCompat({
    baseUrl: 'https://api.deepseek.com/v1',
    key: process.env.DEEPSEEK_API_KEY!,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    prompt,
  });
}

async function openaiCompat(args: {
  baseUrl: string;
  key: string;
  model: string;
  prompt: string;
}): Promise<string> {
  const res = await fetch(`${args.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.key}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: 'user', content: args.prompt }],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 240)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error(`unexpected response shape: ${JSON.stringify(data).slice(0, 240)}`);
  }
  return text.trim();
}

export interface BuildPromptArgs {
  review: Review;
  template: CategoryDef;
  operator: Operator;
}

export function buildPrompt(args: BuildPromptArgs): string {
  const { review, template, operator } = args;
  const t = template.templates[0];
  const rulesList = t.rules.map((r) => `- ${r}`).join('\n');

  return `You are drafting a reply to a Google Business Profile review for a ${operator.vertical}.

Review:
> ${review.text}
> — ★${review.rating}, ${review.author}

Category: ${template.label}
Goal: ${template.response_goal}

Guidelines:
${rulesList}

Example reply (vary the wording, do not copy verbatim):
> ${t.example_response}
${operator.sign_off ? `\nSign off with: ${operator.sign_off}` : ''}

Hard constraints:
- 1-3 sentences max in the body (the sign-off, if any, does not count)
- No URLs, prices, or promo codes
- No phone numbers, email addresses, or placeholder slots like [phone number] or [email]
- Use first names only
- Do not include the business name in the body (the sign-off may include it)

Output ONLY the reply text. No preamble, no labels, no quotes.`;
}

function stripSignOff(text: string): string {
  const blocks = text.split(/\n\s*\n/);
  if (blocks.length > 1 && /^[—-]/.test(blocks[blocks.length - 1].trim())) {
    return blocks.slice(0, -1).join('\n\n').trim();
  }
  const lines = text.split('\n');
  if (lines.length > 1 && /^[—-]/.test(lines[lines.length - 1].trim())) {
    return lines.slice(0, -1).join('\n').trim();
  }
  return text;
}

export function validateDraft(text: string): { ok: boolean; reason?: string } {
  if (!text || text.trim().length === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (/https?:\/\//i.test(text)) {
    return { ok: false, reason: 'contains URL' };
  }
  if (/\$\d|\bpromo code\b|\b\d+%\s*off\b/i.test(text)) {
    return { ok: false, reason: 'contains price/promo' };
  }
  const body = stripSignOff(text);
  const sentences = body.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 3) {
    return { ok: false, reason: 'more than 3 sentences' };
  }
  return { ok: true };
}

export async function generateReply(args: BuildPromptArgs): Promise<string> {
  const prompt = buildPrompt(args);
  const providers = buildProviders();
  if (providers.length === 0) {
    throw new Error(
      'No LLM provider configured. Set at least one of GEMINI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY in .env.local.'
    );
  }

  const errors: string[] = [];
  for (const p of providers) {
    try {
      const text = await p.generate(prompt);
      const v = validateDraft(text);
      if (v.ok) return text;
      errors.push(`${p.name}: validation failed (${v.reason})`);
      console.warn(`[llm] ${p.name} produced invalid draft: ${v.reason}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${p.name}: ${msg.slice(0, 240)}`);
      console.warn(`[llm] ${p.name} failed: ${msg.slice(0, 240)}`);
    }
  }

  console.warn(`[llm] all providers failed; using example_response fallback. errors: ${errors.join(' | ')}`);
  const fallback = args.template.templates[0].example_response;
  return args.operator.sign_off ? `${fallback} ${args.operator.sign_off}` : fallback;
}
