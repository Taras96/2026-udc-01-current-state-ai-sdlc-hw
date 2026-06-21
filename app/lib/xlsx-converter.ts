import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// ── Column catalogue ──────────────────────────────────────────────────────────

export const ALLOWED_COLUMNS = [
  'dms_document_id',
  'userMetadata.CmdId',
  'userMetadata.DocumentTypeId',
  'userMetadata.ProductTypeId',
  'userMetadata.DocumentNumber',
  'userMetadata.AgreementDate',
  'userMetadata.ProductNumber',
  'userMetadata.ParentProductNumber',
  'userMetadata.AccountNumber',
  'userMetadata.BoxId',
  'userMetadata.DepartmentId',
  'userMetadata.QrCode',
  'systemMetadata.state',
] as const;

export type AllowedColumn = (typeof ALLOWED_COLUMNS)[number];

export const REQUIRED_COLUMNS: readonly AllowedColumn[] = [
  'dms_document_id',
  'userMetadata.CmdId',
  'userMetadata.DocumentTypeId',
  'userMetadata.ProductTypeId',
  'systemMetadata.state',
] as const;

export const DATE_COLUMN: AllowedColumn = 'userMetadata.AgreementDate';

const ALLOWED_SET = new Set<string>(ALLOWED_COLUMNS);
const REQUIRED_SET = new Set<string>(REQUIRED_COLUMNS);

// ── Types ─────────────────────────────────────────────────────────────────────

export type CsvRow = Partial<Record<AllowedColumn, string>>;

export interface CsvFileEntry {
  filename: string;
  content: string;
  rowCount: number;
}

export interface ConversionOptions {
  rowsPerFile: number;
}

export interface ConversionResult {
  csvFiles: CsvFileEntry[];
  totalRows: number;
  presentAllowedColumns: AllowedColumn[];
  skippedColumns: string[];
  missingRequiredColumns: AllowedColumn[];
}

export type ValidationErrorType =
  | 'MISSING_HEADER'
  | 'WRONG_COLUMN_COUNT'
  | 'MISSING_REQUIRED_FIELD'
  | 'SCIENTIFIC_NOTATION'
  | 'INVALID_DATE_FORMAT'
  | 'ROW_COUNT_MISMATCH';

export interface ValidationError {
  type: ValidationErrorType;
  rowIndex?: number;
  column?: AllowedColumn;
  detail: string;
}

export interface ValidationResult {
  fileIndex: number;
  filename: string;
  passed: boolean;
  errors: ValidationError[];
}

