'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AdminUserFilter() {
  return (
    <Select defaultValue="all">
      <SelectTrigger className="w-[260px]">
        <SelectValue placeholder="Viewing as: All team members" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All team members</SelectItem>
      </SelectContent>
    </Select>
  );
}
