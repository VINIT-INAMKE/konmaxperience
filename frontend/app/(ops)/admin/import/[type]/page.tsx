'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  FileDown,
  Loader2,
  ArrowLeft,
  X,
  AlertTriangle,
  Package,
  Store,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api-client';
import {
  IMPORT_TYPES,
  IMPORT_TYPE_CONFIG,
  type ImportType,
  type ImportRow,
  type ParseResult,
  type CommitResult,
} from '@/lib/types/imports';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ICON_MAP: Record<ImportType, React.ReactNode> = {
  ingredients: <Package className="size-6 text-muted-foreground" />,
  vendors: <Store className="size-6 text-muted-foreground" />,
  vendor_pricing: <DollarSign className="size-6 text-muted-foreground" />,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportTypePage() {
  const params = useParams<{ type: string }>();
  const router = useRouter();
  const importType = params.type as ImportType;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate import type
  const isValidType = IMPORT_TYPES.includes(importType);

  // State
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [editingCell, setEditingCell] = useState<{
    rowIdx: number;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  // Redirect if invalid type
  if (!isValidType) {
    router.replace('/admin/import');
    return null;
  }

  const config = IMPORT_TYPE_CONFIG[importType];

  // Compute importable row count
  const importableCount = rows.filter(
    (r) =>
      r.status === 'valid' ||
      (r.status === 'duplicate' && updateExisting),
  ).length;

  // ── File validation ──
  const isValidFile = (f: File): boolean => {
    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.csv', '.xlsx'];
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    return validTypes.includes(f.type) || validExtensions.includes(ext);
  };

  // ── Drag-drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      setFileError(null);

      const droppedFile = e.dataTransfer.files[0];
      if (!droppedFile) return;

      if (!isValidFile(droppedFile)) {
        setFileError('Only CSV and XLSX files are accepted');
        return;
      }

      setFile(droppedFile);
      setParseResult(null);
      setRows([]);
      setCommitResult(null);
    },
    [],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFileError(null);
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      if (!isValidFile(selectedFile)) {
        setFileError('Only CSV and XLSX files are accepted');
        return;
      }

      setFile(selectedFile);
      setParseResult(null);
      setRows([]);
      setCommitResult(null);
    },
    [],
  );

  const removeFile = useCallback(() => {
    setFile(null);
    setFileError(null);
    setParseResult(null);
    setRows([]);
    setCommitResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ── Parse file ──
  const handleParse = useCallback(async () => {
    if (!file) return;

    setIsParsing(true);
    setCommitResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('importType', importType);

      const response = await fetch(`${API_BASE_URL}/imports/parse`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        let message = 'Could not read this file. Make sure it is a valid CSV or XLSX and try again.';
        try {
          const body = await response.json();
          if (body.message) message = body.message;
        } catch {
          // ignore
        }
        toast.error(message);
        return;
      }

      const result: ParseResult = await response.json();
      setParseResult(result);
      // Deep copy rows for inline editing
      setRows(JSON.parse(JSON.stringify(result.rows)));
    } catch {
      toast.error(
        'Could not read this file. Make sure it is a valid CSV or XLSX and try again.',
      );
    } finally {
      setIsParsing(false);
    }
  }, [file, importType]);

  // ── Inline cell editing ──
  const startEditing = useCallback(
    (rowIdx: number, field: string) => {
      if (commitResult) return; // Don't allow editing after commit
      setEditingCell({ rowIdx, field });
      setEditValue(rows[rowIdx]?.raw[field] ?? '');
    },
    [rows, commitResult],
  );

  const commitEdit = useCallback(() => {
    if (!editingCell) return;

    const { rowIdx, field } = editingCell;
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIdx] };
      row.raw = { ...row.raw, [field]: editValue };
      row.validated = { ...row.validated, [field]: editValue };

      // Remove error for this field
      const prevErrors = row.errors;
      row.errors = prevErrors.filter((e) => e.field !== field);

      // If this field had the only error and it was removed, update status to valid
      if (
        row.status === 'invalid' &&
        prevErrors.some((e) => e.field === field) &&
        row.errors.length === 0
      ) {
        row.status = 'valid';
      }

      next[rowIdx] = row;
      return next;
    });

    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      } else if (e.key === 'Escape') {
        setEditingCell(null);
        setEditValue('');
      }
    },
    [commitEdit],
  );

  // ── Commit import ──
  const handleCommit = useCallback(async () => {
    if (importableCount === 0) return;

    setIsCommitting(true);

    try {
      const result = await apiClient.post<CommitResult>('/imports/commit', {
        importType,
        rows,
        updateExisting,
      });

      setCommitResult(result);

      const total = result.imported + result.updated;
      if (total > 0 && result.errors === 0) {
        toast.success(`${total} records imported successfully`);
      } else if (total > 0 && result.errors > 0) {
        toast.success(`${result.imported} imported, ${result.skipped} skipped`);
      } else {
        toast.error('Import failed. Try again or contact support.');
      }
    } catch {
      toast.error('Import failed. Try again or contact support.');
    } finally {
      setIsCommitting(false);
    }
  }, [importType, rows, updateExisting, importableCount]);

  // ── Row status helpers ──
  const getStatusBadge = (row: ImportRow) => {
    switch (row.status) {
      case 'valid':
        return (
          <span className="inline-block size-2.5 rounded-full bg-green-500" />
        );
      case 'invalid':
        return (
          <span className="inline-block size-2.5 rounded-full bg-red-500" />
        );
      case 'duplicate':
        return (
          <span className="inline-block size-2.5 rounded-full bg-amber-500" />
        );
      default:
        return null;
    }
  };

  const getDuplicateLabel = (row: ImportRow) => {
    if (row.status !== 'duplicate') return null;
    return updateExisting ? 'Duplicate — will update' : 'Duplicate — will skip';
  };

  // ── Error helpers ──
  const getCellError = (row: ImportRow, field: string): string | null => {
    const err = row.errors.find((e) => e.field === field);
    return err?.message ?? null;
  };

  // Recompute summary counts from current rows state
  const validCount = rows.filter((r) => r.status === 'valid').length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const duplicateCount = rows.filter((r) => r.status === 'duplicate').length;

  return (
    <div className="space-y-6">
      {/* Back link + Page header */}
      <div>
        <Link
          href="/admin/import"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to Import
        </Link>
        <div className="flex items-center gap-3">
          {ICON_MAP[importType]}
          <div>
            <h1 className="text-2xl font-bold">Import {config.label}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>
      </div>

      {/* Download Template section */}
      <div className="flex items-center gap-3">
        <a
          href={`${API_BASE_URL}/imports/template/${importType}`}
          download
        >
          <Button variant="outline" size="sm">
            <FileDown className="size-4 mr-1.5" />
            Download Template (.xlsx)
          </Button>
        </a>
        <a
          href={`${API_BASE_URL}/imports/template/${importType}/csv`}
          download
        >
          <Button variant="outline" size="sm">
            <FileDown className="size-4 mr-1.5" />
            Download Template (.csv)
          </Button>
        </a>
      </div>

      {/* Upload Zone */}
      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 min-h-[160px] cursor-pointer transition-all ${
            isDragOver
              ? 'border-[var(--primary)] bg-[var(--muted)] scale-[1.01]'
              : fileError
                ? 'border-[var(--destructive)]'
                : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--muted)]'
          }`}
        >
          <Upload className="size-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">
              Drag and drop your CSV or XLSX file here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>
          {fileError && (
            <p className="text-sm text-destructive">{fileError}</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
          {!parseResult && !isParsing && (
            <button
              onClick={removeFile}
              className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
              aria-label="Remove file"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Parse File button */}
      {file && !parseResult && !isParsing && (
        <Button onClick={handleParse}>Parse File</Button>
      )}

      {/* Parsing loading state */}
      {isParsing && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Parsing...
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      )}

      {/* Update existing records toggle */}
      {parseResult && !commitResult && (
        <div className="flex items-center gap-3">
          <Switch
            checked={updateExisting}
            onCheckedChange={setUpdateExisting}
          />
          <div>
            <p className="text-sm font-medium">Update existing records</p>
            <p className="text-xs text-muted-foreground">
              Matching by name — existing records will be overwritten
            </p>
          </div>
        </div>
      )}

      {/* Row count summary */}
      {parseResult && (
        <div className="flex items-center gap-4 text-sm">
          <span>
            <strong>{rows.length}</strong> rows parsed
          </span>
          <span className="text-green-600">
            <strong>{validCount}</strong> valid
          </span>
          <span className="text-red-600">
            <strong>{invalidCount}</strong> invalid
          </span>
          {duplicateCount > 0 && (
            <span className="text-amber-600">
              <strong>{duplicateCount}</strong> duplicates
            </span>
          )}
        </div>
      )}

      {/* Preview Table */}
      {parseResult && rows.length > 0 && (
        <TooltipProvider delay={200}>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-[var(--background)]">
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase tracking-wider w-[80px]">
                    Status
                  </TableHead>
                  {parseResult.columns.map((col) => (
                    <TableHead
                      key={col}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.rowIndex}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(row)}
                        {row.status === 'duplicate' && (
                          <Badge
                            variant={
                              updateExisting ? 'secondary' : 'outline'
                            }
                            className="text-[10px] whitespace-nowrap"
                          >
                            {getDuplicateLabel(row)}
                          </Badge>
                        )}
                        {row.status === 'invalid' && (
                          <Badge
                            variant="destructive"
                            className="text-[10px]"
                          >
                            Invalid
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {parseResult.columns.map((col) => {
                      const cellError = getCellError(row, col);
                      const isEditing =
                        editingCell?.rowIdx === idx &&
                        editingCell?.field === col;

                      return (
                        <TableCell
                          key={col}
                          className={`cursor-pointer ${
                            cellError
                              ? 'border-b-2 border-[var(--destructive)]'
                              : ''
                          }`}
                          onClick={() => {
                            if (!isEditing) startEditing(idx, col);
                          }}
                        >
                          {isEditing ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleEditKeyDown}
                              className="h-7 text-sm"
                              autoFocus
                            />
                          ) : cellError ? (
                            <Tooltip>
                              <TooltipTrigger className="text-left w-full">
                                <span className="text-destructive">
                                  {row.raw[col] || '(empty)'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {cellError}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span>{row.raw[col] || ''}</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      )}

      {/* Import N Records button */}
      {parseResult && !commitResult && (
        <Button
          onClick={handleCommit}
          disabled={importableCount === 0 || isParsing || isCommitting}
        >
          {isCommitting ? (
            <>
              <Loader2 className="size-4 animate-spin mr-1.5" />
              Importing...
            </>
          ) : (
            <>Import {importableCount} Records</>
          )}
        </Button>
      )}

      {/* Import Result Summary */}
      {commitResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4 min-h-[48px]">
              <p className="text-2xl font-bold text-green-600">
                {commitResult.imported}
              </p>
              <p className="text-xs text-muted-foreground">Imported</p>
            </div>
            <div className="rounded-lg border p-4 min-h-[48px]">
              <p className="text-2xl font-bold text-blue-600">
                {commitResult.updated}
              </p>
              <p className="text-xs text-muted-foreground">Updated</p>
            </div>
            <div className="rounded-lg border p-4 min-h-[48px]">
              <p className="text-2xl font-bold text-muted-foreground">
                {commitResult.skipped}
              </p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div className="rounded-lg border p-4 min-h-[48px]">
              <p className="text-2xl font-bold text-red-600">
                {commitResult.errors}
              </p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>

          {commitResult.errors > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {commitResult.errors} rows had errors and were not imported.
                Fix them inline and re-import.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state when parse returns 0 rows */}
      {parseResult && rows.length === 0 && (
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold">No imports yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a CSV or XLSX file above to get started. Download the
            template to see the required column format.
          </p>
        </div>
      )}
    </div>
  );
}
