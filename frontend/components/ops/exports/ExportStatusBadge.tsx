import { Badge } from '@/components/ui/badge';

const statusConfig = {
  completed: {
    label: 'Completed',
    className: 'bg-success/10 text-success border-success/20',
  },
  generating: {
    label: 'Generating',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  failed: {
    label: 'Failed',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
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
