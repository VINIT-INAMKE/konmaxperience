import ExcelJS from 'exceljs';

export async function parseXLSX(
  buffer: Buffer,
): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0]; // always read first sheet (Instructions is second)

  if (!sheet || sheet.rowCount < 2) {
    return [];
  }

  const headers: string[] = [];
  const rows: Record<string, string>[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        headers.push(String(cell.value ?? '').trim().toLowerCase());
      });
      return;
    }
    const record: Record<string, string> = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        // Handle ExcelJS Date objects per research pitfall #2
        const val =
          cell.value instanceof Date
            ? cell.value.toISOString().slice(0, 10)
            : String(cell.value ?? '').trim();
        record[header] = val;
        if (val) hasAnyValue = true;
      }
    });
    if (hasAnyValue) rows.push(record);
  });

  return rows;
}
