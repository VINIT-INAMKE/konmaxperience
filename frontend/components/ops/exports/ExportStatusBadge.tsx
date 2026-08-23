import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';

const statusConfig = {
  completed: { label: 'Completed', className: STATUS_BADGE.good },
  generating: { label: 'Generating', className: STATUS_BADGE.warning },
  failed: { label: 'Failed', className: STATUS_BADGE.serious },
} as const;

interface ExportStatusBadgeProps {
  status: 'completed' | 'generating' | 'failed';
}

export function ExportStatusBadge({ status }: ExportStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className} aria-label={config.label}>
      {config.label}
    </Badge>
  );
}
