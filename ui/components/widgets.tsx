/**
 * widgets.tsx — Port React fidèle de `public/src/common/widgets.js` pour les
 * rendus partagés dont la vue Référentiel a besoin. Même sémantique, même
 * nommage de classes CSS (le style.css de paragone-front reste la source de
 * vérité visuelle -- on ne la duplique pas ici).
 */
import { useEffect, useState, type ReactNode } from "react";
import { splitHoles } from "../format";
import { highlightJs } from "../triage/highlight";

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
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

/** Section repliée à l'ouverture : le titre est le résumé, un clic déplie le contenu -- port de `foldedSection`. */
export function FoldedSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string | null;
  children: ReactNode;
}) {
  return (
    <details className="d-section fold">
      <summary>
        <h3>
          {title}
          {aside ? <span className="aside"> {aside}</span> : null}
        </h3>
      </summary>
      {children}
    </details>
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
  onRow,
}: {
  columns: { title: string; cell: (row: T) => ReactNode }[];
  rows: T[];
  onRow?: (row: T) => void;
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
          <tr key={i} className={onRow ? "pick" : undefined} onClick={onRow ? () => onRow(row) : undefined}>
            {columns.map((c) => (
              <td key={c.title}>{c.cell(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Badge({ value, text }: { value: string | null | undefined; text?: string }) {
  if (!value) return <span className="badge unjudged">—</span>;
  return <span className={`badge ${value}`}>{text ?? value}</span>;
}

export function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="tile">
      <b>{typeof value === "number" ? new Intl.NumberFormat("fr-FR").format(value) : value}</b>
      <span>{label}</span>
    </div>
  );
}

export type BarRow = { k: string; n: number };

/** Liste de barres horizontales proportionnelles au plus grand compte -- port de `widgets.js::barList`. */
export function BarList({ rows, onPick }: { rows: BarRow[]; onPick?: (key: string) => void }) {
  if (!rows.length) return <div className="muted">Aucune donnée.</div>;
  const top = Math.max(1, ...rows.map((row) => row.n));
  return (
    <div className="bars">
      {rows.map(({ k, n }) => (
        <div key={k} className={onPick ? "bar pick" : "bar"} onClick={onPick ? () => onPick(k) : undefined}>
          <span className="bar-key">{k}</span>
          <span className="bar-track">
            <span className="fill" style={{ width: `${(n / top) * 100}%` }} />
          </span>
          <span className="bar-n">{new Intl.NumberFormat("fr-FR").format(n)}</span>
        </div>
      ))}
    </div>
  );
}

export function Pager({
  offset,
  limit,
  total,
  shown,
  onMove,
}: {
  offset: number;
  limit: number;
  total: number;
  shown: number;
  onMove: (offset: number) => void;
}) {
  const first = total === 0 ? 0 : offset + 1;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  return (
    <div className="pager">
      <button type="button" disabled={offset === 0} onClick={() => onMove(Math.max(0, offset - limit))}>
        ←
      </button>
      <span>
        {fmt(first)}–{fmt(offset + shown)} sur {fmt(total)}
      </span>
      <button type="button" disabled={offset + limit >= total} onClick={() => onMove(offset + limit)}>
        →
      </button>
    </div>
  );
}

export function Select({
  placeholder,
  options,
  value,
  onChange,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Texte dont les trous (`EXPR`, `EXPR#n`) ressortent -- port de `widgets.js::holes`. */
export function Holes({ text, soft }: { text: string; soft?: boolean }) {
  return (
    <span>
      {splitHoles(text).map((part, i) =>
        part.hole ? (
          <span key={i} className={soft ? "hole soft" : "hole"}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </span>
  );
}

export function Message({ kind, text }: { kind: string; text: string }) {
  return <p className={`msg ${kind}`}>{text}</p>;
}

/**
 * Bloc de code -- port de `widgets.js::codeBlock`, coloré via Shiki
 * (`highlightJs`, bundlée, styles en ligne). Pour un texte court (le match
 * reconstruit) : pas de virtualisation nécessaire ici, voir
 * `triage/CodeView.tsx` pour le fichier entier.
 */
export function CodeBlock({ code }: { code: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    highlightJs(code)
      .then((h) => !cancelled && setHtml(h))
      .catch(() => !cancelled && setHtml(null));
    return () => {
      cancelled = true;
    };
  }, [code]);
  if (html)
    // Sûr : Shiki échappe tout le texte source en HTML avant d'émettre les
    // <span> de coloration -- aucune chaîne du code scanné ne peut casser
    // hors d'un nœud texte. Même garantie que `common/widgets.js::highlightedCode`
    // (highlight.js) dans la version vanilla.
    return <div className="carrier" dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <pre className="carrier">
      <code className="language-javascript">{code}</code>
    </pre>
  );
}
