/**
 * triage/CodeView.tsx — Port React fidèle de `public/src/triage/code_view.js` :
 * vue du fichier entier d'un lead, VIRTUALISÉE -- seule la fenêtre visible
 * (+ marge `CODE_BUFFER`) est colorée et rendue. Mesuré (pas supposé) :
 * colorer un fichier entier de plusieurs centaines de milliers de lignes
 * via Shiki prend ~24 s (voir changelog ISA) -- seule une fenêtre bornée
 * (~100 lignes) garde ça sous la dizaine de ms en médiane. La ligne du
 * sink est la cible, celles des origines sont marquées ; les étapes du
 * taint se parcourent une à une avec leur portion surlignée.
 */
import { useEffect, useRef, useState } from "react";
import { CODE_GUTTER_PX, LINE_HEIGHT_PX, highlightRange, scrollTopFor, visibleRange, type Span } from "./geometry";
import { highlightJs, splitHighlightedLines } from "./highlight";
import { stepCaption, type Step } from "./codeSteps";

export type CodeViewHandle = {
  reveal: (line: number) => void;
  showStep: (index: number) => void;
  step: (delta: number) => void;
  center: () => void;
  collapse: () => void;
};

export function CodeView({
  text,
  targetLine,
  marked,
  steps,
  onOpenEditor,
  handleRef,
  onStepChange,
}: {
  text: string;
  targetLine: number;
  marked: { origin: Set<number>; sanitized: Set<number> };
  steps: Step[];
  onOpenEditor: () => Promise<unknown>;
  /** La vue expose `reveal`/`showStep`/`step`/`center`/`collapse` à son parent (clic sur une origine, touches ← →, bouton sink) -- un ref plutôt qu'un forwardRef pour rester un simple composant fonction. */
  handleRef: React.MutableRefObject<CodeViewHandle | null>;
  /** Notifie le parent (Dossier) de l'étape courante -- pour que le nœud affiché dans
   * "D'où vient la valeur" suive le code plutôt que de vivre dans un état séparé. */
  onStepChange?: (index: number) => void;
}) {
  const lines = useRef(text.split(/\r?\n/)).current;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(480);
  const [currentStep, setCurrentStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [html, setHtml] = useState<string[] | null>(null);
  const [editorStatus, setEditorStatus] = useState<string | null>(null);

  const { first, last } = visibleRange(scrollTop, clientHeight, lines.length);

  useEffect(() => {
    let cancelled = false;
    highlightJs(lines.slice(first, last).join("\n"))
      .then((h) => !cancelled && setHtml(splitHighlightedLines(h)))
      .catch(() => !cancelled && setHtml(null));
    return () => {
      cancelled = true;
    };
  }, [first, last]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setClientHeight(el.clientHeight));
    observer.observe(el);
    setClientHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  const goTo = (line: number) => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = scrollTopFor(line, el.clientHeight);
    setScrollTop(el.scrollTop);
  };

  const showStep = (index: number) => {
    if (index < 0 || index >= steps.length) return;
    setCurrentStep(index);
    onStepChange?.(index);
    const line = steps[index].span?.[0];
    if (line) {
      if (!expanded) viewportRef.current?.scrollIntoView({ block: "nearest" });
      goTo(line);
    }
  };

  useEffect(() => {
    handleRef.current = {
      reveal: (line) => {
        if (!expanded) viewportRef.current?.scrollIntoView({ block: "nearest" });
        goTo(line);
      },
      showStep,
      step: (delta) => showStep(currentStep + delta),
      center: () => goTo(steps[currentStep]?.span?.[0] ?? targetLine),
      collapse: () => setExpanded(false),
    };
  });

  useEffect(() => {
    goTo(steps[0]?.span?.[0] ?? targetLine);
    setCurrentStep(0);
    onStepChange?.(0);
  }, [text]);

  const lineClass = (number: number) => {
    if (number === targetLine) return "cline target";
    if (marked.sanitized.has(number)) return "cline mark sanitized";
    return marked.origin.has(number) ? "cline mark" : "cline";
  };

  const stepMark = (number: number) => {
    const range = highlightRange(lines[number - 1] ?? "", steps[currentStep]?.span as Span | undefined, number);
    if (!range) return null;
    return (
      <span
        className="step-hl"
        style={{ left: `calc(${CODE_GUTTER_PX}px + ${range.from}ch)`, width: `${range.to - range.from}ch` }}
      />
    );
  };

  const openInEditor = async () => {
    try {
      await onOpenEditor();
    } catch (error) {
      setEditorStatus(error instanceof Error ? error.message : String(error));
      setTimeout(() => setEditorStatus(null), 3000);
    }
  };

  return (
    <div className={expanded ? "codeview-wrap expanded" : "codeview-wrap"}>
      <div className="code-tools">
        <div className="step-tools">
          <button
            type="button"
            disabled={currentStep <= 0}
            title="étape précédente"
            onClick={() => showStep(currentStep - 1)}
          >
            ◀
          </button>
          <span className="step-label" title={steps[currentStep]?.label ?? ""}>
            {stepCaption(steps, currentStep)}
          </span>
          <button
            type="button"
            disabled={currentStep >= steps.length - 1}
            title="étape suivante"
            onClick={() => showStep(currentStep + 1)}
          >
            ▶
          </button>
        </div>
        <button type="button" onClick={() => showStep(0)}>
          ↩ sink (l. {targetLine})
        </button>
        <button type="button" title="ouvrir le fichier à la ligne du sink" onClick={openInEditor}>
          {editorStatus ? `échec : ${editorStatus}` : "↗ éditeur"}
        </button>
        <button type="button" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "✕ fermer (Échap)" : "⤢ agrandir"}
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            goTo(targetLine);
          }}
        >
          ↺ taille par défaut
        </button>
      </div>
      <div className="codeview" ref={viewportRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        <div className="code-spacer" style={{ height: lines.length * LINE_HEIGHT_PX }}>
          <div className="code-window" style={{ transform: `translateY(${first * LINE_HEIGHT_PX}px)` }}>
            {(html ?? lines.slice(first, last).map((l) => l)).map((lineHtml, index) => {
              const number = first + index + 1;
              return (
                <div key={number} className={lineClass(number)}>
                  <span className="ln">{number}</span>
                  <span
                    className="src"
                    // Sûr : lineHtml vient de Shiki (texte source échappé avant coloration)
                    // ou, en repli (html=null, échec du highlighter), est la ligne brute --
                    // auquel cas on passe par `textContent`-équivalent (children), pas innerHTML.
                    {...(html
                      ? { dangerouslySetInnerHTML: { __html: lineHtml || " " } }
                      : { children: lineHtml || " " })}
                  />
                  {stepMark(number)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
