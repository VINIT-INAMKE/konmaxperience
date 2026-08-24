import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  'approval_status',
  'readiness_value',
  'current_value',
  'base_price',
  '.update(',
  '.upsert(',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith('.ts') && !entry.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('AI boundary (SPEC §1.2 — AI never approves, scores or prices)', () => {
  // `evidence-assist.service.ts` writes EvidenceReviewSuggestion via `.create(`,
  // which is deliberately absent from FORBIDDEN. Anything that could mutate a
  // decision is not.
  it.each(sourceFiles(join(__dirname)))('%s writes no decision', (file) => {
    const src = readFileSync(file, 'utf8');
    for (const needle of FORBIDDEN) expect(src).not.toContain(needle);
  });

  it('scans every non-spec source file under src/ai', () => {
    const files = sourceFiles(join(__dirname));
    expect(files.length).toBeGreaterThan(0);
    // A guard that silently stopped walking would pass vacuously.
    expect(files.some((f) => f.endsWith('anthropic.provider.ts'))).toBe(true);
    expect(files.some((f) => f.includes('evidence-assist'))).toBe(true);
  });
});
