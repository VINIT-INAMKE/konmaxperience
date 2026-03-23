'use client';

import { FileText } from 'lucide-react';
import { CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import type { GuideSearchResult } from '@/lib/types/guides';

interface GuideSearchResultItemProps {
  result: GuideSearchResult;
  onSelect: () => void;
}

export function GuideSearchResultItem({ result, onSelect }: GuideSearchResultItemProps) {
  return (
    <CommandItem
      value={result.pageTitle}
      onSelect={onSelect}
      className="flex items-center gap-3 px-3 py-2 cursor-pointer"
    >
      <FileText className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold truncate">{result.pageTitle}</p>
        <p
          className="text-[13px] text-muted-foreground line-clamp-2 leading-[1.4]"
          dangerouslySetInnerHTML={{ __html: result.snippet }}
        />
      </div>
      <Badge variant="secondary" className="text-[11px] max-w-[120px] truncate shrink-0">
        {result.sectionTitle}
      </Badge>
    </CommandItem>
  );
}
