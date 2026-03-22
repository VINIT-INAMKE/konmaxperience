'use client';

import { Star } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RatingFilterTabsProps {
  value: string;
  onChange: (v: string) => void;
}

export function RatingFilterTabs({ value, onChange }: RatingFilterTabsProps) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        {['5', '4', '3', '2', '1'].map((rating) => (
          <TabsTrigger key={rating} value={rating} className="gap-1">
            {rating}
            <Star className="size-3 fill-current" />
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
