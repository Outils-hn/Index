import { createFileRoute, redirect } from "@tanstack/react-router";

// L'ancienne page « Administration » n'existe plus : l'ajout, la modification et la corbeille des fiches
// se font maintenant dans la Bibliotheque. On garde l'adresse pour les anciens favoris.
export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
