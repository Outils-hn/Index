import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

/**
 * « Mon compte » : changer l'adresse email de connexion. Le compte, son rôle et ses droits ne changent pas
 * (ils sont liés à l'identifiant du compte, pas à l'adresse). Supabase envoie un lien de confirmation.
 */
export function MonCompte({ email, open, onOpenChange }: { email: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [nouveau, setNouveau] = useState("");
  const [busy, setBusy] = useState(false);
  const [envoye, setEnvoye] = useState("");
  const valide = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nouveau.trim()) && nouveau.trim().toLowerCase() !== email.toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valide) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: nouveau.trim() }, { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setEnvoye(nouveau.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setEnvoye(""); setNouveau(""); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mon compte</DialogTitle>
          <DialogDescription>Adresse actuelle : {email}</DialogDescription>
        </DialogHeader>
        {envoye ? (
          <p className="text-sm">
            Un email de confirmation a été envoyé. Ouvrez le lien reçu (à l'adresse <strong>{envoye}</strong>, et peut-être aussi à l'ancienne) :
            l'adresse changera à ce moment-là. Votre compte et vos droits restent les mêmes.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nouvel-email">Nouvelle adresse email</Label>
              <Input id="nouvel-email" type="email" autoComplete="email" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Un lien de confirmation vous sera envoyé. Tant qu'il n'est pas ouvert, l'ancienne adresse reste valable.</p>
            <Button type="submit" disabled={!valide || busy}>{busy ? "Envoi…" : "Changer l'adresse"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
