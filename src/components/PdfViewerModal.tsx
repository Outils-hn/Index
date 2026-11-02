import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Download, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfViewerModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  pdfUrl: string;
  pdfFilename?: string | null;
  /** Navigation dans la liste affichee : « 3 / 12 », fiche precedente / suivante. */
  position?: string;
  onPrev?: () => void;
  onNext?: () => void;
}

export function PdfViewerModal({ open, onClose, productName, pdfUrl, pdfFilename, position, onPrev, onNext }: PdfViewerModalProps) {
  // Fleches gauche / droite : fiche precedente / suivante (sauf si le curseur est dans un champ)
  React.useEffect(() => {
    if (!open || (!onPrev && !onNext)) return;
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onPrev, onNext]);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 flex flex-col",
            "w-[95vw] max-w-[1400px] h-[90vh] max-h-[900px]",
            "-translate-x-1/2 -translate-y-1/2",
            "border border-border bg-background shadow-2xl rounded-xl overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-200"
          )}
          onEscapeKeyDown={onClose}
          onPointerDownOutside={onClose}
        >
          {/* Barre supérieure */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
            {(onPrev || onNext) && (
              <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Parcourir les fiches">
                <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Fiche précédente" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {position && <span className="num min-w-[3.5rem] text-center text-xs text-muted-foreground" aria-live="polite">{position}</span>}
                <button type="button" onClick={onNext} disabled={!onNext} aria-label="Fiche suivante" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <h2 className="min-w-0 flex-1 text-base font-semibold text-foreground truncate leading-tight" title={productName}>
              {productName}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                title="Ouvrir dans un nouvel onglet (utile sur téléphone : toutes les pages, zoom)"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nouvel onglet</span>
                <span className="sm:hidden">Ouvrir</span>
              </a>
              <a
                href={pdfUrl}
                download={pdfFilename || "fiche-technique.pdf"}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
                title="Télécharger le PDF"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Télécharger</span>
              </a>
              <DialogPrimitive.Close
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md border border-border bg-secondary p-1.5 text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors cursor-pointer"
                aria-label="Fermer le lecteur"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Zone PDF */}
          <div className="flex-1 bg-black/5 dark:bg-white/5 overflow-hidden">
            <iframe
              src={pdfUrl}
              title={`PDF — ${productName}`}
              className="w-full h-full border-0"
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
