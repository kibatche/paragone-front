/**
 * @author [A likely boring stuff made by] Shevek
 * @desc api.js — Client de l'API paragone : une fonction par opération du contrat OpenAPI. Les chemins
 *       sont relatifs à l'origine qui sert la page ; `?api=<url>` (mémorisé) vise une API hébergée ailleurs.
 */

import { API_PARAM, API_STORAGE_KEY } from "./constants.js";

class ApiError extends Error {
  constructor(status, message, method, url) {
    super(`${method} ${url} → ${status} : ${message}`);
    this.status = status;
    this.detail = message;
  }
}

/** Base de l'API : le paramètre d'URL gagne et se mémorise, sinon la valeur mémorisée, sinon l'origine. */
export function apiBase() {
  const fromUrl = new URLSearchParams(location.search).get(API_PARAM);
  if (fromUrl !== null) {
    storeBase(fromUrl);
    return fromUrl.replace(/\/$/, "");
  }
  return (readBase() ?? "").replace(/\/$/, "");
}

function readBase() {
  try {
    return localStorage.getItem(API_STORAGE_KEY);
  } catch (error) {
    console.warn("paragone : stockage local illisible, base d'API ignorée", error);
    return null;
  }
}

function storeBase(value) {
  try {
    if (value) localStorage.setItem(API_STORAGE_KEY, value);
    else localStorage.removeItem(API_STORAGE_KEY);
  } catch (error) {
    console.warn("paragone : stockage local inscriptible refusé", error);
  }
}

/** Chaîne de requête sans les valeurs vides, `null` ni `undefined` ; les booléens deviennent 0/1. */
export function buildQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    query.set(key, typeof value === "boolean" ? String(Number(value)) : String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function request(method, path, { query, body } = {}) {
  const url = `${apiBase()}/api${path}${buildQuery(query)}`;
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new ApiError(0, `API injoignable (${error.message})`, method, url);
  }
  const payload = await response.json().catch((error) => {
    console.warn(`paragone : ${method} ${url} a rendu un corps illisible`, error);
    return null;
  });
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? response.statusText, method, url);
  }
  return payload;
}

const get = (path, query) => request("GET", path, { query });

export const getMeta = () => get("/meta");
export const getSummary = () => get("/summary");
export const getTokens = () => get("/tokens");
export const getVocabulary = () => get("/vocabulary");
export const listAnalyzers = () => get("/analyzers");
export const getConfig = () => get("/config");
export const putConfig = (config) => request("PUT", "/config", { body: config });
export const startScan = () => request("POST", "/scan");
export const startJudge = () => request("POST", "/judge");
export const getJobs = () => get("/jobs");

export const listLeads = (filters) => get("/leads", filters);
export const countLeads = (filters) => get("/leads/count", filters);
export const getLead = (id) => get(`/lead/${id}`);
export const getDossier = (id, lang) => get(`/lead/${id}/dossier`, { lang });
export const listDuplicates = (id) => get(`/lead/${id}/duplicates`);
export const setHuman = (id, review) => request("POST", `/lead/${id}/human`, { body: review });
export const clearHuman = (id) => request("DELETE", `/lead/${id}/human`);
export const openInEditor = (id) => request("POST", `/lead/${id}/open`);
export const getSource = (id) => get("/source", { id });

export const listFiles = (filters) => get("/files", filters);
export const countFiles = (filters) => get("/files/count", filters);
export const listMatches = (filters) => get("/matches", filters);
export const countMatches = (filters) => get("/matches/count", filters);
