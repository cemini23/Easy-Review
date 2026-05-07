import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CategoryDef, Operator, Review } from '@/lib/types';

let _model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

function getModel() {
  if (_model) return _model;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const genAI = new GoogleGenerativeAI(key);
  _model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  return _model;
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
  const model = getModel();

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const v = validateDraft(text);
    if (v.ok) return text;
  }

  // Fallback: emit the example_response with sign-off appended
  const fallback = args.template.templates[0].example_response;
  return args.operator.sign_off ? `${fallback} ${args.operator.sign_off}` : fallback;
}
