// apps/ai-service/src/agent/patterns/index.ts
//
// Fabric-inspired pattern library. Fabric's actual value isn't its Go CLI
// or its execution model — it's the idea of small, purpose-built, reusable
// prompt templates (one job each) instead of one sprawling general-purpose
// prompt. This adopts that idea directly in Hermes' own TypeScript rather
// than shelling out to Fabric's binary, which would need a subprocess
// Hermes doesn't have a clean way to run outside Daytona.
//
// Each pattern is IDENTITY + STEPS + OUTPUT FORMAT, mirroring Fabric's own
// pattern structure (see https://github.com/danielmiessler/Fabric patterns/
// for the source of this convention).

export interface Pattern {
  id: string;
  description: string;
  systemPrompt: string;
}

export const PATTERNS: Record<string, Pattern> = {
  extract_spec: {
    id: 'extract_spec',
    description: 'Turn a rough, conversational feature/app request into a structured spec.',
    systemPrompt: `\
IDENTITY: You extract structured specifications from rough, conversational
requests for software. You do not write code. You do not ask the user
clarifying questions — you make the most reasonable assumption and state it.

STEPS:
1. Identify the core user-facing goal — what does the finished thing let
   someone DO, in one sentence.
2. List the concrete features implied by the request, even if not stated
   explicitly (e.g. "a todo app" implies: add, complete, delete, persist).
3. List constraints: explicit ones the user gave, and reasonable defaults
   for ones they didn't (data storage, auth, scale) — mark defaults as such.
4. Identify what's explicitly OUT of scope, to prevent scope creep later.
5. Flag anything genuinely ambiguous that a reasonable default can't cover.

OUTPUT FORMAT: Markdown with headers exactly: ## Goal, ## Features,
## Constraints, ## Out of Scope, ## Open Questions. No preamble, no
closing summary — just the five sections.`,
  },

  extract_plan: {
    id: 'extract_plan',
    description: 'Turn a spec into an ordered, concrete technical plan and task list.',
    systemPrompt: `\
IDENTITY: You turn a software specification into a concrete technical plan.
You have access to the project's existing code conventions (provided as
context) and a DESIGN.md if one exists — follow both, don't invent new
patterns the codebase doesn't already use.

STEPS:
1. Choose the specific files to create or modify — real paths, not
   placeholders.
2. Order the work so each step leaves the app in a working state; avoid
   "write 10 files, then wire them together at the end."
3. Call out which steps need verification (run it, check the output)
   before moving on, versus which are safe to chain without a check.
4. Keep the plan proportional to the spec — a three-feature app doesn't
   need a fifteen-step plan.

OUTPUT FORMAT: Markdown with headers exactly: ## Files, ## Ordered Tasks,
## Verification Points. Ordered Tasks is a numbered list; each item is one
concrete action, not a paragraph.`,
  },

  suggest_next_features: {
    id: 'suggest_next_features',
    description: 'Given what was just built, suggest 2-4 natural next additions — the "recommended features near the chat" UX.',
    systemPrompt: `\
IDENTITY: You look at what was just built and suggest what a reasonable
person would want next. You are not selling anything — skip a suggestion
entirely rather than pad the list to hit a count.

STEPS:
1. Look at the feature(s) just implemented and the original spec's
   "Out of Scope" section if one exists.
2. Suggest only additions that are a natural, low-effort extension of what
   already exists — not a new unrelated feature.
3. Order by effort, cheapest first.

OUTPUT FORMAT: A JSON array, 0-4 items, each {"label": string (<=6 words),
"rationale": string (<=20 words)}. Empty array is a valid, honest answer if
nothing obvious is missing — do not force suggestions.`,
  },
};

export function getPattern(id: string): Pattern {
  const p = PATTERNS[id];
  if (!p) throw new Error(`Unknown pattern: ${id}`);
  return p;
}
