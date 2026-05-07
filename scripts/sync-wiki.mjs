import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIKI_PATH = path.resolve(
  __dirname,
  '../../../SEO:GEO B&M Business/wiki/concepts/review-response-templates.md'
);
const OUT_PATH = path.resolve(__dirname, '../src/data/templates.json');

// Static category metadata. The wiki body fills in templates per category.
// If the wiki has examples for some but not all categories, missing ones get
// generic placeholder fallback templates so the app never crashes mid-draft.
const CATEGORY_DEFS = [
  {
    id: '5star_specific',
    label: '5-star with specific praise',
    matchHeader: /Template\s*\d+\s*[—-]\s*5[-\s]?star.*specific/i,
    trigger: { rating: 5, has_specific_praise: true },
    response_goal: 'Reinforce + thank, vary wording',
    fallbackTemplate: {
      example_inbound: '',
      example_response: 'Thanks so much — really appreciate it.',
      rules: ['First name only', '1-2 sentences max', 'No URLs or promo'],
    },
  },
  {
    id: '5star_generic',
    label: '5-star, generic',
    matchHeader: /Template\s*\d+\s*[—-]\s*5[-\s]?star.*generic/i,
    trigger: { rating: 5, has_specific_praise: false },
    response_goal: 'Brief thanks, low effort',
    fallbackTemplate: {
      example_inbound: '',
      example_response: 'Appreciate it! See you next time.',
      rules: ['1 sentence is enough', "Don't upsell"],
    },
  },
  {
    id: '4star',
    label: '4-star, would recommend but…',
    matchHeader: /Template\s*\d+\s*[—-]\s*4[-\s]?star/i,
    trigger: { rating: 4 },
    response_goal: 'Acknowledge the gap, invite return',
    fallbackTemplate: {
      example_inbound: '',
      example_response:
        'Thanks for the feedback — glad most of it landed, sorry for the parts that did not. Hope to see you again.',
      rules: ['Acknowledge the specific gap', 'Invite return without begging'],
    },
  },
  {
    id: '3star_mixed',
    label: '3-star, mixed',
    matchHeader: /Template\s*\d+\s*[—-]\s*3[-\s]?star/i,
    trigger: { rating: 3 },
    response_goal: 'Take seriously, route to private channel',
    fallbackTemplate: {
      example_inbound: '',
      example_response:
        'Thanks for sharing this — sorry the visit was a mixed bag. We would love to make it right; please reach out directly so we can.',
      rules: [
        'Acknowledge mixed experience',
        'Invite private follow-up',
        'Do not air specifics publicly',
      ],
    },
  },
  {
    id: '1_2star_complaint',
    label: '1-2 star, real complaint',
    matchHeader: /Template\s*\d+\s*[—-]\s*1[-\s]?2[-\s]?star.*complaint/i,
    trigger: { rating: [1, 2] },
    response_goal: 'De-escalate publicly, fix privately',
    fallbackTemplate: {
      example_inbound: '',
      example_response:
        "We're sorry — that's not the experience we want. Please reach out so we can make it right.",
      rules: [
        'No defensiveness',
        'Move to private channel',
        'Never name customer specifics that they did not include',
      ],
    },
  },
  {
    id: '1star_fake',
    label: '1-star, likely fake / policy-violating',
    matchHeader: /Template\s*\d+\s*[—-]\s*1[-\s]?star.*fake/i,
    trigger: { rating: 1, has_specific_praise: false },
    response_goal: 'Hold the line, do NOT engage emotionally',
    fallbackTemplate: {
      example_inbound: '',
      example_response: '',
      rules: [
        'Do not pre-draft',
        "Don't engage emotionally",
        "Operator decides: don't reply OR flag to platform",
      ],
    },
  },
];

export function parseWikiTemplates(markdown) {
  const { data, content } = matter(markdown);

  // Split body by H3 headers ("### Template N — ...")
  const sections = splitByH3(content);

  const categories = CATEGORY_DEFS.map((def) => {
    const matchedSection = sections.find((s) => def.matchHeader.test(s.heading));

    let template = def.fallbackTemplate;
    if (matchedSection) {
      template = extractTemplateFromSection(matchedSection.body) ?? def.fallbackTemplate;
    }

    return {
      id: def.id,
      label: def.label,
      trigger: def.trigger,
      response_goal: def.response_goal,
      templates: [template],
    };
  });

  // gray-matter parses YAML dates as Date objects; coerce to ISO string
  const rawVersion = data.updated || data.created || new Date();
  const version =
    rawVersion instanceof Date
      ? rawVersion.toISOString().slice(0, 10)
      : String(rawVersion);

  return {
    version,
    source: 'wiki/concepts/review-response-templates.md',
    categories,
  };
}

function splitByH3(content) {
  const lines = content.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^###\s+(.+)$/);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[1].trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

function extractTemplateFromSection(body) {
  // Inbound block: text after "Inbound" heading, in a blockquote
  const inbound = matchBlockAfter(body, /Inbound|inbound/);
  // Response block: text after "Response template" heading, in a blockquote
  const response = matchBlockAfter(body, /Response template|response template/);
  // Rules: bullet list after "Variation rules" or "Rules"
  const rules = matchBulletsAfter(body, /Variation rules|Rules|rules/);

  if (!response) return null;

  return {
    example_inbound: inbound ?? '',
    example_response: response,
    rules: rules.length > 0 ? rules : ['Keep it short', 'No URLs or promo codes'],
  };
}

function matchBlockAfter(body, headingPattern) {
  // Find a line containing the heading (often bolded), then capture quoted ">" lines following it
  const lines = body.split('\n');
  const idx = lines.findIndex((l) => headingPattern.test(l) && /\*\*/.test(l));
  if (idx === -1) return null;
  const captured = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('> ')) {
      captured.push(line.replace(/^>\s?/, '').replace(/^["']|["']$/g, ''));
    } else if (captured.length > 0 && line.trim() === '') {
      // allow one blank line within a quote block
      continue;
    } else if (captured.length > 0) {
      break;
    }
  }
  return captured.length > 0 ? captured.join(' ').trim() : null;
}

function matchBulletsAfter(body, headingPattern) {
  const lines = body.split('\n');
  const idx = lines.findIndex((l) => headingPattern.test(l) && /\*\*/.test(l));
  if (idx === -1) return [];
  const bullets = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+/, '').trim());
    } else if (bullets.length > 0 && line.trim() === '') {
      continue;
    } else if (bullets.length > 0) {
      break;
    }
  }
  return bullets;
}

// CLI entry point
async function main() {
  if (!fs.existsSync(WIKI_PATH)) {
    console.warn(
      `[sync-wiki] Wiki not found at ${WIKI_PATH}. Writing fallback templates.`
    );
    const fallback = parseWikiTemplates('---\nupdated: "' + new Date().toISOString().slice(0, 10) + '"\n---\n');
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(fallback, null, 2));
    return;
  }
  const md = fs.readFileSync(WIKI_PATH, 'utf8');
  const out = parseWikiTemplates(md);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`[sync-wiki] Wrote ${out.categories.length} categories to ${OUT_PATH}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
