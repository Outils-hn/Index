import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Corbeille des fiches : mise a la corbeille (30 jours, restaurable), restauration, suppression definitive (efface aussi le PDF). */
export function useCorbeille() {
  const qc = useQueryClient();
  const trash = useMutation({
    mutationFn: async ({ id, back }: { id: string; back?: boolean }) => {
      const { error } = await supabase.from("products").update({ deleted_at: back ? null : new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      return back;
    },
    onSuccess: (back) => {
      toast.success(back ? "Fiche restaurée." : "Fiche mise à la corbeille (restaurable 30 jours).");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const purge = useMutation({
    mutationFn: async (p: { id: string; pdf_path: string | null }) => {
      if (p.pdf_path) await supabase.storage.from("technical-sheets").remove([p.pdf_path]);
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche supprimée définitivement.");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return { trash, purge };
}
