import { ChangeEvent, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";

import { api } from "../api/client";

export interface ColumnSpec {
  /** Canonical field name expected by the backend */
  key: string;
  /** Header label shown in the help text + sample file */
  header: string;
  /** Alternative header names accepted from the user's file (case-insensitive) */
  aliases?: string[];
  /** Hint for the help text */
  hint?: string;
  /** True if the column must contain a value on every row */
  required?: boolean;
  /** Convert raw cell to canonical value (e.g. "yes"/"no" -> true/false) */
  transform?: (raw: any) => any;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** What single-row entity we're importing (e.g. "medication") for messaging */
  entityLabel: string;
  /** Column mapping spec */
  columns: ColumnSpec[];
  /** Backend endpoint to POST rows to. Will receive { rows: [...] } */
  endpoint: string;
  /** Optional extra payload sent alongside rows (e.g. { kind: "medication" }) */
  extraPayload?: Record<string, any>;
  /** Called when import succeeds so the parent can refetch */
  onSuccess: (summary: BulkImportSummary) => void;
}

export interface BulkImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export function BulkImportModal({
  open, onClose, title, entityLabel, columns, endpoint, extraPayload, onSuccess,
}: Props) {
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<BulkImportSummary | null>(null);

  if (!open) return null;

  function reset() {
    setFileName("");
    setRows([]);
    setParseError(null);
    setSummary(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function downloadTemplate() {
    // Build a sample workbook with the canonical headers + one example row
    const headers = columns.map((c) => c.header);
    const example: Record<string, any> = {};
    columns.forEach((c) => {
      example[c.header] = c.required ? `Sample ${c.header.toLowerCase()}` : "";
    });
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-import-template.xlsx`);
  }

  function normaliseHeader(h: string): string {
    return (h || "").toString().trim().toLowerCase().replace(/[\s_-]+/g, " ");
  }

  function mapHeaderToKey(rawHeader: string): string | null {
    const norm = normaliseHeader(rawHeader);
    for (const col of columns) {
      const headerNorm = normaliseHeader(col.header);
      if (norm === headerNorm) return col.key;
      if (norm === col.key.toLowerCase()) return col.key;
      for (const alias of col.aliases || []) {
        if (norm === normaliseHeader(alias)) return col.key;
      }
    }
    return null;
  }

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setSummary(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("Workbook contains no sheets");
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (!raw.length) throw new Error("File has no rows after the header");

      // Map headers to canonical keys
      const firstRow = raw[0];
      const headerMap: Record<string, string> = {};
      for (const h of Object.keys(firstRow)) {
        const key = mapHeaderToKey(h);
        if (key) headerMap[h] = key;
      }

      const missingRequired = columns
        .filter((c) => c.required && !Object.values(headerMap).includes(c.key))
        .map((c) => c.header);
      if (missingRequired.length) {
        throw new Error(
          `Missing required column(s): ${missingRequired.join(", ")}. ` +
            `Download the template to see expected headers.`,
        );
      }

      const mapped = raw
        .map((row, idx) => {
          const out: Record<string, any> = { __row: idx + 2 }; // header is row 1
          for (const [rawHeader, canonical] of Object.entries(headerMap)) {
            const col = columns.find((c) => c.key === canonical)!;
            const raw_val = row[rawHeader];
            out[canonical] = col.transform ? col.transform(raw_val) : raw_val;
          }
          return out;
        })
        .filter((row) => {
          // Skip totally blank rows
          return columns.some((c) => {
            const v = row[c.key];
            return v !== "" && v !== null && v !== undefined;
          });
        });

      setRows(mapped);
    } catch (err: any) {
      setParseError(err.message || "Couldn't read this file");
      setRows([]);
    }
  }

  async function submit() {
    if (!rows.length) return;
    setSubmitting(true);
    setSummary(null);
    try {
      // Strip the __row marker before sending
      const payload = {
        rows: rows.map(({ __row, ...rest }) => rest),
        ...(extraPayload || {}),
      };
      const res = await api.post(endpoint, payload);
      const sm: BulkImportSummary = res.data;
      setSummary(sm);
      onSuccess(sm);
    } catch (err: any) {
      setParseError(err.response?.data?.error?.message || err.message || "Import failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lift flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2 text-ink-800 font-semibold">
            <FileSpreadsheet size={16} /> {title}
          </div>
          <button onClick={handleClose} className="text-ink-400 hover:text-ink-700">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {!summary && (
            <>
              {/* Help text + template */}
              <div className="rounded-lg bg-brand-50 ring-1 ring-brand-200 p-3 text-sm">
                <div className="font-medium text-brand-900 mb-1">
                  Upload an Excel (.xlsx) or CSV file
                </div>
                <div className="text-brand-800">
                  Headers must match (case insensitive):{" "}
                  {columns.map((c, i) => (
                    <span key={c.key}>
                      <span className="font-mono text-xs bg-white/60 ring-1 ring-brand-200 rounded px-1 py-0.5">
                        {c.header}
                        {c.required && <span className="text-rose-600">*</span>}
                      </span>
                      {i < columns.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>
                <button
                  onClick={downloadTemplate}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-900 underline"
                >
                  <Download size={12} /> Download a sample template
                </button>
              </div>

              {/* File picker */}
              <label className="block">
                <div className="flex items-center gap-3 border-2 border-dashed border-ink-300 rounded-xl p-6 hover:border-brand-400 hover:bg-brand-50/30 transition cursor-pointer">
                  <div className="size-10 rounded-lg bg-brand-100 text-brand-700 grid place-items-center">
                    <Upload size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink-800">
                      {fileName || "Click to choose a file"}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      Accepts .xlsx, .xls, .csv
                    </div>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={onFileSelected}
                  className="sr-only"
                />
              </label>

              {parseError && (
                <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 text-rose-700 px-3 py-2 text-sm flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>{parseError}</div>
                </div>
              )}

              {rows.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2 flex items-center justify-between">
                    <span>Preview · {rows.length} row(s) to import</span>
                    {rows.length > 10 && (
                      <span className="text-ink-400 normal-case font-normal">Showing first 10</span>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-lg ring-1 ring-ink-200">
                    <table className="w-full text-xs">
                      <thead className="bg-ink-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-ink-500 font-semibold">#</th>
                          {columns.map((c) => (
                            <th
                              key={c.key}
                              className="text-left px-3 py-2 text-ink-500 font-semibold whitespace-nowrap"
                            >
                              {c.header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {rows.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-ink-400 font-mono">{r.__row}</td>
                            {columns.map((c) => (
                              <td key={c.key} className="px-3 py-1.5 text-ink-700 whitespace-nowrap">
                                {String(r[c.key] ?? "—")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {summary && (
            <div className="space-y-3">
              <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-4">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-1">
                  <CheckCircle2 size={16} /> Import complete
                </div>
                <div className="text-sm text-emerald-800">
                  <span className="font-semibold">{summary.created}</span> created ·{" "}
                  <span className="font-semibold">{summary.updated}</span> updated ·{" "}
                  <span className="font-semibold">{summary.skipped}</span> skipped
                </div>
              </div>
              {summary.errors?.length > 0 && (
                <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 p-3">
                  <div className="font-semibold text-rose-800 text-sm mb-2">
                    {summary.errors.length} row(s) had errors
                  </div>
                  <ul className="text-xs text-rose-700 space-y-1 max-h-48 overflow-y-auto">
                    {summary.errors.map((e, i) => (
                      <li key={i} className="font-mono">
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-end gap-2">
          {summary ? (
            <button
              onClick={handleClose}
              className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 shadow-soft"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="px-3 py-2 text-sm text-ink-600 hover:text-ink-800"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!rows.length || submitting}
                className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50 shadow-soft"
              >
                <Upload size={14} />
                {submitting
                  ? "Importing…"
                  : rows.length
                    ? `Import ${rows.length} ${entityLabel}${rows.length === 1 ? "" : "s"}`
                    : `Import ${entityLabel}s`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
