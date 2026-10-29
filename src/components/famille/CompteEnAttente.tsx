import { Clock } from "lucide-react";

/** Ecran d'un compte cree mais pas encore valide : il peut consulter, pas modifier. */
export function CompteEnAttente({ email }: { email: string | undefined }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-3 flex items-center gap-2 text-index">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <h1 className="text-base font-semibold text-foreground">Compte en attente de validation</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Le compte <span className="text-foreground">{email}</span> est bien créé. Un administrateur doit le valider
          (Configuration → Comptes) avant que vous puissiez ajouter ou modifier des fiches. En attendant, la
          bibliothèque reste consultable.
        </p>
      </div>
    </main>
  );
}
