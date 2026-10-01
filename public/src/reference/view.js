/**
 * @author [A likely boring stuff made by] Shevek
 * @desc view.js — Vue du Référentiel : projet servi (`/api/meta`), valeurs énumérées et légendes
 *       (`/api/vocabulary`), analyzers jugés avec leur consigne et leurs références (`/api/analyzers`).
 */

import * as api from "../common/api.js";
import { el } from "../common/dom.js";
import { clsTag, errorMessage, kvGrid, section, table } from "../common/widgets.js";
import { ENUMS } from "./constants.js";

const chips = (values) => el("span", { className: "chips-flat" }, ...values.map((v) => el("code", { textContent: v })));

function renderMeta(meta) {
  return section(
    "Projet servi",
    null,
    el(
      "div",
      { className: "card" },
      kvGrid([
        ["dossier", el("code", { textContent: meta.root })],
        ["base", el("code", { textContent: meta.dbPath })],
        ["version du contrat", meta.apiVersion],
        [
          "contrat OpenAPI",
          el(
            "span",
            {},
            el("a", { href: "/openapi", target: "_blank", textContent: "/openapi" }),
            " · ",
            el("a", { href: "/openapi/json", target: "_blank", textContent: "/openapi/json" }),
          ),
        ],
      ]),
    ),
  );
}

function legendTable(legend) {
  return el(
    "div",
    { className: "grid-2" },
    ...Object.entries(legend).map(([name, entries]) =>
      el(
        "div",
        { className: "card" },
        el("h4", { textContent: `légende « ${name} »` }),
        kvGrid(Object.entries(entries).map(([key, text]) => [key, text])),
      ),
    ),
  );
}

function renderVocabulary(vocabulary) {
  const lang = vocabulary.defaultLanguage;
  return section(
    "Vocabulaire",
    `langue par défaut : ${lang}`,
    el("div", { className: "card" }, kvGrid(ENUMS.map(([label, key]) => [label, chips(vocabulary[key])]))),
    legendTable(vocabulary.legends[lang]),
  );
}

function renderAnalyzers(analyzers, lang) {
  const columns = [
    { title: "analyzer", cell: (a) => el("code", { textContent: a.name }) },
    { title: "classes", cell: (a) => el("span", {}, ...a.classes.map(clsTag)) },
    {
      title: "consigne",
      cell: (a) =>
        el(
          "div",
          { className: "guidance-list" },
          ...Object.entries(a.guidance[lang] ?? {}).map(([cls, text]) => el("p", {}, clsTag(cls), ` ${text}`)),
        ),
    },
    {
      title: "références",
      cell: (a) =>
        el(
          "ul",
          { className: "refs" },
          ...a.references.map((r) =>
            el("li", {}, el("a", { href: r.url, target: "_blank", rel: "noreferrer noopener", textContent: r.label })),
          ),
        ),
    },
  ];
  return section("Analyzers jugés", `${analyzers.length} analyzers`, table(columns, analyzers));
}

/** @return `{ destroy }` */
export function mountReference(container) {
  const page = el("div", { className: "page" }, el("h2", { textContent: "Référentiel" }));
  container.replaceChildren(page);
  Promise.all([api.getMeta(), api.getVocabulary(), api.listAnalyzers()])
    .then(([meta, vocabulary, analyzers]) => {
      page.append(
        renderMeta(meta),
        renderVocabulary(vocabulary),
        renderAnalyzers(analyzers, vocabulary.defaultLanguage),
      );
    })
    .catch((error) => {
      console.error(error);
      page.append(errorMessage(error));
    });
  return { destroy: () => container.replaceChildren() };
}
