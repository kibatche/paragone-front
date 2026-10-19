/**
 * views/Triage.tsx — Port React fidèle de `public/src/triage/view.js` +
 * `queue.js` : squelette (compteurs, filtres, masques, file, dossier),
 * raccourcis clavier (j/k/a/r/e/n/u/← →//). Les raccourcis sont portés par la
 * racine `.t-root` (focusable, tabIndex=-1), JAMAIS par `document` : dans le
 * desktop Hermes la page du plugin reste montée pendant qu'un autre volet est
 * actif (deux volets côte à côte), un écouteur global y volait les frappes et
 * le focus. Il faut donc un focus explicite dans la vue pour les armer.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ParagoneApi } from "../api/client";
import { priorityOf, sinkText, where } from "../format";
import { Badge, ClsTag, ErrorMessage, Select } from "../components/widgets";
import { IMPACT_MODE, type Mode } from "../triage/constants";
import { keyAction } from "../triage/keys";
import { useTriage, filtersFromParams, type QueueRow } from "../triage/useTriage";
import { Dossier } from "../triage/Dossier";
import type { CodeViewHandle } from "../triage/CodeView";
import type { Summary, Vocabulary } from "../triage/types";

const toOptions = (rows: { k: string; n: number }[]) => rows.map(({ k, n }) => ({ value: k, label: `${k} (${n})` }));

function QueueItem({
  row,
  mode,
  selected,
  onOpen,
}: {
  row: QueueRow;
  mode: Mode;
  selected: boolean;
  onOpen: () => void;
}) {
  const best = row.judgements?.[0] ?? null;
  return (
    <div
      className={`q-item p${priorityOf(row)}${row.human_score ? " done" : ""}${selected ? " selected" : ""}`}
      data-id={row.id}
      onClick={onOpen}
    >
      <div className="q-top">
        {mode.isJudged ? <Badge value={best?.score ?? null} /> : null}
        {row.classes.map((c) => (
          <ClsTag key={c} cls={c} />
        ))}
        <span>{row.analyzer_name}</span>
        {row.method ? <span className="mono">{row.method}</span> : null}
        <span className="id">#{row.id}</span>
      </div>
      <div className="q-sink">{sinkText(row)}</div>
      <div className="q-bottom">
        {mode.isJudged ? <Badge value={row.verdict} /> : null}
        <span className="where">{where(row.file, row.line)}</span>
        {row.human_score ? (
          <Badge value={row.human_score} text={mode.labels[row.human_score] ?? row.human_score} />
        ) : null}
      </div>
    </div>
  );
}

function KeysHelp({ mode }: { mode: Mode }) {
  return (
    <div className="keys">
      {mode.keysHelp.map(([first, second, text], i) => (
        <div key={i}>
          <kbd>{first}</kbd>
          {second ? <kbd>{second}</kbd> : null} {text}
          <br />
        </div>
      ))}
    </div>
  );
}

export function TriageView({
  api,
  vocabulary,
  mode = IMPACT_MODE,
  initialFilters,
  onFiltersChange,
  autoFocus = false,
}: {
  api: ParagoneApi;
  vocabulary: Vocabulary | null;
  mode?: Mode;
  /** Filtres de départ (lus une seule fois, au montage -- un deep link ou un renvoi depuis Statistiques). */
  initialFilters?: Record<string, string>;
  /** Appelé à chaque changement des filtres vivants -- l'appelant décide quoi en faire (persister dans l'URL en standalone, ignorer dans Hermes). */
  onFiltersChange?: (filters: Record<string, string>) => void;
  /**
   * Prendre le focus clavier dès le montage. Vrai seulement là où la vue
   * possède toute la fenêtre (build autonome) ; FAUX dans le plugin Hermes,
   * où le volet paragone peut être affiché côte à côte avec un autre volet :
   * s'emparer du focus au montage y volerait les touches de l'autre volet.
   */
  autoFocus?: boolean;
}) {
  const triage = useTriage(
    api,
    mode,
    useMemo(() => initialFilters ?? filtersFromParams(new URLSearchParams()), []),
  );
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<unknown>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const codeHandleRef = useRef<CodeViewHandle | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getSummary()
      .then((s) => setSummary(s as Summary))
      .then(() => triage.reload())
      .catch(setError);
  }, [api, mode]);

  useEffect(() => {
    onFiltersChange?.(triage.state.filters);
  }, [triage.state.filters]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      const action = keyAction(event.key, {
        isTyping,
        hasModifier: event.ctrlKey || event.metaKey || event.altKey,
        decisions: mode.decisions,
      });
      if (!action) return;
      event.preventDefault();
      const run: Record<string, () => unknown> = {
        next: () => triage.step(1),
        previous: () => triage.step(-1),
        decide: () => triage.decide(action.score!, noteRef.current?.value.trim() ?? ""),
        undo: () => triage.undo(),
        note: () => noteRef.current?.focus(),
        search: () => searchRef.current?.focus(),
        // Sortir du champ sans perdre les raccourcis : le focus revient à la
        // racine de la vue, pas au <body> (où plus rien ne nous écouterait).
        blur: () => {
          target.blur();
          root.focus();
        },
        collapse: () => codeHandleRef.current?.collapse(),
        stepBack: () => codeHandleRef.current?.step(-1),
        stepForward: () => codeHandleRef.current?.step(1),
      };
      Promise.resolve(run[action.name]?.()).catch(setError);
    };
    // Écouteur porté par la racine de la vue, JAMAIS par `document` : les
    // touches ne nous parviennent que si le focus est réellement dans cette
    // vue. Dans le desktop Hermes, cette page reste montée alors qu'un autre
    // volet est actif (deux volets peuvent être côte à côte) ; un écouteur
    // global y captait les frappes destinées à l'autre volet -- et pire,
    // `note`/`search` y déplaçaient le focus vers paragone. Un composer
    // contenteditable de l'hôte n'était même pas vu comme une saisie
    // (tagName "DIV"), d'où le vol de touche pendant la frappe.
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, [triage, mode]);

  // Focus explicite : au montage seulement si l'appelant possède la fenêtre
  // (`autoFocus`, build autonome). Sinon c'est un geste de l'utilisateur qui
  // donne le focus -- un clic sur une zone non focusable de la vue le pose sur
  // la racine, sans jamais le prendre à un autre volet.
  useEffect(() => {
    if (autoFocus) rootRef.current?.focus();
  }, [autoFocus]);

  const focusRootOnEmptyClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const target = event.target as HTMLElement;
    if (!target.closest("input, textarea, select, button, a, [tabindex]")) root.focus();
  };

  useEffect(() => {
    const el = queueRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 200;
      if (nearEnd) triage.loadMore().catch(setError);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [triage]);

  if (error) return <ErrorMessage error={error} />;

  const { state } = triage;
  const classes = summary && vocabulary ? mode.classesOf(vocabulary) : [];

  return (
    <div className="t-root" ref={rootRef} tabIndex={-1} onPointerDown={focusRootOnEmptyClick}>
      {mode.isJudged && summary ? (
        <div className="t-head">
          <div className="counters">
            <span className="c">
              leads <b>{summary.totals.total}</b>
            </span>
            <span className="c">
              jugés <b>{summary.totals.agent_judged}</b>
            </span>
            <span className="c">
              triés <b>{summary.totals.human_reviewed}</b>
            </span>
          </div>
        </div>
      ) : null}
      <div className="t-filters">
        <input
          ref={searchRef}
          type="search"
          placeholder="rechercher : chemin, match, texte reconstruit…  ( / )"
          defaultValue={state.filters.q}
          onChange={(e) => triage.setFilter("q", e.target.value.trim()).catch(setError)}
        />
        <div className="chips">
          <button
            type="button"
            className={`chip${state.filters.class === "" ? " on" : ""}`}
            onClick={() => triage.setFilter("class", "").catch(setError)}
          >
            toutes
          </button>
          {summary
            ? summary.byClass
                .filter(({ k }: { k: string }) => classes.includes(k))
                .map(({ k, n }: { k: string; n: number }) => (
                  <button
                    key={k}
                    type="button"
                    className={`chip${state.filters.class === k ? " on" : ""}`}
                    onClick={() => triage.setFilter("class", k).catch(setError)}
                  >
                    <ClsTag cls={k} />
                    <span className="n">{n}</span>
                  </button>
                ))
            : null}
        </div>
        <div className="selects">
          {summary && mode.isJudged ? (
            <>
              <Select
                placeholder="analyzer"
                options={toOptions(summary.byAnalyzer)}
                value={state.filters.analyzer}
                onChange={(v) => triage.setFilter("analyzer", v).catch(setError)}
              />
              <Select
                placeholder="verdict du taint"
                options={toOptions(summary.byVerdict)}
                value={state.filters.verdict}
                onChange={(v) => triage.setFilter("verdict", v).catch(setError)}
              />
              <Select
                placeholder="score du juge"
                options={toOptions(summary.byAgentScore)}
                value={state.filters.score}
                onChange={(v) => triage.setFilter("score", v).catch(setError)}
              />
            </>
          ) : null}
          <Select
            placeholder="mon verdict"
            options={[...mode.decisions.map((d) => d.score), ...mode.otherScores].map((s) => ({
              value: s,
              label: mode.labels[s],
            }))}
            value={state.filters.human}
            onChange={(v) => triage.setFilter("human", v).catch(setError)}
          />
          {mode.isJudged ? (
            <Select
              placeholder="jugement"
              options={[{ value: "1", label: "non jugés seulement" }]}
              value={state.filters.unjudged}
              onChange={(v) => triage.setFilter("unjudged", v).catch(setError)}
            />
          ) : null}
          {mode.isJudged && vocabulary?.languages?.length ? (
            <select value={state.lang} onChange={(e) => triage.setLang(e.target.value).catch(setError)}>
              {vocabulary.languages.map((l: string) => (
                <option key={l} value={l}>
                  dossier {l}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
      <div className="masks">
        <span>Afficher aussi :</span>
        {mode.masks.map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={Boolean(state.masks[key])}
              onChange={(e) => triage.setMask(key, e.target.checked).catch(setError)}
            />
            {label}
            {state.hidden[key] !== undefined ? <span className="n">{state.hidden[key]}</span> : null}
          </label>
        ))}
        <span className="t-total">
          <b>{state.total}</b>
          {state.total > 1 ? " leads dans la file" : " lead dans la file"}
        </span>
      </div>
      <div className="t-main">
        <div className="queue" ref={queueRef}>
          {state.items.map((row) => (
            <QueueItem
              key={row.id}
              row={row}
              mode={mode}
              selected={row.id === state.selectedId}
              onOpen={() => triage.open(row.id)}
            />
          ))}
          {!state.items.length ? (
            <div className="q-empty">File vide pour ces filtres. Les masques ci-dessus disent ce qui est caché.</div>
          ) : !state.isDone ? (
            <div className="q-more">…</div>
          ) : null}
        </div>
        <div className="dossier">
          {state.selectedId === null ? (
            <div className="placeholder">
              {mode.help}
              <br />
              <br />
              <KeysHelp mode={mode} />
            </div>
          ) : (
            <Dossier triage={triage} codeHandleRef={codeHandleRef} noteRef={noteRef} />
          )}
        </div>
      </div>
    </div>
  );
}
