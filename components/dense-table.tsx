import type { ReactNode } from "react"

export interface DenseColumn<T> {
  key: keyof T
  header: string
  render?: (value: T[keyof T], row: T) => ReactNode
}

interface DenseTableProps<T> {
  columns: DenseColumn<T>[]
  rows: T[]
  emptyMessage?: string
}

export function DenseTable<T>({ columns, rows, emptyMessage = "No data." }: DenseTableProps<T>) {
  return (
    <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--np-border)]">
            {columns.map(col => (
              <th
                key={String(col.key)}
                className="px-4 py-2.5 text-left text-[var(--np-text-muted)] text-[11px] font-medium uppercase tracking-wide"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-[var(--np-text-muted)] text-[13px]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[var(--np-border)] last:border-0 hover:bg-[var(--np-surface-deep)] transition-colors"
                style={{ height: "40px" }}
              >
                {columns.map(col => (
                  <td key={String(col.key)} className="px-4 py-0 font-mono text-[var(--np-text-body)]">
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
