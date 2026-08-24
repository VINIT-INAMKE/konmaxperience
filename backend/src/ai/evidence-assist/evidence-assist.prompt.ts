import type { EvidenceAssistInput } from '../ai.types';

/**
 * SPEC §1.2 stated where the model can read it, not only where the reviewer
 * can. The boundary is enforced in code (`EvidenceReviewSuggestion` is the only
 * row this path writes, and `ai-boundaries.spec.ts` proves it), but a system
 * prompt that quietly implies authority is how a suggestion turns into a
 * decision in someone's head.
 */
export const EVIDENCE_ASSIST_SYSTEM = [
  'You are assisting a human reviewer. You never approve or reject anything — a person does.',
  'Return a suggestion with concrete reasons drawn only from the supplied fields.',
  'If the evidence does not let you judge, return `unsure`; that is a useful answer, not a failure.',
  '',
  'Rules:',
  '- Cite only what the fields below say. Never assume you have opened the attachment: you have not.',
  '- Evidence written by the mission bridge came from a real ops event and is stronger than a hand-typed note.',
  '- A note that does not tie the artefact to the task is weak, however long it is.',
  '- Prior rejections on the same task are a signal, not a verdict.',
  '- Between one and four reasons, each a single short sentence a reviewer could act on.',
].join('\n');

/** Pure function: `EvidenceAssistInput` in, prompt text out. No I/O, no clock. */
export function evidenceAssistPrompt(input: EvidenceAssistInput): string {
  const notes = input.evidence_notes?.trim();
  return [
    'Assess whether the evidence below looks like it proves the task was done.',
    '',
    `Task: ${input.task_title}`,
    `Task detail: ${input.task_description?.trim() || '(none given)'}`,
    `Evidence id: ${input.evidence_id}`,
    `Evidence kind: ${input.evidence_type}`,
    `Evidence link: ${input.evidence_url}`,
    `Submitted by: ${input.uploaded_by_name}`,
    `Origin: ${input.source}${input.source === 'bridge' ? ` (event: ${input.bridge_event ?? 'unnamed'})` : ''}`,
    `Reviewer note: ${notes || '(none)'}`,
    `Evidence already rejected on this task: ${input.prior_rejections}`,
  ].join('\n');
}
