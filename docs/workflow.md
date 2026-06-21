# XLSX to CSV Converter - Acceptance Criteria

## Overview
The XLSX to CSV Converter is a Next.js web application that transforms Excel spreadsheets into validated CSV files with configurable chunking and data formatting.

## Feature: File Upload

### AC 1.1 - File Selection
- User can click on the dashed-border drop zone to select an XLSX file
- Only `.xlsx` files are accepted (input accept attribute set to `.xlsx`)
- Selected file name and size (in KB) are displayed after selection
- User can click the drop zone again to change the selected file
- File selection clears any previous conversion results and validation errors

### AC 1.2 - File Input Validation
- If workbook contains no worksheets, error message: "Workbook contains no worksheets."
- If first worksheet is empty (no `!ref`), error message: "First worksheet is empty."
- If header row is empty or all blanks, error message: "Header row is empty or missing."
- If no recognised columns found in file, error message: "No recognised columns found in the file."
- If required columns are missing, error message lists which columns are required (e.g., "Missing required columns: dms_document_id, userMetadata.CmdId, ...")

---

## Feature: Settings Configuration

### AC 2.1 - Rows Per File Configuration
- Default value is 10,000 rows per CSV file
- User can modify the value using a number input
- Minimum value enforced: 1 row per file
- Value cannot be empty or negative (minimum 1 enforced on input change)
- Configuration persists only during current conversion session

---

## Feature: Column Handling

### AC 3.1 - Allowed Columns
The application recognizes exactly these columns:
- `dms_document_id`
- `userMetadata.CmdId`
- `userMetadata.DocumentTypeId`
- `userMetadata.ProductTypeId`
- `userMetadata.DocumentNumber`
- `userMetadata.AgreementDate`
- `userMetadata.ProductNumber`
- `userMetadata.ParentProductNumber`
- `userMetadata.AccountNumber`
- `userMetadata.BoxId`
- `userMetadata.DepartmentId`
- `userMetadata.QrCode`
- `systemMetadata.state`

### AC 3.2 - Required Columns
All of the following columns must be present in the XLSX file:
- `dms_document_id`
- `userMetadata.CmdId`
- `userMetadata.DocumentTypeId`
- `userMetadata.ProductTypeId`
- `systemMetadata.state`

### AC 3.3 - Column Filtering
- Columns in the XLSX file that match the allowed list are included in output
- Columns that don't match the allowed list are skipped (not included in CSV output)
- Header row is trimmed of leading/trailing whitespace before matching
- Skipped columns are reported in the "Conversion summary" section
- If no allowed columns are found, conversion fails with error message

---

## Feature: Data Formatting

### AC 4.1 - Number Formatting
- Integer values are formatted without scientific notation (using `toFixed(0)`)
- Works reliably for values up to Number.MAX_SAFE_INTEGER (16 digits)
- Non-integer values are formatted using `toPrecision(15)` to avoid scientific notation
- Non-finite values (infinity, NaN) are output as empty string with console warning
- Result never contains scientific notation (e.g., "1e+5" not allowed)

### AC 4.2 - Date Formatting
- Dates in the `userMetadata.AgreementDate` column are formatted as YYYY-MM-DD
- Excel date cells marked with type='d' are parsed as Date objects and formatted
- Plain-text DD.MM.YYYY format in AgreementDate column is converted to YYYY-MM-DD
- Already-formatted YYYY-MM-DD values pass through unchanged
- Empty/null date cells remain empty
- Formatting uses UTC getters to prevent local-timezone shifting

### AC 4.3 - CSV Field Escaping
- Fields containing commas are wrapped in double quotes
- Fields containing double quotes are wrapped in double quotes and internal quotes are escaped (`"` → `""`)
- Fields containing newlines or carriage returns are wrapped in double quotes
- Fields without special characters remain unquoted

### AC 4.4 - Missing Values
- Empty/null cells in XLSX are output as empty fields in CSV
- Empty fields preserve column alignment in CSV

---

## Feature: CSV File Generation

### AC 5.1 - File Splitting
- Output CSV files are created based on `rowsPerFile` configuration
- If total data rows ≤ `rowsPerFile`, output is a single CSV file: `output_001.csv`
- If splitting is needed, files are numbered: `output_001.csv`, `output_002.csv`, etc.
- Chunk numbering is zero-padded to match total chunk count (e.g., 10 files = 2-digit padding: `001` to `010`)
- Each file contains the full header row plus its allocated data rows

### AC 5.2 - File Content Format
- First line of each CSV file contains column headers separated by commas
- Each subsequent line represents one data row
- File ends with a newline character (`\n`)
- Column order in CSV matches the allowed columns list order
- All rows have the same number of columns

### AC 5.3 - Edge Cases
- Header-only XLSX file (no data rows) produces zero output files
- User receives message: "The file contains no data rows (header-only). Nothing to convert."
- File with exactly `rowsPerFile` rows produces exactly one output file with all rows

---

## Feature: Conversion Process

