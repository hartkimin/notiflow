import * as XLSX from "xlsx";

export function downloadExcel(data: Record<string, unknown>[], filename: string, headers?: Record<string, string>) {
  // If headers provided, rename columns
  const rows = headers
    ? data.map((row) => {
        const mapped: Record<string, unknown> = {};
        for (const [key, label] of Object.entries(headers)) {
          mapped[label] = row[key];
        }
        return mapped;
      })
    : data;

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
