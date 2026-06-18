import * as XLSX from 'xlsx';

/**
 * Spreadsheet export helpers built on SheetJS.
 *
 * A workbook is a list of sheets. Build sheets two ways:
 *   - `tableSheet`  — a flat table from a column spec + array of rows.
 *   - `matrixSheet` — a raw array-of-arrays grid (used for the schedule layout).
 *
 * Then hand the sheets to `downloadWorkbook`, which triggers a browser download.
 */

export interface Column<T> {
  header: string;
  /** Cell value for a given row. Null/undefined render as an empty cell. */
  value: (row: T) => string | number | null | undefined;
  /** Column width in characters. Defaults to a width derived from the header. */
  width?: number;
}

type Cell = string | number | null;

export interface SheetSpec {
  name: string;
  aoa: Cell[][];
  colWidths?: number[];
}

// Excel sheet names cap at 31 chars and forbid : \ / ? * [ ]
function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
}

export function tableSheet<T>(name: string, columns: Column<T>[], rows: T[]): SheetSpec {
  const header = columns.map((c) => c.header);
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = c.value(row);
      return v == null ? '' : v;
    }),
  );
  return {
    name: sanitizeSheetName(name),
    aoa: [header, ...body],
    colWidths: columns.map((c) => c.width ?? Math.max(c.header.length + 2, 12)),
  };
}

export function matrixSheet(name: string, aoa: Cell[][], colWidths?: number[]): SheetSpec {
  return { name: sanitizeSheetName(name), aoa, colWidths };
}

export function downloadWorkbook(filename: string, sheets: SheetSpec[]) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  sheets.forEach((sheet) => {
    // Guarantee unique sheet names (Excel rejects duplicates)
    let name = sheet.name;
    let i = 2;
    while (used.has(name.toLowerCase())) {
      name = `${sheet.name.slice(0, 28)} ${i++}`;
    }
    used.add(name.toLowerCase());

    const ws = XLSX.utils.aoa_to_sheet(sheet.aoa);
    if (sheet.colWidths) ws['!cols'] = sheet.colWidths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  const safeName = filename.replace(/[\\/:*?"<>|]/g, '-');
  XLSX.writeFile(wb, safeName.endsWith('.xlsx') ? safeName : `${safeName}.xlsx`);
}
