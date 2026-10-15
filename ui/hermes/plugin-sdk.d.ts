/**
 * Ambient shim for the Hermes desktop plugin SDK -- not an installed
 * package, it's injected at runtime by the desktop app. Declared loosely
 * (just enough for our own code to type-check); never bundled, always
 * passed as `--external @hermes/plugin-sdk` to `bun build`.
 */
declare module "@hermes/plugin-sdk" {
  import type { ComponentProps, ReactNode } from "react";

  export const ROUTES_AREA: string;
  export const SIDEBAR_NAV_AREA: string;
  export const PALETTE_AREA: string;
  export const KEYBINDS_AREA: string;

  /** UI kit -- just enough of the real prop surface for our own call sites. */
  export function Button(
    props: ComponentProps<"button"> & { variant?: string; size?: string; asChild?: boolean },
  ): ReactNode;
  export function StatusDot(
    props: ComponentProps<"span"> & { tone: "good" | "muted" | "warn" | "bad" },
  ): ReactNode;

  /** In-app toast door (we only need the error toast here). */
  export const host: {
    notify: (opts: { kind?: string; message: string; title?: string; detail?: string }) => string;
    notifyError: (error: unknown, fallbackMessage?: string) => void;
  };
}
