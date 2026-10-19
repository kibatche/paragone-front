/**
 * Modal.tsx — Port du `Modal` de obs (`~/Projects/obs/ui/views/App.tsx`),
 * repris tel quel : même markup (`.modal-backdrop` > `.modal`), même CSS,
 * mêmes gestes (clic sur le fond ou Échap pour fermer). Une seule différence
 * assumée : l'écouteur Échap est porté par la boîte elle-même (focusée au
 * montage) et non par `window` -- dans le desktop Hermes un écouteur global
 * capterait l'Échap d'un autre volet, c'est exactement le piège corrigé dans
 * `views/Triage.tsx`.
 */
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Ouvrir la boîte est un geste explicite de l'utilisateur : lui donner le
    // focus est donc légitime (contrairement à un montage de page).
    boxRef.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        ref={boxRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.stopPropagation();
          onClose();
        }}
      >
        <h2>{title}</h2>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}
