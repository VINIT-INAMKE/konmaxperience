'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  EXPORT_TYPE_CONFIG,
  type ReportType,
  type GenerateExportPayload,
  type GenerateExportResponse,
} from '@/lib/types/exports';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType: ReportType;
  reportName: string;
  isTimeSeries: boolean;
  currentFilters?: Record<string, string>;
  onExportingChange?: (exporting: boolean) => void;
}

function formatFilterSummary(filters: Record<string, string>): string {
  return Object.entries(filters)
    .filter(([, v]) => v && v.length > 0)
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      return `${label}: ${v}`;
    })
    .join(' \u00b7 ');
}

export function ExportDialog({
  open,
  onOpenChange,
  reportType,
  reportName,
  isTimeSeries,
  currentFilters,
  onExportingChange,
}: ExportDialogProps) {
  const queryClient = useQueryClient();
  const config = EXPORT_TYPE_CONFIG[reportType];

  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
  const [dateFrom, setDateFrom] = useState(currentFilters?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(currentFilters?.dateTo ?? '');

  const hasActiveFilters =
    currentFilters &&
    Object.entries(currentFilters).some(
      ([k, v]) => v && v.length > 0 && k !== 'dateFrom' && k !== 'dateTo',
    );

  const { mutate, isPending: isGenerating } = useMutation({
    mutationFn: (payload: GenerateExportPayload) =>
      apiClient.post<GenerateExportResponse>('/exports/generate', payload),
    onSuccess: (data) => {
      onOpenChange(false);
      onExportingChange?.(false);
      queryClient.invalidateQueries({ queryKey: ['exports', 'history'] });
      toast.success('Export ready. Click to download.', {
        action: {
          label: 'Download',
          onClick: () => window.open(data.downloadUrl, '_blank'),
        },
      });
    },
    onError: () => {
      onOpenChange(false);
      onExportingChange?.(false);
      toast.error('Export failed. The file could not be generated. Try again.');
    },
  });

  function handleExport() {
    onExportingChange?.(true);
    const payload: GenerateExportPayload = {
      reportType,
      format,
    };
    if (isTimeSeries && dateFrom) payload.dateFrom = dateFrom;
    if (isTimeSeries && dateTo) payload.dateTo = dateTo;
    if (currentFilters) {
      const nonDateFilters = Object.entries(currentFilters)
        .filter(([k, v]) => v && v.length > 0 && k !== 'dateFrom' && k !== 'dateTo')
        .reduce(
          (acc, [k, v]) => {
            acc[k] = v;
            return acc;
          },
          {} as Record<string, string>,
        );
      if (Object.keys(nonDateFilters).length > 0) {
        payload.filters = JSON.stringify(nonDateFilters);
      }
    }
    mutate(payload);
  }

  function handleClose() {
    if (!isGenerating) {
      onOpenChange(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, selectedFormat: 'csv' | 'xlsx') {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setFormat(selectedFormat);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Export {reportName}</DialogTitle>
          <DialogDescription>
            Download a snapshot of {config?.description ?? reportName.toLowerCase()} as CSV or
            XLSX.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Format selector */}
          <div role="radiogroup" aria-label="Export format" className="grid grid-cols-2 gap-3">
            <div
              role="radio"
              aria-checked={format === 'csv'}
              tabIndex={0}
              onClick={() => setFormat('csv')}
              onKeyDown={(e) => handleKeyDown(e, 'csv')}
              className={cn(
                'rounded-lg border-2 p-3 cursor-pointer flex items-center gap-2 transition-colors',
                format === 'csv'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40 bg-background',
              )}
            >
              <FileText className="size-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">CSV</div>
                <div className="text-sm text-muted-foreground">Universal</div>
              </div>
            </div>
            <div
              role="radio"
              aria-checked={format === 'xlsx'}
              tabIndex={0}
              onClick={() => setFormat('xlsx')}
              onKeyDown={(e) => handleKeyDown(e, 'xlsx')}
              className={cn(
                'rounded-lg border-2 p-3 cursor-pointer flex items-center gap-2 transition-colors',
                format === 'xlsx'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40 bg-background',
              )}
            >
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">XLSX</div>
                <div className="text-sm text-muted-foreground">Formatted</div>
              </div>
            </div>
          </div>

          {/* Date range -- time-series exports only */}
          {isTimeSeries && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">From</label>
                <Input
                  type="date"
                  aria-label="From date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">To</label>
                <Input
                  type="date"
                  aria-label="To date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Active filters summary */}
          {hasActiveFilters && currentFilters && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Includes: {formatFilterSummary(currentFilters)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isGenerating}>
            Discard
          </Button>
          <Button
            variant="default"
            onClick={handleExport}
            disabled={isGenerating}
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Export'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
