// Quotes every cell and escapes embedded quotes by doubling them (the
// standard CSV rule) - a plain join(",") would silently corrupt any value
// containing a comma (common in item names, e.g. "Chole Bhature, Large").
const toCsvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const downloadCsv = (filename, headers, rows) => {

    const lines = [
        headers.map(toCsvCell).join(","),
        ...rows.map((row) => row.map(toCsvCell).join(","))
    ];

    // A leading BOM tells Excel this is UTF-8, not the system codepage -
    // without it, ₹ and other non-ASCII characters render as garbled text
    // when the file is opened directly instead of imported.
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);

};
