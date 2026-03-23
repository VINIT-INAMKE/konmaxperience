import ExcelJS from 'exceljs';

/**
 * Parses a single worksheet into an array of record objects.
 * Row 1 = headers (lowercased, trimmed), subsequent rows = data.
 * Handles Date objects and numeric cells gracefully.
 */
function parseSheet(
  sheet: ExcelJS.Worksheet,
): { headers: string[]; rows: Record<string, string>[] } {
  const headers: string[] = [];
  const rows: Record<string, string>[] = [];

  if (!sheet || sheet.rowCount < 2) {
    return { headers, rows };
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(String(cell.value ?? '').trim().toLowerCase());
      });
      return;
    }
    const record: Record<string, string> = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        // Handle ExcelJS Date objects and numeric cells
        let val: string;
        if (cell.value instanceof Date) {
          val = cell.value.toISOString().slice(0, 10);
        } else if (typeof cell.value === 'number') {
          val = String(cell.value);
        } else {
          val = String(cell.value ?? '').trim();
        }
        record[header] = val;
        if (val) hasAnyValue = true;
      }
    });
    if (hasAnyValue) rows.push(record);
  });

  return { headers, rows };
}

/**
 * Parses a multi-sheet recipe XLSX workbook (D-13).
 * Sheet 1 (worksheets[0]): Recipe headers
 * Sheet 2 (worksheets[1]): BOM lines (Bill of Materials)
 * Sheet 3 is Instructions (ignored by parser).
 */
export async function parseRecipeXLSX(
  buffer: Buffer,
): Promise<{ headers: Record<string, string>[]; bomLines: Record<string, string>[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const headerSheet = workbook.worksheets[0];
  const bomSheet = workbook.worksheets[1];

  const headerResult = headerSheet
    ? parseSheet(headerSheet)
    : { headers: [], rows: [] };

  const bomResult = bomSheet
    ? parseSheet(bomSheet)
    : { headers: [], rows: [] };

  return {
    headers: headerResult.rows,
    bomLines: bomResult.rows,
  };
}
