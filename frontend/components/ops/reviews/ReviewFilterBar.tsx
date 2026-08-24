'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ReviewStatusFilter } from '@/lib/types/reviews';

/**
 * `GET /reviews?status=` accepts the three `ReviewStatus` members plus the
 * literal `all`; anything else is a `400` listing the legal set
 * (`parseStatusFilter`, reviews.controller.ts). The tab order puts `pending`
 * first and makes it the default, which is what the endpoint does when the
 * parameter is absent.
 */
const FILTERS: { value: ReviewStatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'all', label: 'All' },
];

interface ReviewFilterBarProps {
  value: ReviewStatusFilter;
  onChange: (value: ReviewStatusFilter) => void;
}

export function ReviewFilterBar({ value, onChange }: ReviewFilterBarProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as ReviewStatusFilter)}
    >
      <TabsList className="max-w-full overflow-x-auto">
        {FILTERS.map((filter) => (
          <TabsTrigger key={filter.value} value={filter.value}>
            {filter.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
