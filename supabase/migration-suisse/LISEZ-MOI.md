# Migration vers le projet Supabase « outils-hn » (Suisse)

Tout se fait dans l'éditeur SQL de Supabase (Supabase > projet > SQL Editor > New query), comme pour la migration de Masse :
on copie un script, on le colle, on clique sur Run. Pas de commande, pas de Node.

**Nouveau projet** : `https://dtxgvwaqjmmffiiohika.supabase.co` (« outils-hn », Zurich). **Ancien projet** : Index (`ngfz…`).

## Avant de commencer
- Choisis un moment calme. Entre l'export (étape 4) et la bascule (étape 8), **personne ne modifie rien** dans les applis,
  sinon ces modifications seraient perdues. Si ça arrive, on refait l'export et l'import (ils remplacent tout).
- Les fichiers de sauvegarde contiennent des données sensibles (adresses email, accès fournisseurs) : garde-les privés et supprime-les à la fin.

## Les étapes
1. **Installer la structure** — NOUVEAU projet : colle `1-installer-nouveau.sql`, Run. Une seule fois. S'il affiche une erreur, ne relance pas : dis-le-moi.
2. **Comparer les deux projets** — lance `inventaire.sql` dans l'ANCIEN projet puis dans le NOUVEAU ; copie chaque résultat dans un fichier
   (`inventaire-ancien.json`, `inventaire-nouveau.json`) et envoie-les-moi. Je compare (tables, droits, règles de sécurité) et je te donne un
   petit script de correction si besoin. Aucune donnée personnelle dedans.
3. **Régler l'authentification du nouveau projet** — Authentication > URL Configuration : *Site URL* `https://outils-hn.github.io/Index/`,
   *Redirect URLs* `https://outils-hn.github.io/**`. Puis, côté nouveau projet, mets les mêmes réglages que l'ancien (Authentication > Sign In / Providers > Email :
   confirmation d'email, longueur du mot de passe ; Authentication > Email Templates ; SMTP personnalisé s'il y en avait un).
4. **Exporter les données** — ANCIEN projet : `2a-export-comptes-et-index.sql` → enregistre la cellule dans `sauvegarde-comptes-index.json` ;
   `2b-export-autres-applis.sql` → `sauvegarde-autres-applis.json`.
5. **Importer les comptes et Index** — NOUVEAU projet : ouvre `3a-importer-comptes-et-index.sql`, remplace le mot en majuscules entre les deux `$json$`
   par le contenu de `sauvegarde-comptes-index.json`, Run. Les deux colonnes « attendues » et « copiees » doivent être égales.
6. **Importer les autres applis** — pareil avec `3b-importer-autres-applis.sql` et `sauvegarde-autres-applis.json`.
7. **Copier les PDF** — ouvre `https://outils-hn.github.io/migration-pdf.html`, connecte-toi avec ton compte habituel (même mot de passe : ça prouve
   aussi que les comptes ont bien été copiés) et clique sur « Copier les PDF ». Relançable sans risque.
8. **Bascule** — dis-moi « on bascule » : je change l'adresse de la base dans toutes les applis en une fois. Tout le monde devra se reconnecter une fois.
9. **Plus tard** — on garde l'ancien projet quelques jours (lecture seule en pratique), puis on le supprime, ainsi que l'ancien projet de Masse.
