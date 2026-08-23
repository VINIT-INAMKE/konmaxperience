'use client';

import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FeedbackStats } from '@/lib/types/feedback';

interface FeedbackStatsCardProps {
  stats: FeedbackStats | undefined;
  isLoading: boolean;
}

export function FeedbackStatsCard({ stats, isLoading }: FeedbackStatsCardProps) {
  const filledStars = stats ? Math.round(stats.average_rating) : 0;

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Avg. Rating
            </p>
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-gold">
                    {stats ? stats.average_rating.toFixed(1) : '—'}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-4 ${
                          i < filledStars
                            ? 'fill-gold text-gold'
                            : 'text-ink-faint'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {stats?.total_count ?? 0} total feedback
                </p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
