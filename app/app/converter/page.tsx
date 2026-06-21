'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  convertXlsxToCsv,
  validateCsvFiles,
  packageAsZip,
  downloadBlob,
  type ConversionResult,
  type ValidationSummary,
  type ValidationResult,
} from '@/lib/xlsx-converter';

type Status = 'idle' | 'processing' | 'done' | 'error';

export default function ConverterPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rowsPerFile, setRowsPerFile] = useState<number>(10_000);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setStatus('idle');
    setResult(null);
    setValidationSummary(null);
    setErrorMessage(null);
  }

  async function handleConvert() {
    if (!file) return;
    setStatus('processing');
    setResult(null);
    setValidationSummary(null);
    setErrorMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const convResult = convertXlsxToCsv(arrayBuffer, { rowsPerFile });
      const summary = validateCsvFiles(
        convResult.csvFiles,
        convResult.presentAllowedColumns,
        rowsPerFile,
        convResult.totalRows,
      );
      setResult(convResult);
      setValidationSummary(summary);
      setStatus('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  async function handleDownloadZip() {
    if (!result) return;
    const blob = await packageAsZip(result.csvFiles);
    downloadBlob(blob, 'converted.zip');
  }

  function handleDownloadSingle(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv' });
    downloadBlob(blob, filename);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            ← Home
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            XLSX → CSV Converter
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Validates column structure, formats dates and numbers, and splits output into
            configurable-size CSV files.
          </p>
        </div>

        {/* Upload section */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
            1. Select file
          </h2>

          <div
            className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div>
                <p className="text-zinc-900 dark:text-zinc-50 font-medium">{file.name}</p>
                <p className="text-sm text-zinc-500 mt-1">
                  {(file.size / 1024).toFixed(1)} KB — click to change
                </p>
              </div>
            ) : (
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Click to select an <span className="font-medium">.xlsx</span> file
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Settings */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
            2. Settings
          </h2>
          <label className="flex items-center justify-between gap-4">
            <span className="text-zinc-700 dark:text-zinc-300 text-sm">Rows per CSV file</span>
            <input
              type="number"
              min={1}
              value={rowsPerFile}
              onChange={(e) => setRowsPerFile(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-32 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 text-right focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>
        </section>

        {/* Convert button */}
        <button
          onClick={handleConvert}
          disabled={!file || status === 'processing'}
          className="w-full h-12 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium text-sm transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed mb-6"
        >
          {status === 'processing' ? 'Processing…' : 'Convert'}
        </button>

        {/* Error banner */}
        {status === 'error' && errorMessage && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Error</p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">{errorMessage}</p>
          </div>
        )}

        {/* Results */}
        {status === 'done' && result && validationSummary && (
          <>
            {/* Conversion summary */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
                Conversion summary
              </h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Total rows</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50 mt-0.5">
                    {result.totalRows.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">CSV files</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50 mt-0.5">
                    {result.csvFiles.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Columns written</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50 mt-0.5">
                    {result.presentAllowedColumns.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Skipped columns</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50 mt-0.5">
                    {result.skippedColumns.length === 0
                      ? 'none'
                      : result.skippedColumns.join(', ')}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Validation summary */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Validation
                </h2>
                {validationSummary.allPassed ? (
                  <span className="text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-3 py-1 rounded-full">
                    All passed
                  </span>
                ) : (
                  <span className="text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-3 py-1 rounded-full">
                    {validationSummary.results.filter((r) => !r.passed).length} file(s) failed
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {validationSummary.results.map((vr) => (
                  <ValidationResultRow key={vr.fileIndex} result={vr} />
                ))}
              </div>
            </section>

            {/* Downloads */}
            {result.csvFiles.length > 0 && (
              <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
                  Download
                </h2>

                <button
                  onClick={handleDownloadZip}
                  className="w-full h-11 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium text-sm transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200 mb-4"
                >
                  Download all as ZIP ({result.csvFiles.length} files)
                </button>

                {result.csvFiles.length <= 10 && (
                  <div className="space-y-2">
                    {result.csvFiles.map((f) => (
                      <button
                        key={f.filename}
                        onClick={() => handleDownloadSingle(f.content, f.filename)}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm"
                      >
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {f.filename}
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {f.rowCount.toLocaleString()} rows
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {result.csvFiles.length === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  The file contains no data rows (header-only). Nothing to convert.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ValidationResultRow({ result }: { result: ValidationResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{result.filename}</span>
        <div className="flex items-center gap-3">
          {result.errors.length > 0 && (
            <span className="text-zinc-400 dark:text-zinc-500 text-xs">
              {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
            </span>
          )}
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
              result.passed
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
            }`}
          >
            {result.passed ? 'Pass' : 'Fail'}
          </span>
          <span className="text-zinc-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && result.errors.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-1.5 bg-zinc-50 dark:bg-zinc-950">
          {result.errors.map((err, i) => (
            <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">
              [{err.type}] {err.detail}
            </p>
          ))}
        </div>
      )}

      {expanded && result.errors.length === 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 bg-zinc-50 dark:bg-zinc-950">
          <p className="text-xs text-green-600 dark:text-green-400">No errors found.</p>
        </div>
      )}
    </div>
  );
}
