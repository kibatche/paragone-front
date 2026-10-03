/**
 * @author [A likely boring stuff made by] Shevek
 * @desc main.js — Coquille : routage par fragment d'URL (`#/triage?class=XSS`), navigation, bandeau du
 *       projet servi, et message d'aide quand l'API est injoignable.
 */

import * as api from "./common/api.js";
import { el } from "./common/dom.js";
import { mountCorpus } from "./corpus/view.js";
import { mountJobs } from "./jobs/view.js";
import { mountReference } from "./reference/view.js";
import { mountStats } from "./stats/view.js";
import { ROUTES } from "./shell/constants.js";
import { parseRoute } from "./shell/route.js";
import { INVENTORY_MODE } from "./triage/constants.js";
import { mountTriage } from "./triage/view.js";

const mounts = {
  triage: mountTriage,
  inventories: (container, params) => mountTriage(container, params, INVENTORY_MODE),
  corpus: mountCorpus,
  stats: mountStats,
  jobs: mountJobs,
  reference: mountReference,
};

function renderNav(nav, current) {
  nav.replaceChildren(
    ...ROUTES.map(({ name, label }) =>
      el("a", { href: `#/${name}`, className: name === current ? "on" : "", textContent: label }),
    ),
  );
}

function unreachable(error) {
  const base = api.apiBase();
  return el(
    "div",
    { className: "page" },
    el("h2", { textContent: "API injoignable" }),
    el("p", { className: "msg bad", textContent: `✗ ${error.message}` }),
    el(
      "p",
      { className: "prose" },
      `Base d'API utilisée : ${base || "l'origine de cette page"}. Servie par paragone, cette page appelle /api en chemins relatifs. `,
      "Hébergée ailleurs, ouvrir la page avec ?api=http://127.0.0.1:7331 (valeur mémorisée), et lancer paragone avec --cors <origine de la page>.",
    ),
  );
}

async function boot() {
  const nav = document.querySelector("#nav");
  const project = document.querySelector("#project");
  const view = document.querySelector("#view");
  let mounted = null;

  const show = () => {
    const { name, params } = parseRoute(location.hash);
    renderNav(nav, name);
    mounted?.destroy();
    mounted = mounts[name](view, params);
  };

  try {
    const meta = await api.getMeta();
    project.textContent = `${meta.root} · contrat ${meta.apiVersion}`;
  } catch (error) {
    console.error(error);
    renderNav(nav, "");
    view.replaceChildren(unreachable(error));
    return;
  }
  window.addEventListener("hashchange", show);
  show();
}

boot();
