'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedbackStatsCard } from '@/components/ops/operations/feedback/FeedbackStatsCard';
import { RatingFilterTabs } from '@/components/ops/operations/feedback/RatingFilterTabs';
import { FeedbackRow } from '@/components/ops/operations/feedback/FeedbackRow';
import { apiClient } from '@/lib/api-client';
import type { Feedback, FeedbackStats } from '@/lib/types/feedback';
import { ExportButton } from '@/components/ops/exports/ExportButton';

function getDateFrom(filter: string): string | null {
  const now = new Date();
  if (filter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.toISOString();
  }
  if (filter === 'week') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return start.toISOString();
  }
  if (filter === 'month') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return start.toISOString();
  }
  return null;
}

export default function FeedbackPage() {
  const [ratingFilter, setRatingFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['feedback-stats'],
    queryFn: () => apiClient.get<FeedbackStats>('/feedback/stats'),
  });

  const { data: feedbackList, isLoading, isError } = useQuery({
    queryKey: ['feedback-list', ratingFilter, dateFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (ratingFilter !== 'all') {
        params.set('rating', ratingFilter);
      }
      const dateFrom = getDateFrom(dateFilter);
      if (dateFrom) {
        params.set('date_from', dateFrom);
      }
      const qs = params.toString();
      return apiClient.get<Feedback[]>(`/feedback${qs ? '?' + qs : ''}`);
    },
  });

  return (
      <div className="space-y-6">
        {/* Header */}
        <h1 className="text-2xl font-bold">Customer Feedback</h1>

        {/* Stats card */}
        <FeedbackStatsCard stats={stats} isLoading={statsLoading} />

        {/* Filter row */}
        <div className="flex items-center gap-4 flex-wrap">
          <RatingFilterTabs value={ratingFilter} onChange={setRatingFilter} />

          <Select
            value={dateFilter}
            onValueChange={(v) => setDateFilter(v ?? 'all')}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton
            reportType="feedback"
            reportName="Feedback"
            isTimeSeries={true}
          />
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Comment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="text-sm text-destructive">
            Couldn&apos;t load feedback. Refresh the page to try again.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && feedbackList && feedbackList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <MessageSquare className="size-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">No Feedback Yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Feedback submitted via QR codes and links will appear here.
            </p>
          </div>
        )}

        {/* Feedback table */}
        {!isLoading && !isError && feedbackList && feedbackList.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Comment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {feedbackList.map((fb) => (
                  <FeedbackRow key={fb.id} feedback={fb} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
  );
}
