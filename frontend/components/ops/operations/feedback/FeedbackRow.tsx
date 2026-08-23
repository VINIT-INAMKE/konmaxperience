'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Feedback } from '@/lib/types/feedback';

interface FeedbackRowProps {
  feedback: Feedback;
}

export function FeedbackRow({ feedback }: FeedbackRowProps) {
  const [expanded, setExpanded] = useState(false);
  const comment = feedback.comment ?? '';
  const isLong = comment.length > 80;
  const displayComment = isLong && !expanded ? comment.slice(0, 80) + '...' : comment;

  return (
    <>
      <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
        {/* Rating */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`size-3 ${
                  i < feedback.rating
                    ? 'fill-gold text-gold'
                    : 'text-ink-faint'
                }`}
              />
            ))}
          </div>
        </td>

        {/* Comment */}
        <td className="px-4 py-3 max-w-[300px]">
          <span className="text-sm">{displayComment || '—'}</span>
          {isLong && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-auto p-0 text-xs text-primary"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </Button>
          )}
        </td>

        {/* Customer */}
        <td className="px-4 py-3 text-sm">
          {feedback.customer_name || 'Anonymous'}
        </td>

        {/* Order */}
        <td className="px-4 py-3 text-sm">
          {feedback.order?.id ? (
            <Link
              href="/pos/orders"
              className="text-primary underline"
            >
              {feedback.order.id.slice(0, 8)}...
            </Link>
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          )}
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {new Date(feedback.created_at).toLocaleDateString()}
        </td>
      </tr>

      {/* Expanded comment row */}
      {expanded && isLong && (
        <tr className="border-b last:border-b-0">
          <td colSpan={5} className="px-4 py-3 bg-muted/20">
            <p className="text-sm">{comment}</p>
          </td>
        </tr>
      )}
    </>
  );
}