export interface ValidationSummary {
  results: ValidationResult[];
  allPassed: boolean;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatDate(date: Date): string {
  // Use UTC getters to avoid local-timezone shifting of the date portion
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatNumber(value: number): string {
  if (!isFinite(value)) {
    console.warn('Non-finite number encountered:', value);
    return '';
  }
  // toFixed(0) for integers never emits scientific notation for values up to
  // Number.MAX_SAFE_INTEGER (16 digits), which covers all realistic document IDs.
  if (Number.isInteger(value)) {
    return value.toFixed(0);
  }
  // For non-integers, toPrecision(15) covers full IEEE-754 double precision
  // without scientific notation for the vast majority of practical values.
  return parseFloat(value.toPrecision(15)).toString();
}

export function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Matches DD.MM.YYYY strings that Excel sometimes stores as plain text
const DD_MM_YYYY_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

export function formatCellValue(
  cell: XLSX.CellObject | undefined,
  columnName: AllowedColumn,
): string {
  if (cell === undefined || cell.v === undefined || cell.v === null) {
    return '';
  }

  // Date cell (cellDates:true causes SheetJS to set t:'d' and v: Date)
  if (cell.t === 'd' && cell.v instanceof Date) {
    return formatDate(cell.v);
  }

  // Treat the AgreementDate column specially even if SheetJS didn't tag it as 'd'
  // (e.g., when the cell is stored as a number serial but cellDates was active)
  if (columnName === DATE_COLUMN && cell.v instanceof Date) {
    return formatDate(cell.v);
  }

  // For the date column: also handle plain-text DD.MM.YYYY strings
  if (columnName === DATE_COLUMN && cell.t === 's' && typeof cell.v === 'string') {
    const m = DD_MM_YYYY_RE.exec(cell.v);
    if (m) {
      return `${m[3]}-${m[2]}-${m[1]}`;
    }
    // Already in YYYY-MM-DD or empty — return as-is
    return cell.v;
  }

  // Numeric cell — read raw value to avoid format_cell emitting scientific notation
  if (cell.t === 'n' && typeof cell.v === 'number') {
    return formatNumber(cell.v);
  }

  // Boolean
  if (cell.t === 'b') {
    return String(cell.v);
  }

  // String / error / anything else
  return String(cell.v);
}

// ── Extraction ────────────────────────────────────────────────────────────────

export function extractRows(workbook: XLSX.WorkBook): {
  rows: CsvRow[];
  presentAllowedColumns: AllowedColumn[];
  skippedColumns: string[];
  missingRequiredColumns: AllowedColumn[];
} {
  if (!workbook.SheetNames.length) {
    throw new Error('Workbook contains no worksheets.');
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const ref = sheet['!ref'];
  if (!ref) {
    throw new Error('First worksheet is empty.');
  }

  const range = XLSX.utils.decode_range(ref);

  // Read header row (row index = range.s.r)
  const rawHeaders: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
    const cell = sheet[addr];
    rawHeaders.push(cell?.v !== undefined ? String(cell.v).trim() : '');
  }

  if (rawHeaders.every((h) => h === '')) {
    throw new Error('Header row is empty or missing.');
  }

  // Map column indices to AllowedColumn names
  const colIndexMap = new Map<number, AllowedColumn>();
  const skippedColumns: string[] = [];

  for (let i = 0; i < rawHeaders.length; i++) {
    const header = rawHeaders[i];
    if (!header) continue;
    if (ALLOWED_SET.has(header)) {
      colIndexMap.set(i, header as AllowedColumn);
    } else {
      skippedColumns.push(header);
    }
  }

  const presentAllowedColumns = ALLOWED_COLUMNS.filter((col) =>
    [...colIndexMap.values()].includes(col),
  );

  if (presentAllowedColumns.length === 0) {
    throw new Error('No recognised columns found in the file.');
  }

  const missingRequiredColumns = REQUIRED_COLUMNS.filter(
    (col) => !presentAllowedColumns.includes(col),
  );

  if (missingRequiredColumns.length > 0) {
    throw new Error(
      `Missing required columns: ${missingRequiredColumns.join(', ')}`,
    );
  }

  // Read data rows
  const rows: CsvRow[] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const csvRow: CsvRow = {};
    for (const [colIdx, colName] of colIndexMap.entries()) {
      const addr = XLSX.utils.encode_cell({ r, c: colIdx });
      csvRow[colName] = formatCellValue(sheet[addr], colName);
    }
    rows.push(csvRow);
  }

  return { rows, presentAllowedColumns, skippedColumns, missingRequiredColumns };
}

// ── Chunking & serialisation ──────────────────────────────────────────────────

export function chunkToCsvFiles(
  rows: CsvRow[],
  columns: AllowedColumn[],
  rowsPerFile: number,
  baseFilename = 'output',
): CsvFileEntry[] {
  const safeRowsPerFile = Math.max(1, rowsPerFile);
  const headerLine = columns.map(escapeCsvField).join(',');
  const files: CsvFileEntry[] = [];

  if (rows.length === 0) {
    return files;
  }

  const totalChunks = Math.ceil(rows.length / safeRowsPerFile);
  const padLength = String(totalChunks).length;

  for (let i = 0; i < rows.length; i += safeRowsPerFile) {
    const chunk = rows.slice(i, i + safeRowsPerFile);
    const chunkIndex = Math.floor(i / safeRowsPerFile) + 1;
    const filename = `${baseFilename}_${String(chunkIndex).padStart(Math.max(padLength, 3), '0')}.csv`;

    const dataLines = chunk.map((row) =>
      columns.map((col) => escapeCsvField(row[col] ?? '')).join(','),
    );

    const content = [headerLine, ...dataLines].join('\n') + '\n';
    files.push({ filename, content, rowCount: chunk.length });
  }

  return files;
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function convertXlsxToCsv(
  arrayBuffer: ArrayBuffer,
  options?: Partial<ConversionOptions>,
): ConversionResult {
  const rowsPerFile = Math.max(1, options?.rowsPerFile ?? 10_000);

  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellNF: true,
  });

  const { rows, presentAllowedColumns, skippedColumns, missingRequiredColumns } =
    extractRows(workbook);

