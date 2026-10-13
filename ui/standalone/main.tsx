/**
 * standalone/main.tsx — Point d'entrée autonome : monte les vues React dans
 * la page servie directement par paragone (`--serve --public react/dist`),
 * sans Hermes. Le `fetcher` fait un `fetch` navigateur ordinaire vers
 * `/api/...`, même origine -- aucun proxy nécessaire ici.
 */
import { createRoot } from "react-dom/client";
import { makeApi, type Fetcher } from "../api/client";
import { buildQuery } from "../api/query";
import { App } from "./App";

const fetcher: Fetcher = async (method, path, opts = {}) => {
  const url = `/api${path}${buildQuery(opts.query)}`;
  const init: RequestInit = { method, headers: {} };
  if (opts.body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? response.statusText);
  return payload;
};

const api = makeApi(fetcher);
const root = document.getElementById("root");
if (!root) throw new Error("standalone/main.tsx: #root introuvable dans la page hôte");
createRoot(root).render(<App api={api} />);
