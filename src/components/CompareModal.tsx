import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ExternalLink, Globe, FileText, AlertTriangle, MapPin, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo, useEffect } from "react";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Product } from "@/components/ProductCard";

interface CompareModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
}

type Validity = "valid" | "warn" | "expired";
function getValidity(updatedAt: string): Validity {
  const months = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
  if (months < 12) return "valid";
  if (months < 24) return "warn";
  return "expired";
}
const VALIDITY: Record<Validity, { label: string; dot: string; pill: string }> = {
  valid: {
    label: "À jour",
    dot: "bg-[oklch(0.6_0.18_150)] shadow-[0_0_6px_oklch(0.65_0.2_150)]",
    pill: "bg-[oklch(0.95_0.05_150)] text-[oklch(0.38_0.12_150)] border-[oklch(0.82_0.1_150)]",
  },
  warn: {
    label: "À vérifier",
    dot: "bg-[oklch(0.7_0.17_70)] shadow-[0_0_6px_oklch(0.75_0.18_70)]",
    pill: "bg-[oklch(0.96_0.07_75)] text-[oklch(0.42_0.13_60)] border-[oklch(0.83_0.12_75)]",
  },
  expired: {
    label: "Expiré",
    dot: "bg-[oklch(0.6_0.2_28)] shadow-[0_0_6px_oklch(0.65_0.22_28)]",
    pill: "bg-[oklch(0.95_0.05_25)] text-[oklch(0.42_0.16_28)] border-[oklch(0.82_0.12_28)]",
  },
};