  const csvFiles = chunkToCsvFiles(rows, presentAllowedColumns, rowsPerFile);

  return {
    csvFiles,
    totalRows: rows.length,
    presentAllowedColumns,
    skippedColumns,
    missingRequiredColumns,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

const SCI_NOTATION_RE = /^-?\d+(\.\d+)?[eE][+\-]?\d+$/;
const DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          // Escaped double-quote
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

export function validateCsvFiles(
  files: CsvFileEntry[],
  expectedColumns: AllowedColumn[],
  rowsPerFile: number,
  totalRows: number,
): ValidationSummary {
  const safeRowsPerFile = Math.max(1, rowsPerFile);
  const results: ValidationResult[] = [];

  const dateColIndex = expectedColumns.indexOf(DATE_COLUMN);
  const requiredColIndices = expectedColumns
    .map((col, i) => (REQUIRED_SET.has(col) ? i : -1))
    .filter((i) => i !== -1);

  let rowsAccountedFor = 0;

  files.forEach((file, fileIndex) => {
    const errors: ValidationError[] = [];
    const lines = file.content.split('\n').filter((l) => l.length > 0);

    if (lines.length === 0) {
      errors.push({ type: 'MISSING_HEADER', detail: 'File is empty — no header row found.' });
      results.push({ fileIndex, filename: file.filename, passed: false, errors });
      return;
    }

    // Validate header
    const headerFields = parseCsvLine(lines[0]);
    if (headerFields.length !== expectedColumns.length) {
      errors.push({
        type: 'WRONG_COLUMN_COUNT',
        detail: `Header has ${headerFields.length} columns, expected ${expectedColumns.length}.`,
      });
    } else {
      expectedColumns.forEach((col, i) => {
        if (headerFields[i] !== col) {
          errors.push({
            type: 'WRONG_COLUMN_COUNT',
            column: col,
            detail: `Column ${i + 1}: expected "${col}", got "${headerFields[i]}".`,
          });
        }
      });
    }

    // Validate data rows
    const dataLines = lines.slice(1);
    const isLastChunk = fileIndex === files.length - 1;
    const expectedRowCount = isLastChunk
      ? totalRows - rowsAccountedFor
      : Math.min(safeRowsPerFile, totalRows - rowsAccountedFor);

    if (dataLines.length !== expectedRowCount) {
      errors.push({
        type: 'ROW_COUNT_MISMATCH',
        detail: `Expected ${expectedRowCount} data rows, found ${dataLines.length}.`,
      });
    }

    rowsAccountedFor += dataLines.length;

    dataLines.forEach((line, lineIdx) => {
      const rowIndex = lineIdx + 1; // 1-based
      const fields = parseCsvLine(line);

      // Required fields must not be empty
      for (const colIdx of requiredColIndices) {
        const value = fields[colIdx] ?? '';
        if (value === '') {
          errors.push({
            type: 'MISSING_REQUIRED_FIELD',
            rowIndex,
            column: expectedColumns[colIdx],
            detail: `Row ${rowIndex}: required field "${expectedColumns[colIdx]}" is empty.`,
          });
        }
      }

      // No scientific notation in any field
      fields.forEach((value, colIdx) => {
        if (SCI_NOTATION_RE.test(value)) {
          errors.push({
            type: 'SCIENTIFIC_NOTATION',
            rowIndex,
            column: expectedColumns[colIdx],
            detail: `Row ${rowIndex}, column "${expectedColumns[colIdx]}": value "${value}" is in scientific notation.`,
          });
        }
      });

      // Date column format
      if (dateColIndex !== -1) {
        const dateValue = fields[dateColIndex] ?? '';
        if (dateValue !== '' && !DATE_FORMAT_RE.test(dateValue)) {
          errors.push({
            type: 'INVALID_DATE_FORMAT',
            rowIndex,
            column: DATE_COLUMN,
            detail: `Row ${rowIndex}: date "${dateValue}" is not in YYYY-MM-DD format.`,
          });
        }
      }
    });

    results.push({
      fileIndex,
      filename: file.filename,
      passed: errors.length === 0,
      errors,
    });
  });

  return {
    results,
    allPassed: results.every((r) => r.passed),
  };
}

// ── ZIP & download ────────────────────────────────────────────────────────────

export async function packageAsZip(files: CsvFileEntry[]): Promise<Blob> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.filename, file.content);
  }
  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
