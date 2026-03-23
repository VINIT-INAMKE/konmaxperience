import { parseString } from '@fast-csv/parse';

export async function parseCSV(
  buffer: Buffer,
): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    const content = buffer.toString('utf-8').replace(/^\uFEFF/, ''); // strip BOM
    parseString(content, {
      headers: true,
      trim: true,
      ignoreEmpty: true,
    })
      .on('data', (row: Record<string, string>) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}
