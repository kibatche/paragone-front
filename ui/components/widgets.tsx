/**
 * widgets.tsx — Port React fidèle de `public/src/common/widgets.js` pour les
 * rendus partagés dont la vue Référentiel a besoin. Même sémantique, même
 * nommage de classes CSS (le style.css de paragone-front reste la source de
 * vérité visuelle -- on ne la duplique pas ici).
 */
import type { ReactNode } from "react";

export function Section({ title, aside, children }: { title: string; aside?: string | null; children: ReactNode }) {
  return (
    <section className="d-section">
      <h3>
        {title}
        {aside ? <span className="aside"> {aside}</span> : null}
      </h3>
      {children}
    </section>
  );
}

export function KvGrid({ pairs }: { pairs: [string, ReactNode][] }) {
  const visible = pairs.filter(([, value]) => value !== null && value !== undefined && value !== "");
  return (
    <div className="kv">
      {visible.map(([key, value]) => (
        <>
          <div className="k" key={`${key}-k`}>
            {key}
          </div>
          <div className="v" key={`${key}-v`}>
            {value}
          </div>
        </>
      ))}
    </div>
  );
}

export function ClsTag({ cls }: { cls: string }) {
  return <span className={`cls ${cls}`}>{cls}</span>;
}

export function Chips({ values }: { values: string[] }) {
  return (
    <span className="chips-flat">
      {values.map((v) => (
        <code key={v}>{v}</code>
      ))}
    </span>
  );
}

export function ErrorMessage({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return <p className="msg bad">✗ {message}</p>;
}

export function DataTable<T>({
  columns,
  rows,
}: {
  columns: { title: string; cell: (row: T) => ReactNode }[];
  rows: T[];
}) {
  return (
    <table className="data">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.title}>{c.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.title}>{c.cell(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
