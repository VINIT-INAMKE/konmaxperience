import { HeuristicProvider } from './heuristic.provider';
import type { EvidenceAssistInput, MorningBriefInput } from './ai.types';

function evidence(
  overrides: Partial<EvidenceAssistInput> = {},
): EvidenceAssistInput {
  return {
    evidence_id: 'ev-1',
    task_title: 'Close the kitchen',
    task_description: 'Wipe down, log temperatures, lock up.',
    evidence_type: 'image',
    evidence_notes: 'Closing photo of the pass after the deep clean.',
    evidence_url: 'https://r2.example/ev-1.jpg',
    source: 'manual',
    bridge_event: null,
    uploaded_by_name: 'Kitchen Lead',
    prior_rejections: 0,
    ...overrides,
  };
}

function brief(overrides: Partial<MorningBriefInput> = {}): MorningBriefInput {
  return {
    business_date: '2026-08-24',
    readiness: [
      { code: 'SALES', value: 72, delta_7d: 6 },
      { code: 'QUALITY', value: 64, delta_7d: -11 },
      { code: 'PEOPLE', value: 80, delta_7d: 0 },
    ],
    sales: {
      orders: 18,
      revenue: 24350.5,
      by_channel: [
        { channel: 'storefront', orders: 12, revenue: 18000 },
        { channel: 'dine_in', orders: 6, revenue: 6350.5 },
      ],
    },
    waste: { entries: 3, cost: 820.25 },
    pending: { approvals: 4, blockers: 2, stale_decisions: 1 },
    shipments: { open: 5, failed: 2 },
    low_stock: [{ ingredient: 'Paneer', on_hand: 1.5, minimum: 4 }],
    ...overrides,
  };
}

describe('HeuristicProvider', () => {
  const provider = new HeuristicProvider();

  it('names itself heuristic and reports no model', async () => {
    expect(provider.name).toBe('heuristic');
    const result = await provider.reviewEvidence(evidence());
    expect(result.provider).toBe('heuristic');
    expect(result.model).toBeNull();
  });

  describe('reviewEvidence', () => {
    it('suggests approve for bridge evidence carrying a real note', async () => {
      const result = await provider.reviewEvidence(
        evidence({
          source: 'bridge',
          bridge_event: 'order.delivered',
          evidence_notes:
            'Auto-captured on delivery confirmation for order #1043.',
        }),
      );
      expect(result.verdict).toBe('approve');
      expect(result.reasons[0]).toContain('mission bridge');
    });

    it('suggests reject for a note-only submission with no text', async () => {
      const result = await provider.reviewEvidence(
        evidence({ evidence_type: 'note', evidence_notes: null }),
      );
      expect(result.verdict).toBe('reject');
      expect(result.reasons).toContain('No note explaining what this proves.');
      expect(result.reasons).toContain(
        'A note-only submission carries no artefact.',
      );
    });

    it('lets prior rejections push a borderline case to reject', async () => {
      const borderline = evidence({
        evidence_type: 'note',
        evidence_notes: 'Cleaned the pass and logged the temperatures.',
      });
      expect((await provider.reviewEvidence(borderline)).verdict).toBe(
        'unsure',
      );

      const bounced = await provider.reviewEvidence({
        ...borderline,
        prior_rejections: 2,
      });
      expect(bounced.verdict).toBe('reject');
      expect(bounced.reasons.join(' ')).toContain('2 piece(s) of evidence');
    });

    it('never presents as certain and never as worthless', async () => {
      const cases = [
        evidence({ source: 'bridge', bridge_event: 'order.delivered' }),
        evidence({ evidence_type: 'note', evidence_notes: null }),
        evidence({ prior_rejections: 9 }),
        evidence({ evidence_notes: 'short' }),
      ];
      for (const input of cases) {
        const { confidence } = await provider.reviewEvidence(input);
        expect(confidence).toBeGreaterThan(0);
        expect(confidence).toBeLessThan(1);
        expect(confidence).toBeLessThanOrEqual(0.75);
      }
    });

    it('never returns an empty reason list and caps it at four', async () => {
      const result = await provider.reviewEvidence(
        evidence({
          evidence_type: 'note',
          evidence_notes: null,
          prior_rejections: 3,
        }),
      );
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.length).toBeLessThanOrEqual(4);
    });

    it('is deterministic — same input, byte-identical output minus latency', async () => {
      const input = evidence({
        source: 'bridge',
        bridge_event: 'waste.logged',
      });
      const [a, b] = [
        await provider.reviewEvidence(input),
        await provider.reviewEvidence(input),
      ];
      const { latency_ms: _a, ...withoutLatencyA } = a;
      const { latency_ms: _b, ...withoutLatencyB } = b;
      expect(JSON.stringify(withoutLatencyA)).toBe(
        JSON.stringify(withoutLatencyB),
      );
      expect(a.latency_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('writeMorningBrief', () => {
    it('reports sales, the two biggest movers, waste, shipments and stock', async () => {
      const result = await provider.writeMorningBrief(brief());
      expect(result.headline).toBe(
        '2026-08-24: 18 orders, 4 approvals waiting',
      );
      expect(result.bullets[0]).toBe(
        '18 order(s) for ₹24350.50 across 2 channel(s).',
      );
      // QUALITY moved -11, SALES +6, PEOPLE 0 — the flat meter is dropped.
      expect(result.bullets.join(' ')).toContain(
        'QUALITY is 64% (-11 over 7 days).',
      );
      expect(result.bullets.join(' ')).toContain(
        'SALES is 72% (+6 over 7 days).',
      );
      expect(result.bullets.join(' ')).not.toContain('PEOPLE');
      expect(result.bullets.length).toBeLessThanOrEqual(6);
    });

    it('turns pending work and failed shipments into at most three actions', async () => {
      const result = await provider.writeMorningBrief(brief());
      expect(result.actions).toEqual([
        'Clear 4 waiting approval(s).',
        'Unblock 2 task(s).',
        'Re-run the failed shipments from the Shipments queue.',
      ]);
      expect(result.actions.length).toBeLessThanOrEqual(3);
    });

    it('says nothing about sections that are empty', async () => {
      const result = await provider.writeMorningBrief(
        brief({
          waste: { entries: 0, cost: 0 },
          shipments: { open: 0, failed: 0 },
          low_stock: [],
          pending: { approvals: 0, blockers: 0, stale_decisions: 0 },
        }),
      );
      expect(result.bullets.join(' ')).not.toContain('waste');
      expect(result.bullets.join(' ')).not.toContain('shipment');
      expect(result.actions).toEqual([]);
    });

    it('is deterministic and never reaches the network', async () => {
      const input = brief();
      const a = await provider.writeMorningBrief(input);
      const b = await provider.writeMorningBrief(input);
      const { latency_ms: _a, ...withoutLatencyA } = a;
      const { latency_ms: _b, ...withoutLatencyB } = b;
      expect(withoutLatencyA).toEqual(withoutLatencyB);
      expect(a.provider).toBe('heuristic');
      expect(a.model).toBeNull();
    });
  });
});
