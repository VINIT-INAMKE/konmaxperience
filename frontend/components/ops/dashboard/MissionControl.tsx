'use client';

import { ActionRequiredPanel } from './ActionRequiredPanel';
import { StatusPanel } from './StatusPanel';
import { IntelligencePanel } from './IntelligencePanel';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
      {children}
    </h2>
  );
}

/**
 * SPEC §6.5 — what an admin lands on, in the order the day is actually run:
 * what needs a decision, where things stand, and what the numbers say.
 *
 * The sections are stacked rather than columned on purpose. "Action Required"
 * is the only one that ever demands a response, so it must be the first thing
 * read on every viewport, including a phone.
 */
export function MissionControl() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-ink-strong">Mission Control</h1>

      <section className="space-y-3">
        <SectionHeading>Action required</SectionHeading>
        <ActionRequiredPanel />
      </section>

      <section className="space-y-3">
        <SectionHeading>Status</SectionHeading>
        <StatusPanel />
      </section>

      <section className="space-y-3">
        <SectionHeading>Intelligence</SectionHeading>
        <IntelligencePanel />
      </section>
    </div>
  );
}
