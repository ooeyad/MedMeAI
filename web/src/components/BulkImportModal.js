import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../api/client";
export function BulkImportModal({ open, onClose, title, entityLabel, columns, endpoint, extraPayload, onSuccess, }) {
    const [fileName, setFileName] = useState("");
    const [rows, setRows] = useState([]);
    const [parseError, setParseError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [summary, setSummary] = useState(null);
    if (!open)
        return null;
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
        const example = {};
        columns.forEach((c) => {
            example[c.header] = c.required ? `Sample ${c.header.toLowerCase()}` : "";
        });
        const ws = XLSX.utils.json_to_sheet([example], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-import-template.xlsx`);
    }
    function normaliseHeader(h) {
        return (h || "").toString().trim().toLowerCase().replace(/[\s_-]+/g, " ");
    }
    function mapHeaderToKey(rawHeader) {
        const norm = normaliseHeader(rawHeader);
        for (const col of columns) {
            const headerNorm = normaliseHeader(col.header);
            if (norm === headerNorm)
                return col.key;
            if (norm === col.key.toLowerCase())
                return col.key;
            for (const alias of col.aliases || []) {
                if (norm === normaliseHeader(alias))
                    return col.key;
            }
        }
        return null;
    }
    async function onFileSelected(e) {
        setParseError(null);
        setSummary(null);
        const file = e.target.files?.[0];
        if (!file)
            return;
        setFileName(file.name);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            if (!sheet)
                throw new Error("Workbook contains no sheets");
            const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            if (!raw.length)
                throw new Error("File has no rows after the header");
            // Map headers to canonical keys
            const firstRow = raw[0];
            const headerMap = {};
            for (const h of Object.keys(firstRow)) {
                const key = mapHeaderToKey(h);
                if (key)
                    headerMap[h] = key;
            }
            const missingRequired = columns
                .filter((c) => c.required && !Object.values(headerMap).includes(c.key))
                .map((c) => c.header);
            if (missingRequired.length) {
                throw new Error(`Missing required column(s): ${missingRequired.join(", ")}. ` +
                    `Download the template to see expected headers.`);
            }
            const mapped = raw
                .map((row, idx) => {
                const out = { __row: idx + 2 }; // header is row 1
                for (const [rawHeader, canonical] of Object.entries(headerMap)) {
                    const col = columns.find((c) => c.key === canonical);
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
        }
        catch (err) {
            setParseError(err.message || "Couldn't read this file");
            setRows([]);
        }
    }
    async function submit() {
        if (!rows.length)
            return;
        setSubmitting(true);
        setSummary(null);
        try {
            // Strip the __row marker before sending
            const payload = {
                rows: rows.map(({ __row, ...rest }) => rest),
                ...(extraPayload || {}),
            };
            const res = await api.post(endpoint, payload);
            const sm = res.data;
            setSummary(sm);
            onSuccess(sm);
        }
        catch (err) {
            setParseError(err.response?.data?.error?.message || err.message || "Import failed");
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-3xl bg-white rounded-2xl shadow-lift flex flex-col max-h-[90vh]", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(FileSpreadsheet, { size: 16 }), " ", title] }), _jsx("button", { onClick: handleClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "px-5 py-4 overflow-y-auto space-y-4", children: [!summary && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "rounded-lg bg-brand-50 ring-1 ring-brand-200 p-3 text-sm", children: [_jsx("div", { className: "font-medium text-brand-900 mb-1", children: "Upload an Excel (.xlsx) or CSV file" }), _jsxs("div", { className: "text-brand-800", children: ["Headers must match (case insensitive):", " ", columns.map((c, i) => (_jsxs("span", { children: [_jsxs("span", { className: "font-mono text-xs bg-white/60 ring-1 ring-brand-200 rounded px-1 py-0.5", children: [c.header, c.required && _jsx("span", { className: "text-rose-600", children: "*" })] }), i < columns.length - 1 ? " · " : ""] }, c.key)))] }), _jsxs("button", { onClick: downloadTemplate, className: "mt-2 inline-flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-900 underline", children: [_jsx(Download, { size: 12 }), " Download a sample template"] })] }), _jsxs("label", { className: "block", children: [_jsxs("div", { className: "flex items-center gap-3 border-2 border-dashed border-ink-300 rounded-xl p-6 hover:border-brand-400 hover:bg-brand-50/30 transition cursor-pointer", children: [_jsx("div", { className: "size-10 rounded-lg bg-brand-100 text-brand-700 grid place-items-center", children: _jsx(Upload, { size: 18 }) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-ink-800", children: fileName || "Click to choose a file" }), _jsx("div", { className: "text-xs text-ink-500 mt-0.5", children: "Accepts .xlsx, .xls, .csv" })] })] }), _jsx("input", { type: "file", accept: ".xlsx,.xls,.csv", onChange: onFileSelected, className: "sr-only" })] }), parseError && (_jsxs("div", { className: "rounded-lg bg-rose-50 ring-1 ring-rose-200 text-rose-700 px-3 py-2 text-sm flex items-start gap-2", children: [_jsx(AlertCircle, { size: 14, className: "mt-0.5 shrink-0" }), _jsx("div", { children: parseError })] })), rows.length > 0 && (_jsxs("div", { children: [_jsxs("div", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2 flex items-center justify-between", children: [_jsxs("span", { children: ["Preview \u00B7 ", rows.length, " row(s) to import"] }), rows.length > 10 && (_jsx("span", { className: "text-ink-400 normal-case font-normal", children: "Showing first 10" }))] }), _jsx("div", { className: "overflow-x-auto rounded-lg ring-1 ring-ink-200", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "bg-ink-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-2 text-ink-500 font-semibold", children: "#" }), columns.map((c) => (_jsx("th", { className: "text-left px-3 py-2 text-ink-500 font-semibold whitespace-nowrap", children: c.header }, c.key)))] }) }), _jsx("tbody", { className: "divide-y divide-ink-100", children: rows.slice(0, 10).map((r, i) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-1.5 text-ink-400 font-mono", children: r.__row }), columns.map((c) => (_jsx("td", { className: "px-3 py-1.5 text-ink-700 whitespace-nowrap", children: String(r[c.key] ?? "—") }, c.key)))] }, i))) })] }) })] }))] })), summary && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-emerald-700 font-semibold mb-1", children: [_jsx(CheckCircle2, { size: 16 }), " Import complete"] }), _jsxs("div", { className: "text-sm text-emerald-800", children: [_jsx("span", { className: "font-semibold", children: summary.created }), " created \u00B7", " ", _jsx("span", { className: "font-semibold", children: summary.updated }), " updated \u00B7", " ", _jsx("span", { className: "font-semibold", children: summary.skipped }), " skipped"] })] }), summary.errors?.length > 0 && (_jsxs("div", { className: "rounded-lg bg-rose-50 ring-1 ring-rose-200 p-3", children: [_jsxs("div", { className: "font-semibold text-rose-800 text-sm mb-2", children: [summary.errors.length, " row(s) had errors"] }), _jsx("ul", { className: "text-xs text-rose-700 space-y-1 max-h-48 overflow-y-auto", children: summary.errors.map((e, i) => (_jsxs("li", { className: "font-mono", children: ["Row ", e.row, ": ", e.message] }, i))) })] }))] }))] }), _jsx("div", { className: "px-5 py-3 border-t border-ink-100 flex items-center justify-end gap-2", children: summary ? (_jsx("button", { onClick: handleClose, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 shadow-soft", children: "Done" })) : (_jsxs(_Fragment, { children: [_jsx("button", { onClick: handleClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsxs("button", { onClick: submit, disabled: !rows.length || submitting, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50 shadow-soft", children: [_jsx(Upload, { size: 14 }), submitting
                                        ? "Importing…"
                                        : rows.length
                                            ? `Import ${rows.length} ${entityLabel}${rows.length === 1 ? "" : "s"}`
                                            : `Import ${entityLabel}s`] })] })) })] }) }));
}
