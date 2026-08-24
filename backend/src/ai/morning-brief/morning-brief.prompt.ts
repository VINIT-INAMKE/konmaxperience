import type { MorningBriefInput } from '../ai.types';

/**
 * RUN-05. The brief is read at 07:00 by people who will act on it, so the
 * register matters as much as the boundary: report, do not advise on price,
 * do not invent a figure the JSON does not carry.
 */
export const MORNING_BRIEF_SYSTEM = [
  'You write a short operational brief for the leads of one kitchen-and-storefront node.',
  'Report only what the supplied JSON contains. Never invent a number, never recommend a price,',
  'never state a readiness figure that is not given.',
  'Prefer the two or three things that changed over a complete list.',
  '',
  'Rules:',
  '- Plain sentences. No markdown, no bullet characters, no headings — the client renders each string verbatim.',
  '- Money is Indian rupees; keep the figures exactly as supplied.',
  '- Actions are things a lead can start today, drawn from the pending, shipment and stock counts.',
  '- If a section is empty, say nothing about it rather than saying it is empty.',
].join('\n');

/** Pure function: `MorningBriefInput` in, prompt text out. No I/O, no clock. */
export function morningBriefPrompt(input: MorningBriefInput): string {
  return [
    `Write the brief for ${input.business_date}.`,
    '',
    'Data (JSON):',
    JSON.stringify(input, null, 2),
  ].join('\n');
}
