'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportDialog } from './ExportDialog';
import type { ReportType } from '@/lib/types/exports';

interface ExportButtonProps {
  reportType: ReportType;
  reportName: string;
  isTimeSeries: boolean;
  currentFilters?: Record<string, string>;
}

export function ExportButton({
  reportType,
  reportName,
  isTimeSeries,
  currentFilters,
}: ExportButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setDialogOpen(true)}
        disabled={isExporting}
        aria-label={`Export ${reportName}`}
      >
        {isExporting ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <FileDown className="size-4 mr-2" />
        )}
        {isExporting ? 'Exporting...' : 'Export'}
      </Button>
      <ExportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        reportType={reportType}
        reportName={reportName}
        isTimeSeries={isTimeSeries}
        currentFilters={currentFilters}
        onExportingChange={setIsExporting}
      />
    </>
  );
}
