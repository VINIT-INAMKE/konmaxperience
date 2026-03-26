'use client';

import { BlurFade } from '@/components/ui/blur-fade';

interface OrderTrackingTimelineProps {
  channel: 'takeaway' | 'delivery';
  status: string;
  deliveryStatus: string | null;
  timestamps: Record<string, string>;
}

interface TimelineStep {
  key: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
  timestamp: string | null;
}

function buildSteps(
  channel: 'takeaway' | 'delivery',
  status: string,
  deliveryStatus: string | null,
  timestamps: Record<string, string>,
): TimelineStep[] {
  const takeawayLabels = [
    { key: 'placed', label: 'Order Placed' },
    { key: 'preparing', label: 'Preparing your order' },
    { key: 'ready', label: 'Ready for Pickup' },
    { key: 'served', label: 'Picked Up' },
  ];

  const deliveryLabels = [
    { key: 'placed', label: 'Order Placed' },
    { key: 'preparing', label: 'Preparing your order' },
    { key: 'dispatched', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const labels = channel === 'delivery' ? deliveryLabels : takeawayLabels;

  // Determine the active step index
  let activeIndex = 0;

  if (channel === 'takeaway') {
    if (status === 'served') {
      activeIndex = 4; // all completed
    } else if (status === 'ready') {
      activeIndex = 2;
    } else if (status === 'preparing') {
      activeIndex = 1;
    } else {
      activeIndex = 0;
    }
  } else {
    // delivery
    if (deliveryStatus === 'delivered') {
      activeIndex = 4; // all completed
    } else if (
      status === 'dispatched' &&
      (deliveryStatus === 'picked_up' || deliveryStatus === 'in_transit')
    ) {
      activeIndex = 2;
    } else if (status === 'preparing') {
      activeIndex = 1;
    } else {
      activeIndex = 0;
    }
  }

  return labels.map((item, index) => {
    let stepStatus: 'completed' | 'active' | 'pending';
    if (activeIndex >= labels.length) {
      // All completed
      stepStatus = 'completed';
    } else if (index < activeIndex) {
      stepStatus = 'completed';
    } else if (index === activeIndex) {
      stepStatus = 'active';
    } else {
      stepStatus = 'pending';
    }

    return {
      key: item.key,
      label: item.label,
      status: stepStatus,
      timestamp: timestamps[item.key] ?? null,
    };
  });
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

export function OrderTrackingTimeline({
  channel,
  status,
  deliveryStatus,
  timestamps,
}: OrderTrackingTimelineProps) {
  const steps = buildSteps(channel, status, deliveryStatus, timestamps);

  return (
    <div role="list" className="mt-6">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <BlurFade key={step.key} direction="up" delay={index * 0.05}>
            <div
              role="listitem"
              className="flex items-start gap-4"
              {...(step.status === 'active'
                ? { 'aria-current': 'step' as const }
                : {})}
            >
              {/* Left column: dot + connector */}
              <div className="w-8 flex flex-col items-center">
                {/* Dot */}
                {step.status === 'completed' && (
                  <div className="w-4 h-4 rounded-full bg-[var(--public-tracking-done)]" />
                )}
                {step.status === 'active' && (
                  <div className="w-4 h-4 rounded-full bg-[var(--public-tracking-active)] ring-2 ring-[var(--public-tracking-active)]/30 animate-pulse" />
                )}
                {step.status === 'pending' && (
                  <div className="w-4 h-4 rounded-full bg-[var(--public-tracking-pending)] border-2 border-[var(--public-border)]" />
                )}

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={`flex-1 w-0.5 min-h-[40px] ${
                      step.status === 'completed'
                        ? 'bg-[var(--public-tracking-done)]'
                        : 'bg-[var(--public-border)]'
                    }`}
                  />
                )}
              </div>

              {/* Right column: label + timestamp */}
              <div className={isLast ? '' : 'pb-8'}>
                <p
                  className={
                    step.status === 'pending'
                      ? 'text-sm text-[var(--public-muted)]'
                      : 'text-sm font-semibold text-[var(--public-fg)]'
                  }
                >
                  {step.label}
                </p>
                {step.status === 'completed' && step.timestamp && (
                  <p className="text-xs text-[var(--public-muted)] mt-1">
                    {formatTimestamp(step.timestamp)}
                  </p>
                )}
              </div>
            </div>
          </BlurFade>
        );
      })}
    </div>
  );
}
