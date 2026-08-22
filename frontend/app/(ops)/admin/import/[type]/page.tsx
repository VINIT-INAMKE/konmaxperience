'use client';

import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  FileDown,
  Loader2,
  ArrowLeft,
  X,
  AlertTriangle,
  Info,
  Package,
  Store,
  DollarSign,
  Warehouse,
  Target,
  Flag,
  CheckSquare,
  TrendingUp,
  Calendar,
  ChefHat,
  LayoutGrid,
  UtensilsCrossed,
  ChevronDown,
  ChevronRight,
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
  type RecipeParseResult,
  type CommitResult,
} from '@/lib/types/imports';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ICON_MAP: Record<ImportType, React.ReactNode> = {
  ingredients: <Package className="size-6 text-muted-foreground" />,
  vendors: <Store className="size-6 text-muted-foreground" />,
  vendor_pricing: <DollarSign className="size-6 text-muted-foreground" />,
  opening_stock: <Warehouse className="size-6 text-muted-foreground" />,
  missions: <Target className="size-6 text-muted-foreground" />,
  quests: <Flag className="size-6 text-muted-foreground" />,
  tasks: <CheckSquare className="size-6 text-muted-foreground" />,
  kpis: <TrendingUp className="size-6 text-muted-foreground" />,
  events: <Calendar className="size-6 text-muted-foreground" />,
  recipes: <ChefHat className="size-6 text-muted-foreground" />,
  menu_categories: <LayoutGrid className="size-6 text-muted-foreground" />,
  menu_items: <UtensilsCrossed className="size-6 text-muted-foreground" />,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getUpdateLabel(type: ImportType): string {
  switch (type) {
    case 'recipes':
      return 'Replace BOM lines for matching draft recipes. Approved recipes are never modified.';
    case 'quests':
      return 'Update matching quests. Quests with status other than "planned" cannot be modified.';
    case 'tasks':
      return 'Update matching tasks. Completed tasks (status = "done") cannot be modified.';
    case 'events':
      return 'Update matching events. Capacity cannot be reduced below existing bookings.';
    default:
      return 'Update existing records. Matching by name \u2014 existing records will be overwritten.';
  }
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
  const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set());

  // Redirect if invalid type. Must be an effect (not an early return) so that every
  // hook below still runs in the same order on every render.
  useEffect(() => {
    if (!isValidType) {
      router.replace('/admin/import');
    }
  }, [isValidType, router]);

  const config = IMPORT_TYPE_CONFIG[importType];

  // Cast parseResult for recipe type
  const recipeParseResult = importType === 'recipes' ? (parseResult as RecipeParseResult | null) : null;

  // Compute importable row count
  const importableCount = rows.filter(
    (r) =>
      r.status === 'valid' ||
      (r.status === 'duplicate' && updateExisting),
  ).length;

  // ── File validation ──
  const isValidFile = (f: File): boolean => {
    // Recipe imports require XLSX only
    if (importType === 'recipes') {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
      return ext === '.xlsx' || f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.csv', '.xlsx'];
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    return validTypes.includes(f.type) || validExtensions.includes(ext);
  };

  const getFileTypeError = (): string => {
    if (importType === 'recipes') {
      return 'Recipes require XLSX format \u2014 CSV is not supported';
    }
    return 'Only CSV and XLSX files are accepted';
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
        setFileError(getFileTypeError());
        return;
      }

      setFile(droppedFile);
      setParseResult(null);
      setRows([]);
      setCommitResult(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importType],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFileError(null);
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      if (!isValidFile(selectedFile)) {
        setFileError(getFileTypeError());
        return;
      }

      setFile(selectedFile);
      setParseResult(null);
      setRows([]);
      setCommitResult(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importType],
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

      let response = await fetch(`${API_BASE_URL}/imports/parse`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      // Mirror apiClient auth: retry once after silent token refresh on 401
      if (response.status === 401) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });
          if (refreshRes.ok) {
            response = await fetch(`${API_BASE_URL}/imports/parse`, {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });
          }
        } catch {
          // refresh failed — fall through to error handling below
        }
      }

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

      // For recipes, expand all recipes by default
      if (importType === 'recipes' && result.rows) {
        setExpandedRecipes(new Set(result.rows.map(r => ((r.raw.name || '') as string).trim().toLowerCase())));
      }
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

    // Propagate recipe name edits to BOM rows
    if (importType === 'recipes' && field === 'name' && recipeParseResult) {
      const oldName = rows[rowIdx]?.raw.name;
      if (oldName && oldName !== editValue) {
        recipeParseResult.bomRows.forEach(bom => {
          if (((bom.raw.recipe_name || '') as string).trim().toLowerCase() === (oldName as string).trim().toLowerCase()) {
            bom.raw.recipe_name = editValue;
          }
        });
      }
    }

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
  }, [editingCell, editValue, importType, recipeParseResult, rows]);

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
      // Build commit body — include bomRows for recipes
      const commitBody: Record<string, unknown> = {
        importType,
        rows,
        updateExisting,
      };
      if (importType === 'recipes' && recipeParseResult?.bomRows) {
        commitBody.bomRows = recipeParseResult.bomRows;
      }

      const result = await apiClient.post<CommitResult>('/imports/commit', commitBody);

      setCommitResult(result);

      const total = result.imported + result.updated;
      if (total > 0 && result.errors === 0) {
        toast.success(`${total} records imported successfully`);
      } else if (total > 0 && result.errors > 0) {
        toast.warning(`${result.imported} imported, ${result.errors} failed, ${result.skipped} skipped`);
      } else {
        toast.error('Import failed. Try again or contact support.');
      }
    } catch {
      toast.error('Import failed. Try again or contact support.');
    } finally {
      setIsCommitting(false);
    }
  }, [importType, rows, updateExisting, importableCount, recipeParseResult]);

  // ── Row status helpers ──
  const renderStatusBadge = (row: ImportRow) => {
    switch (row.status) {
      case 'valid':
        return (
          <span className="inline-block size-2.5 rounded-full bg-green-500" />
        );
      case 'invalid':
        return (
          <>
            <span className="inline-block size-2.5 rounded-full bg-red-500 mr-2" />
            <Badge variant="destructive" className="text-xs">
              Invalid
            </Badge>
          </>
        );
      case 'duplicate':
        return (
          <>
            <span className="inline-block size-2.5 rounded-full bg-amber-500 mr-2" />
            <Badge
              variant={updateExisting ? 'secondary' : 'outline'}
              className="text-xs whitespace-nowrap"
            >
              {updateExisting ? 'Duplicate \u2014 will update' : 'Duplicate \u2014 will skip'}
            </Badge>
          </>
        );
      case 'blocked':
        return (
          <>
            <span className="inline-block size-2.5 rounded-full bg-red-500 mr-2" />
            <Badge variant="destructive" className="text-xs">
              Blocked
            </Badge>
          </>
        );
      default:
        return null;
    }
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
  const blockedCount = rows.filter((r) => r.status === 'blocked').length;

  // ── Template download handler for XLSX ──
  const handleDownloadXlsxTemplate = () => {
    window.open(`${API_BASE_URL}/imports/template/${importType}`, '_blank');
  };

  // Render nothing while the effect above redirects away from an unknown import type.
  if (!isValidType) {
    return null;
  }

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

      {/* Stock additive warning banner (D-23) */}
      {importType === 'opening_stock' && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Stock imports are ADDITIVE. Each row adds to current inventory. If you import this file twice, quantities will be doubled.
          </p>
        </div>
      )}

      {/* Recipe draft notice info banner */}
      {importType === 'recipes' && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
          <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Recipes import as drafts. Approve them in the app before linking to menu items.
          </p>
        </div>
      )}

      {/* Download Template section */}
      <div className="flex flex-col gap-2">
        {importType === 'recipes' ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadXlsxTemplate}>
              <FileDown className="size-4 mr-2" />
              Download Template (.xlsx)
            </Button>
            <Badge variant="outline">XLSX only</Badge>
          </div>
        ) : (
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
        )}
        {importType === 'recipes' && (
          <p className="text-xs text-muted-foreground">
            Recipes require two sheets (Recipe headers + BOM lines). CSV format is not supported.
          </p>
        )}
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
              {importType === 'recipes'
                ? 'Drag and drop your XLSX file here'
                : 'Drag and drop your CSV or XLSX file here'}
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
            accept={importType === 'recipes' ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
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

      {/* Stock re-import warning banner (D-09, D-22) */}
      {parseResult?.warning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {parseResult.warning}
          </p>
        </div>
      )}

      {/* Update existing records toggle — hidden for opening_stock */}
      {parseResult && !commitResult && importType !== 'opening_stock' && (
        <div className="flex items-center gap-2">
          <Switch
            checked={updateExisting}
            onCheckedChange={setUpdateExisting}
          />
          <label className="text-sm">
            {getUpdateLabel(importType)}
          </label>
        </div>
      )}

      {/* Row count summary */}
      {parseResult && (
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-4 text-sm">
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
          {blockedCount > 0 && (
            <span className="text-red-600">
              <strong>{blockedCount}</strong> blocked
            </span>
          )}
        </div>
      )}

      {/* Recipe grouped preview table (D-14) */}
      {importType === 'recipes' && recipeParseResult && rows.length > 0 ? (
        <TooltipProvider delay={200}>
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              {recipeParseResult.rows.length} recipes, {recipeParseResult.bomRows?.length || 0} BOM lines
            </p>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-[var(--background)]">
                  <TableRow>
                    <TableHead className="w-8 sticky left-0 z-20 bg-[var(--background)]"></TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider sticky left-8 z-20 bg-[var(--background)]">Status</TableHead>
                    {recipeParseResult.columns.map(col => (
                      <TableHead key={col} className="text-xs font-bold uppercase tracking-wider">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((headerRow, idx) => {
                    const recipeName = ((headerRow.raw.name || '') as string).trim().toLowerCase();
                    const isExpanded = expandedRecipes.has(recipeName);
                    const bomLines = (recipeParseResult.bomRows || []).filter(
                      b => ((b.raw.recipe_name || '') as string).trim().toLowerCase() === recipeName
                    );

                    return (
                      <Fragment key={idx}>
                        {/* Recipe header row */}
                        <TableRow className="bg-[var(--muted)] font-bold">
                          <TableCell className="sticky left-0 z-10 bg-[var(--muted)]">
                            <button
                              onClick={() => {
                                const next = new Set(expandedRecipes);
                                isExpanded ? next.delete(recipeName) : next.add(recipeName);
                                setExpandedRecipes(next);
                              }}
                              aria-label={isExpanded ? `Collapse recipe ${headerRow.raw.name}` : `Expand recipe ${headerRow.raw.name}`}
                            >
                              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                          </TableCell>
                          <TableCell className="sticky left-8 z-10 bg-[var(--muted)]">
                            <div className="flex items-center gap-1">
                              {renderStatusBadge(headerRow)}
                              {bomLines.length > 0 && (
                                <Badge variant="outline" className="ml-2 text-xs">{bomLines.length} lines</Badge>
                              )}
                            </div>
                          </TableCell>
                          {recipeParseResult.columns.map(col => {
                            const cellError = getCellError(headerRow, col);
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
                                        {headerRow.raw[col] || '(empty)'}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {cellError}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span>{String(headerRow.raw[col] || '')}</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        {/* BOM line rows (collapsible) */}
                        {isExpanded && bomLines.map((bomRow, bomIdx) => {
                          const isParentInvalid = headerRow.status === 'invalid' || headerRow.status === 'blocked';
                          const bomCols = recipeParseResult.bomColumns || [];
                          return (
                            <TableRow
                              key={`bom-${idx}-${bomIdx}`}
                              className={isParentInvalid ? 'opacity-50 pointer-events-none' : ''}
                            >
                              <TableCell className="sticky left-0 z-10 bg-[var(--background)]"></TableCell>
                              <TableCell className="pl-6 sticky left-8 z-10 bg-[var(--background)]">
                                {renderStatusBadge(bomRow)}
                              </TableCell>
                              {bomCols.map((col) => {
                                const cellError = getCellError(bomRow, col);
                                return (
                                  <TableCell
                                    key={col}
                                    className={cellError ? 'border-b-2 border-[var(--destructive)]' : ''}
                                  >
                                    {cellError ? (
                                      <Tooltip>
                                        <TooltipTrigger className="text-left w-full">
                                          <span className="text-destructive">
                                            {String(bomRow.raw[col] || '(empty)')}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>{cellError}</TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <span className={col === 'recipe_name' ? 'text-muted-foreground' : ''}>
                                        {String(bomRow.raw[col] || '')}
                                      </span>
                                    )}
                                  </TableCell>
                                );
                              })}
                              {/* Fill remaining recipe header columns with empty cells */}
                              {recipeParseResult.columns.slice(bomCols.length).map((col, i) => (
                                <TableCell key={`pad-${i}`}></TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TooltipProvider>
      ) : (
        /* Standard Preview Table */
        parseResult && rows.length > 0 && (
          <TooltipProvider delay={200}>
            {/* Mobile card view (<640px) */}
            <div className="sm:hidden space-y-3">
              {rows.map((row, idx) => (
                <div key={row.rowIndex} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {renderStatusBadge(row)}
                  </div>
                  {parseResult.columns.map((col) => {
                    const cellError = getCellError(row, col);
                    const isEditing =
                      editingCell?.rowIdx === idx &&
                      editingCell?.field === col;
                    return (
                      <div
                        key={col}
                        className={`flex items-start gap-2 text-sm cursor-pointer ${
                          cellError ? 'text-destructive' : ''
                        }`}
                        onClick={() => {
                          if (!isEditing) startEditing(idx, col);
                        }}
                      >
                        <span className="text-xs font-medium text-muted-foreground uppercase shrink-0 w-24 pt-0.5">
                          {col}
                        </span>
                        {isEditing ? (
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            className="h-7 text-sm flex-1"
                            autoFocus
                          />
                        ) : cellError ? (
                          <Tooltip>
                            <TooltipTrigger className="text-left">
                              <span className="text-destructive">
                                {row.raw[col] || '(empty)'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{cellError}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="break-all">{row.raw[col] || ''}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Desktop/tablet table view (>=640px) */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-[var(--background)]">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider w-[80px] sticky left-0 z-20 bg-[var(--background)]">
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
                      <TableCell className="sticky left-0 z-10 bg-[var(--background)]">
                        <div className="flex items-center gap-2">
                          {renderStatusBadge(row)}
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
        )
      )}

      {/* Import N Records button — sticky on mobile when scrolling through preview */}
      {parseResult && !commitResult && (
        <div className="sticky bottom-0 z-30 sm:static bg-[var(--background)] py-3 sm:py-0 border-t sm:border-t-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          <Button
            onClick={handleCommit}
            disabled={importableCount === 0 || isParsing || isCommitting}
            className="w-full sm:w-auto"
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
        </div>
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
          <h3 className="text-lg font-bold">File parsed &mdash; no importable rows found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Download the template to see the required column format, then re-upload.
          </p>
        </div>
      )}
    </div>
  );
}
