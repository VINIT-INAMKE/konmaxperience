import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';

interface GuidePageHeaderProps {
  sectionTitle: string;
  sectionSlug: string;
  pageTitle: string;
  summary: string | null;
  estimatedReadTime: number | null;
  updatedAt: string;
}

export function GuidePageHeader({
  sectionTitle,
  sectionSlug,
  pageTitle,
  summary,
  estimatedReadTime,
  updatedAt,
}: GuidePageHeaderProps) {
  return (
    <div>
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-[14px] text-muted-foreground">
          <li>
            <Link
              href={'/guide/' + sectionSlug}
              className="hover:underline hover:text-foreground transition-colors"
            >
              {sectionTitle}
            </Link>
          </li>
          <li>
            <ChevronRight className="size-3.5" />
          </li>
          <li className="text-foreground">{pageTitle}</li>
        </ol>
      </nav>

      <h1 className="text-[24px] font-semibold leading-[1.2] mt-3">
        {pageTitle}
      </h1>

      {summary && (
        <p className="text-[16px] text-muted-foreground mt-2">{summary}</p>
      )}

      <div className="flex items-center gap-3 text-[14px] text-muted-foreground mt-3">
        <span>~{estimatedReadTime ?? 1} min read</span>
        <span>&middot;</span>
        <span>
          Updated{' '}
          {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
        </span>
      </div>

      <Separator className="mt-6" />
    </div>
  );
}
