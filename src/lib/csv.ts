/** CSV compatível com Excel em português: separador ";", BOM UTF-8, decimal com vírgula. */
export type CsvColumn<T> = { header: string; value: (row: T) => unknown };

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (typeof v === 'number') s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
  else if (typeof v === 'boolean') s = v ? 'Sim' : 'Não';
  else if (Array.isArray(v)) s = v.join(', ');
  else s = String(v);
  // Evita injeção de fórmulas ao abrir no Excel.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(';')];
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r))).join(';'));
  return '﻿' + lines.join('\r\n');
}

export const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
