/**
 * shell/hash.ts — Routage par le hash de l'URL pour le build standalone,
 * port fidèle de `public/src/shell/route.js` + `constants.js` : `#/<nom-de-
 * route>?<query>`, une route inconnue retombe sur la route par défaut. Les
 * noms de route sont les mêmes ids que ceux déjà utilisés par `TABS` dans
 * `standalone/App.tsx` -- pas besoin d'un second vocabulaire parallèle.
 *
 * Hermes-only : volontairement PAS utilisé par le plugin desktop
 * (`hermes/plugin.tsx`). Écrire dans `window.location.hash` est une action
 * globale sur la fenêtre de l'hôte ; le SDK documente `ctx.storage` comme
 * mécanisme sanctionné de persistance d'état plugin et liste le "reach-in"
 * direct sur `location`/le DOM de l'hôte comme à éviter (catalog rule 8) --
 * et le routage top-level de l'app Hermes lit déjà ce même hash
 * (`host.navigate` est "hash-route navigation"), donc le réécrire depuis un
 * plugin risquerait de perturber sa propre navigation sans bénéfice réel
 * (l'utilisateur ne tape jamais une URL Hermes à la main). Le câblage
 * Hermes du même besoin (ex. Stats → Triage filtré) vit en state React
 * ordinaire dans `ParagoneTabs`, pas ici.
 */
import { useEffect, useState } from "react";

export type HashState = { path: string; params: URLSearchParams };

function readHash(): HashState {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const qIndex = hash.indexOf("?");
  const path = qIndex === -1 ? hash : hash.slice(0, qIndex);
  const params = new URLSearchParams(qIndex === -1 ? "" : hash.slice(qIndex + 1));
  return { path, params };
}

/** Résout le nom de route effectif : une route inconnue ou absente retombe sur `fallback`. */
export function resolveRouteName(path: string, knownNames: readonly string[], fallback: string): string {
  return knownNames.includes(path) ? path : fallback;
}

/** Les valeurs vides ne polluent pas l'URL (`buildQuery`-like : on les omet plutôt que de les écrire). */
function toParams(values: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return params;
}

/** Navigue vers une route, avec une query string neuve (vide par défaut -- un clic de nav repart propre, comme un lien `#/<nom>` vanilla). */
export function navigateHash(name: string, params: Record<string, string> = {}): void {
  const qs = toParams(params).toString();
  window.location.hash = qs ? `#/${name}?${qs}` : `#/${name}`;
}

export function useHash(): HashState {
  const [state, setState] = useState<HashState>(() => readHash());
  useEffect(() => {
    const onChange = () => setState(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return state;
}
