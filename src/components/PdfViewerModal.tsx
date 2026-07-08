import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfViewerModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  pdfUrl: string;
  pdfFilename?: string | null;
}

export function PdfViewerModal({ open, onClose, productName, pdfUrl, pdfFilename }: PdfViewerModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 flex flex-col",
            "w-[96vw] max-w-[1800px] xl:max-w-[2200px] 2xl:max-w-[2600px]",
            "h-[92vh] max-h-[1000px] xl:max-h-[1200px] 2xl:max-h-[1400px]",
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
            <h2 className="text-base font-semibold text-foreground truncate leading-tight" title={productName}>
              {productName}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
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