### AC 6.1 - Conversion Execution
- Clicking "Convert" button initiates conversion
- Button is disabled when no file is selected
- Button is disabled and shows "Processing…" while conversion is running
- XLSX file is read with options: `cellDates: true`, `cellNF: true`
- Conversion extracts rows, validates required columns, and chunks into CSV files
- After completion, conversion summary and validation results are displayed

### AC 6.2 - Conversion Summary Display
Shows:
- Total rows: Total number of data rows processed (with thousand separators)
- CSV files: Count of generated CSV files
- Columns written: Number of allowed columns present in output
- Skipped columns: List of column names from XLSX not in allowed list (or "none")

### AC 6.3 - Error Handling
- If conversion fails, error banner appears with message
- Banner displays the error message from the conversion process
- Previous results are cleared on error
- Button returns to normal state, allowing retry with different file/settings

---

## Feature: CSV Validation

### AC 7.1 - Validation Execution
- After conversion, all generated CSV files are automatically validated
- Validation checks: header correctness, column count, data types, required fields, row counts
- Validation summary badge shows: "All passed" (green) or "X file(s) failed" (red)

### AC 7.2 - Validation Error Types
Application checks for and reports:
- **MISSING_HEADER**: File is empty or has no header row
- **WRONG_COLUMN_COUNT**: Header has incorrect number of columns or column names don't match
- **MISSING_REQUIRED_FIELD**: Required column (dms_document_id, userMetadata.CmdId, etc.) is empty
- **SCIENTIFIC_NOTATION**: Field value is in scientific notation format (e.g., "1e+5")
- **INVALID_DATE_FORMAT**: Date in AgreementDate column is not in YYYY-MM-DD format
- **ROW_COUNT_MISMATCH**: CSV file has different number of rows than expected

### AC 7.3 - Validation Results Display
- Each generated CSV file is listed with a validation row
- Filename, error count, and pass/fail badge are shown
- User can expand each file to see detailed error list
- Error detail format: `[ERROR_TYPE] Description`
- Pass/fail badges use color coding: green for pass, red for fail
- "No errors found" message displays when file passes validation

---

## Feature: Download

### AC 8.1 - Multiple Download Options
- "Download all as ZIP" button downloads all CSV files in a single ZIP archive
- ZIP filename: `converted.zip`
- If 10 or fewer files: individual file download buttons appear below ZIP button
- Individual download buttons show filename and row count
- If more than 10 files: only ZIP button is available (no individual buttons)

### AC 8.2 - File Download Mechanism
- Click downloads file directly to user's default downloads folder
- ZIP files are created using JSZip library
- CSV files maintain their full content and proper filename

### AC 8.3 - Download Availability
- Download section only appears after successful conversion with at least one CSV file
- Download buttons are disabled if no conversion result exists
- Download section is not shown for header-only files (zero output files)

---

## Feature: User Interface

### AC 9.1 - Layout Structure
- Application uses responsive design with max-width of 3xl (48rem)
- Sections include: Header, File Upload, Settings, Convert Button, Conversion Summary, Validation, Download
- All sections have consistent styling (white background, rounded borders, dark mode support)

### AC 9.2 - Dark Mode Support
- All UI elements have dark mode variants using Tailwind's `dark:` prefix
- Color scheme shifts appropriately: light backgrounds become dark, text colors invert

### AC 9.3 - Navigation
- Home button (← Home) in header returns user to application home page
- Home page has link to "XLSX → CSV Converter" (route: `/converter`)

### AC 9.4 - Status Indicators
- Status state tracks: idle (waiting for action), processing, done (success), error
- UI updates based on current status
- Processing state prevents user actions
- Error state displays error message and allows retry

---

## Feature: Data Integrity

### AC 10.1 - Column Order Preservation
- CSV output columns follow the order defined in ALLOWED_COLUMNS constant
- Column order is consistent across all generated files
- Header row always appears in same order as data rows

### AC 10.2 - Data Consistency Across Files
- When split across multiple files, data integrity is preserved
- Each row maintains all its field values
- No data loss or duplication occurs during splitting
- Row count across all files matches original data row count

### AC 10.3 - Whitespace Handling
- Header names are trimmed of leading/trailing whitespace before matching
- Cell values maintain their content (trimming only applied to headers)
- Empty cells remain empty (not converted to spaces or zeros)

---

## Technical Constraints

### AC 11.1 - File Format Support
- Input format: XLSX only (Microsoft Excel Open XML format)
- Output format: CSV (Comma-Separated Values)
- ZIP archive creation for batch downloads

### AC 11.2 - Browser Capabilities
- File upload uses HTML5 File API
- Download uses Blob API with URL.createObjectURL
- Requires JavaScript enabled (React client component)

### AC 11.3 - Performance
- Supports XLSX files with thousands to millions of rows
- File splitting prevents memory overload for large files
- Validation runs after conversion completes


#  Що робив в кожному режимі
- Описав вимоги і запустив plan mode
- Після огляду плану запустив імплементацію через модель Claude Sonnet, змін в план не додавав.
- Перевірив роботу застосунку
- За допомогою claude-haiku-4 описав AC