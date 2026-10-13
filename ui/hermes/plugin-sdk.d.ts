/**
 * Ambient shim for the Hermes desktop plugin SDK -- not an installed
 * package, it's injected at runtime by the desktop app. Declared loosely
 * (just enough for our own code to type-check); never bundled, always
 * passed as `--external @hermes/plugin-sdk` to `bun build`.
 */
declare module "@hermes/plugin-sdk" {
  export const ROUTES_AREA: string;
  export const SIDEBAR_NAV_AREA: string;
  export const PALETTE_AREA: string;
  export const KEYBINDS_AREA: string;
}
