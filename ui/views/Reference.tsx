/**
 * Reference.tsx — Port React fidèle de `public/src/reference/view.js` +
 * `reference/constants.js` : projet servi (`/meta`), valeurs énumérées et
 * légendes (`/vocabulary`), analyzers jugés (`/analyzers`). Lecture pure,
 * ne dépend que de `api` (un `ParagoneApi`, agnostique de l'hôte).
 */
import { useEffect, useState } from "react";
import type { ParagoneApi } from "../api/client";
import { Chips, ClsTag, DataTable, ErrorMessage, KvGrid, Section } from "../components/widgets";

const ENUMS: [string, string][] = [
  ["classes d'impact", "impactClasses"],
  ["classes d'inventaire", "inventoryClasses"],
  ["natures de lead", "leadKinds"],
  ["statuts de fichier", "fileStatuses"],
  ["scores du juge", "judgeScores"],
  ["motifs de rejet", "rejectReasons"],
  ["verdicts humains", "humanScores"],
  ["masques de la file", "queueMasks"],
  ["verdicts du taint", "taintVerdicts"],
  ["fins de descente du taint", "taintEndKinds"],
];

type Meta = { root: string; dbPath: string; apiVersion: string };
type Vocabulary = {
  defaultLanguage: string;
  legends: Record<string, Record<string, Record<string, string>>>;
  [key: string]: unknown;
};
type AnalyzerReference = { url: string; label: string };
type Analyzer = {
  name: string;
  classes: string[];
  guidance: Record<string, Record<string, string>>;
  references: AnalyzerReference[];
};

export function ReferenceView({ api }: { api: ParagoneApi }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [analyzers, setAnalyzers] = useState<Analyzer[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getMeta(), api.getVocabulary(), api.listAnalyzers()])
      .then(([m, v, a]) => {
        if (cancelled) return;
        setMeta(m as Meta);
        setVocabulary(v as Vocabulary);
        setAnalyzers(a as Analyzer[]);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (error) return <ErrorMessage error={error} />;
  if (!meta || !vocabulary || !analyzers) return <div>chargement…</div>;

  const lang = vocabulary.defaultLanguage;
  const legend = vocabulary.legends[lang] ?? {};

  return (
    <div className="page">
      <h2>Référentiel</h2>

      <Section title="Projet servi" aside={null}>
        <div className="card">
          <KvGrid
            pairs={[
              ["dossier", <code key="root">{meta.root}</code>],
              ["base", <code key="db">{meta.dbPath}</code>],
              ["version du contrat", meta.apiVersion],
            ]}
          />
        </div>
      </Section>

      <Section title="Vocabulaire" aside={`langue par défaut : ${lang}`}>
        <div className="card">
          <KvGrid
            pairs={ENUMS.map(([label, key]) => [
              label,
              <Chips key={key} values={(vocabulary[key] as string[]) ?? []} />,
            ])}
          />
        </div>
        <div className="grid-2">
          {Object.entries(legend).map(([name, entries]) => (
            <div className="card" key={name}>
              <h4>légende « {name} »</h4>
              <KvGrid pairs={Object.entries(entries).map(([k, text]) => [k, String(text)])} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Analyzers jugés" aside={`${analyzers.length} analyzers`}>
        <DataTable<Analyzer>
          columns={[
            { title: "analyzer", cell: (a: Analyzer) => <code>{a.name}</code> },
            {
              title: "classes",
              cell: (a: Analyzer) => (
                <span>
                  {a.classes.map((cls) => (
                    <ClsTag key={cls} cls={cls} />
                  ))}
                </span>
              ),
            },
            {
              title: "consigne",
              cell: (a: Analyzer) => (
                <div className="guidance-list">
                  {Object.entries(a.guidance[lang] ?? {}).map(([cls, text]) => (
                    <p key={cls}>
                      <ClsTag cls={cls} /> {text}
                    </p>
                  ))}
                </div>
              ),
            },
            {
              title: "références",
              cell: (a: Analyzer) => (
                <ul className="refs">
                  {a.references.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noreferrer noopener">
                        {r.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
          rows={analyzers}
        />
      </Section>
    </div>
  );
}