export function CompareModal({ open, onClose, products }: CompareModalProps) {
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const pdfProducts = useMemo(() => products.filter((p) => !!p.pdf_path), [products]);
  const showPdfView = pdfProducts.length >= 2;

  const pdfUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pdfProducts) {
      if (p.pdf_path) {
        const { data } = supabase.storage.from("technical-sheets").getPublicUrl(p.pdf_path);
        map.set(p.id, data.publicUrl);
      }
    }
    return map;
  }, [pdfProducts]);

  const [activeTab, setActiveTab] = useState<string>("");
  useEffect(() => {
    if (showPdfView && pdfProducts.length > 0) {
      setActiveTab((prev) => (prev && pdfProducts.some((p) => p.id === prev) ? prev : pdfProducts[0].id));
    }
  }, [showPdfView, pdfProducts]);

  const openPdf = (p: Product) => {
    if (!p.pdf_path) return;
    const { data } = supabase.storage.from("technical-sheets").getPublicUrl(p.pdf_path);
    setPdfUrl(data.publicUrl);
    setPdfName(p.name);
    setPdfFilename(p.pdf_filename);
    setPdfOpen(true);
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <tr className="border-b border-border align-top">
      <th
        scope="row"
        className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground py-3 px-3 w-[160px] min-w-[140px] sticky left-0 bg-card z-10"
      >
        {label}
      </th>
      {children}
    </tr>
  );

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-[50%] top-[50%] z-50 flex flex-col",
              "w-[95vw] max-w-[1600px] h-[92vh] max-h-[960px]",
              "-translate-x-1/2 -translate-y-1/2",
              "border border-border bg-background shadow-2xl rounded-xl overflow-hidden",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "duration-200",
            )}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
              <div>
                <DialogPrimitive.Title className="text-base font-semibold text-foreground leading-tight">
                  {showPdfView ? "Comparaison des fiches techniques" : "Comparaison de produits"}
                </DialogPrimitive.Title>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {products.length} produit{products.length > 1 ? "s" : ""} côte à côte
                </p>
              </div>
              <DialogPrimitive.Close
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md border border-border bg-secondary p-1.5 text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            {showPdfView ? (
              isMobile ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                  <TabsList
                    className="mx-3 mt-3 h-auto p-1 grid shrink-0"
                    style={{ gridTemplateColumns: `repeat(${pdfProducts.length}, minmax(0, 1fr))` }}
                  >
                    {pdfProducts.map((p) => (
                      <TabsTrigger key={p.id} value={p.id} className="text-xs py-1.5 truncate">
                        {p.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {pdfProducts.map((p) => (
                    <TabsContent
                      key={p.id}
                      value={p.id}
                      className="flex-1 mt-2 data-[state=inactive]:hidden flex flex-col min-h-0"
                    >
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-y border-border bg-card shrink-0">
                        <span className="text-sm font-medium text-foreground truncate" title={p.name}>
                          {p.name}
                        </span>
                        <a
                          href={pdfUrls.get(p.id)}
                          download={p.pdf_filename || "fiche-technique.pdf"}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <iframe
                        src={pdfUrls.get(p.id)}
                        title={`PDF — ${p.name}`}
                        className="flex-1 w-full border-0 bg-black/5 dark:bg-white/5"
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div
                  className="flex-1 grid min-h-0 divide-x divide-border"
                  style={{ gridTemplateColumns: `repeat(${pdfProducts.length}, minmax(0, 1fr))` }}
                >
                  {pdfProducts.map((p) => (
                    <div key={p.id} className="flex flex-col min-h-0 min-w-0">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground truncate">
                            {p.category}
                          </div>
                          <div className="text-sm font-semibold text-foreground truncate" title={p.name}>
                            {p.name}
                          </div>
                        </div>
                        <a
                          href={pdfUrls.get(p.id)}
                          download={p.pdf_filename || "fiche-technique.pdf"}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
                          title="Télécharger le PDF"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Télécharger</span>
                        </a>
                      </div>
                      <iframe
                        src={pdfUrls.get(p.id)}
                        title={`PDF — ${p.name}`}
                        className="flex-1 w-full border-0 bg-black/5 dark:bg-white/5"
                      />
                    </div>
                  ))}
                </div>
              )
            ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card z-20">
                  <tr className="border-b border-border">
                    <th className="w-[160px] min-w-[140px] sticky left-0 bg-card z-30 border-r border-border" />
                    {products.map((p) => (
                      <th
                        key={p.id}
                        className="text-left p-4 min-w-[260px] border-r border-border last:border-r-0"
                      >
                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/70 mb-1">
                          {p.category}
                        </div>
                        <h3 className="font-bold text-foreground leading-tight text-base">
                          {p.name}
                        </h3>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Row label="Fournisseur">
                    {products.map((p) => (
                      <td key={p.id} className="p-3 border-r border-border last:border-r-0 text-foreground">
                        {p.supplier}
                      </td>
                    ))}
                  </Row>
                  <Row label="Catégorie">
                    {products.map((p) => (
                      <td key={p.id} className="p-3 border-r border-border last:border-r-0 text-foreground">
                        {p.category}
                      </td>
                    ))}
                  </Row>
                  <Row label="Tags">
                    {products.map((p) => (
                      <td key={p.id} className="p-3 border-r border-border last:border-r-0">
                        {p.tags.length === 0 ? (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {p.tags.map((t) => (
                              <Badge key={t} variant="outline" className="font-normal">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                  </Row>
                  <Row label="Note / Remarque">
                    {products.map((p) => (
                      <td key={p.id} className="p-3 border-r border-border last:border-r-0">
                        {p.note && p.note.trim() ? (
                          <div className="rounded-md border border-[oklch(0.85_0.12_85)] bg-[oklch(0.97_0.05_85)] text-[oklch(0.35_0.1_60)] px-2.5 py-2 flex items-start gap-2 text-xs leading-relaxed">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[oklch(0.55_0.15_60)]" />
                            <p className="whitespace-pre-wrap">{p.note}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        )}
                      </td>
                    ))}
                  </Row>
                  <Row label="Validité">
                    {products.map((p) => {
                      const v = getValidity(p.updated_at);
                      const s = VALIDITY[v];
                      return (
                        <td key={p.id} className="p-3 border-r border-border last:border-r-0">
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              s.pill,
                            )}
                          >
                            <span className={cn("inline-block h-2 w-2 rounded-full", s.dot)} />
                            {s.label}
                          </span>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            Mis à jour le{" "}
                            {new Date(p.updated_at).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </Row>
                  <Row label="Chantiers associés">
                    {products.map((p) => (
                      <td key={p.id} className="p-3 border-r border-border last:border-r-0">
                        {!p.projects || p.projects.length === 0 ? (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {p.projects.map((pr) => (
                              <span
                                key={pr.id}
                                className="inline-flex items-center gap-1 rounded-full bg-secondary text-foreground/70 text-[10px] px-2 py-0.5 border border-border"
                              >
                                <MapPin className="h-2.5 w-2.5" />
                                <span className="font-mono">{pr.numero}</span>
                                <span>{pr.nom}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                  </Row>
                  <Row label="Fiche technique">
                    {products.map((p) => (
                      <td key={p.id} className="p-3 border-r border-border last:border-r-0">
                        {p.pdf_path ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            {p.pdf_filename || "PDF disponible"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">Aucun PDF</span>
                        )}
                      </td>
                    ))}
                  </Row>
                </tbody>
                <tfoot>
                  <tr>
                    <th className="w-[160px] min-w-[140px] sticky left-0 bg-card z-10 border-r border-border" />
                    {products.map((p) => (
                      <td
                        key={p.id}
                        className="p-3 border-r border-border last:border-r-0 align-top"
                      >
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => openPdf(p)}
                            disabled={!p.pdf_path}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                          >
                            Ouvrir la fiche
                            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                          </Button>
                          {p.url ? (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
                            >
                              <Globe className="h-3.5 w-3.5" />
                              Site fournisseur
                            </a>
                          ) : (
                            <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground/50">
                              Pas de site
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            )}

            <div className="shrink-0 border-t border-border bg-card px-4 py-2.5 flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-1.5" />
                Fermer le comparateur
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <PdfViewerModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        productName={pdfName}
        pdfUrl={pdfUrl}
        pdfFilename={pdfFilename}
      />
    </>
  );
}