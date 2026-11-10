# Journal des versions — Index

Le numéro de version se met à jour dans `src/lib/version.ts` (pied de page et fenêtre « À propos » le lisent).

Chaque version qui change quelque chose de visible pour l'équipe a une puce « Nouveauté : … », en langage courant : c'est la seule phrase affichée sur la page « Nouveautés » de l'Accueil.

## 2.34 — 10 novembre 2026

- Nouveauté : sur la page Listes, le bas du cadre des fournisseurs est maintenant bien aligné avec celui des chantiers.

## 2.33 — 10 novembre 2026

- Nouveauté : sur la page Listes, le cadre des fournisseurs s'arrête exactement à la même hauteur que celui des chantiers.

## 2.32 — 10 novembre 2026

- Nouveauté : sur la page Listes, chaque catégorie, fournisseur et chantier indique combien de fiches l'utilisent, et la confirmation de suppression le rappelle. Un champ « Filtrer » apparaît dans les longues listes, qui défilent maintenant dans leur cadre (le bouton Ajouter reste toujours visible). Les chantiers passent sous les catégories pour équilibrer la page.

## 2.31 — 10 novembre 2026

- Nouveauté : dans le menu ⋯ d'une fiche, « Noter dans Check » ouvre Check avec une note déjà rédigée (produit, fournisseur, lien de la fiche).

## 2.30 — 9 novembre 2026

- Nouveauté : finitions après une revue complète. Le nom de la fiche reste lisible dans le lecteur PDF sur téléphone, le bouton « + » de la fenêtre « Modifier » ne déborde plus, le texte « Aucun PDF » est clair, la ligne « à relire » du haut est plus courte, l'écran de connexion a un œil pour voir le mot de passe, et l'onglet « Listes » est visible aussi pour un compte en attente.

## 2.29 — 9 novembre 2026

- Nouveauté : petites finitions. Le « 6 à vérifier » sous le titre a retrouvé son espace, la phrase « Lecture seule » n'est plus répétée pour un visiteur, une fiche sans PDF ni lien n'affiche plus de bouton grisé, et sur téléphone « Se connecter » devient une icône pour laisser la place à l'onglet « Bibliothèque ».

## 2.28 — 9 novembre 2026

- Nouveauté : sur les cartes, « Comparer » est plus discret (bord seulement au survol ou une fois choisi), les mots-clés sont un peu plus grands et plus foncés, et le bandeau du fournisseur ressort mieux en mode sombre.

## 2.27 — 9 novembre 2026

- Nouveauté : cartes allégées. Le nom de la famille n'est plus répété sur chaque carte quand le titre de la section le dit déjà, lien et corbeille passent dans un menu « ⋯ », le bouton « Ouvrir la fiche » est blanc à bord gris (plus de violet), le fournisseur est un peu moins appuyé, le titre plus grand, et chaque famille a maintenant une couleur différente.

## 2.26 — 9 novembre 2026

- Nouveauté : les fiches ont un bandeau gris-bleu avec le nom du fournisseur en gras (et les boutons Comparer, lien, crayon, corbeille, étoile), un titre plus gros et plus d'espace entre les cartes ; la bibliothèque s'ouvre triée « Par famille » (une section par famille, nom en couleur), « Par fournisseur » reste dans le menu « Trier ».

## 2.25 — 9 novembre 2026

- Nouveauté : la bibliothèque se trie aussi « Par fournisseur » (une section par fournisseur avec le nombre de fiches) ; dans la vue « Toutes », le nom de la famille et son icône sont en couleur ; le bouton « Ouvrir la fiche » est plus doux (violet clair au lieu du noir) ; le damier est retiré.

## 2.24 — 9 novembre 2026

- Nouveauté : les fiches de la bibliothèque sont en damier (une carte sur deux un peu plus claire) et chaque famille a sa bande de couleur en haut de la carte, pour mieux distinguer les cartes voisines.

## 2.23 — 9 novembre 2026

- Nouveauté : on peut de nouveau ajouter une fiche PDF dans une famille dont le nom contient un accent ou un « & » (par exemple « Membranes & Étanchéité »), qui donnait « Invalid key ».

## 2.22 — 9 novembre 2026

- Nouveauté : au téléphone, les liens du pied de page (« Conçu par », « Sauvegarde », « Suggestion / bug ») se touchent plus facilement.

## 2.21 — 8 novembre 2026

- Nouveauté : sur téléphone, ton adresse e-mail reste visible dans le bandeau : un appui ouvre « Mon compte ».

## 2.20 — 8 novembre 2026

- Nouveauté : l'ajout, la modification et la corbeille des fiches se font maintenant directement dans la Bibliothèque (boutons « Ajouter une fiche », crayon et corbeille sur les cartes). L'onglet Administration disparaît et « Configuration » devient « Listes ».

## 2.19 — 8 novembre 2026

- Nouveauté : toutes les données des applis sont maintenant hébergées en Suisse. Reconnecte-toi une fois avec ton e-mail et ton mot de passe habituels.

## 2.18 — 8 novembre 2026

- Nouveauté : les comptes et l'historique des modifications quittent la Configuration d'Index : ils sont maintenant dans le « Tableau de bord » de l'Accueil, avec les statistiques. La Configuration garde les catégories, fournisseurs et chantiers, et un lien vers le Tableau de bord.

## 2.17 — 8 novembre 2026

- Nouveauté : Configuration > Historique garde les 90 derniers jours de tout ce qui est ajouté, modifié ou supprimé dans les données communes des applis (fiches, Access, Format, Strate, Membrane, Masse), avec le nom de la personne. Un bouton « Annuler » remet la ligne comme avant : chacun annule ses propres modifications, les administrateurs annulent aussi celles des autres.
- Base : script `20261108130000_index_historique.sql` à exécuter une fois dans Supabase (les mots de passe d'Access et les notes de Check n'y sont jamais gardés).

## 2.16 — 7 novembre 2026

- Nouveauté : le menu des applis propose maintenant Joint (dilatation et joints) et Membrane (étanchéité).

## 2.15 — 6 novembre 2026

- Le menu des applis propose Joint (en préparation), pour le concepteur seulement : aucune Nouveauté à annoncer à l'équipe.

## 2.14 — 4 novembre 2026

- Nouveauté : les comptes ont maintenant un rôle : dessinateur, administrateur ou concepteur. Dans Configuration > Comptes, le rôle s'affiche pour chaque compte.
- Les adresses email des comptes ne sont plus visibles que par le concepteur ; les administrateurs voient les noms. Seul le concepteur peut nommer ou retirer un administrateur ; les administrateurs continuent de valider les comptes.
- Nouveauté : la mention « À jour · vérifiée le … » sous chaque fiche n'est plus soulignée en pointillés (un clic dessus explique toujours comment elle est calculée).
- Nouveauté : un clic sur ton adresse dans le bandeau ouvre « Mon compte » : tu peux changer ton adresse email de connexion (un lien de confirmation est envoyé). Le compte, le rôle et les droits restent les mêmes.
- Nouveauté : sans compte, le lien « Sauvegarde » du pied de page ne télécharge plus le fichier JSON : un message invite à se connecter.
- Un script SQL est à lancer une fois dans Supabase (`supabase/migrations/20261104170000_index_roles.sql`) : sans lui, l'écran continue de fonctionner comme avant.

## 2.13 — 4 novembre 2026

- Nouveauté : la fenêtre « Fiches à relire du mois » explique clairement le principe : une fiche y entre quand sa dernière vérification date de plus de 12 mois (5 au maximum par mois). Correction du nom de l'appli dans ce texte.

## 2.12 — 4 novembre 2026

- Nouveauté : quand il n'y a plus de fiche à relire, le bouton « Fiches à relire du mois » affiche « À jour » au lieu d'un compteur comme « 2/5 » qui laissait croire qu'il restait du travail. Le texte de la fenêtre l'explique aussi.

## 2.11 — 4 novembre 2026

- Nouveauté : à la création d'un compte, un texte prévient qu'on peut inventer une adresse email, mais qu'en cas de mot de passe perdu le compte sera perdu (le lien « Mot de passe oublié » part vers cette adresse).

## 2.10 — 3 novembre 2026

- Nouveauté : un crayon « Modifier » dans le lecteur PDF permet de corriger la fiche tout en gardant le PDF sous les yeux.
- La fenêtre de modification s'ouvre par-dessus le PDF ; à l'enregistrement, le titre du lecteur se met à jour. Mêmes conditions que le crayon des cartes (compte validé, en ligne).

## 2.9 — 3 novembre 2026

- Nouveauté : un petit crayon sur chaque fiche permet de la modifier directement depuis la bibliothèque, sans passer par Administration.
- Le crayon ouvre la même fenêtre « Modifier la fiche » par-dessus la bibliothèque : la recherche, le tri et la position dans la liste ne bougent pas, et la carte se met à jour à l'enregistrement.
- Visible seulement pour les comptes validés (mêmes droits qu'Administration) et pas en mode hors connexion.

## 2.8 — 3 novembre 2026

- Nouveauté : le nom du fournisseur sur une fiche devient un lien vers sa fiche dans Access (site, contact, notes) quand le fournisseur y figure ; Access s'ouvre directement sur lui.
- La correspondance compare les noms sans accents ni majuscules (« WÜRTH » = « Würth », « Schüco International KG » = « Schüco ») ; en cas de doute entre deux fournisseurs, aucun lien plutôt qu'un mauvais.
- La liste des fournisseurs d'Access est gardée en copie locale : le lien reste disponible hors connexion.

## 2.7 — 2 novembre 2026

- Nouveauté : on peut trier les fiches (« Vérifiées il y a le plus longtemps », « le plus récemment », par nom), un bandeau rappelle les fiches à relire du mois, et le lecteur PDF passe d'une fiche à l'autre avec les flèches.
- Tri : liste « Trier » au-dessus des fiches ; l'ordre « Dernières modifiées » reste le choix par défaut.
- Rappel : tant que les 5 fiches du mois ne sont pas relues, un bandeau propose « Relire maintenant » ou « Plus tard » (masqué jusqu'au mois suivant).
- Lecteur PDF : boutons « fiche précédente / suivante » et flèches du clavier parmi les fiches affichées, lien « Nouvel onglet » (utile sur téléphone pour voir toutes les pages et zoomer).

## 2.6 — 1er novembre 2026

- Nouveauté : sur téléphone, la fenêtre « Fiches à relire du mois » et la page Administration ne débordent plus quand un nom de fiche est très long.
- Le check-up automatique mesure maintenant les fenêtres (aperçu, comparaison, relecture, suppression) avec des noms très longs.

## 2.5 — 1er novembre 2026

- Nouveauté : sur téléphone, la bibliothèque s'affiche sans déborder, et on peut copier le lien d'une fiche en un clic.
- Chaque fiche a un bouton « Copier le lien » ; un clic sur « À jour · vérifiée le… » explique comment la mention est calculée.
- Boutons et filtres plus grands sur téléphone (40 à 44 px), bandeau resserré.
- Un lien « Aller à la recherche » apparaît au premier appui sur Tab.
- Les noms de fiches sont des titres de niveau 2 (ordre des titres corrigé).
- La fenêtre de comparaison et le lecteur de PDF ne se chargent qu'à leur première ouverture (démarrage plus léger).

## 2.4 — 1er novembre 2026

- Nouveauté : le mode clair ou sombre que tu choisis dans une appli est repris dans toutes les autres.
- Le réglage clair / sombre est aussi enregistré dans une clé commune à toutes les applis (`outils-theme`, même site) ; la clé propre à l'appli est conservée.

## 2.3 — 31 octobre 2026

- Toutes les applis sont maintenant sur GitHub Pages : le sélecteur d'applis pointe vers `https://outils-hn.github.io/<Appli>/` à la place des adresses Lovable.

## 2.2 — 31 octobre 2026

- Publication sur GitHub Pages (`https://outils-hn.github.io/Index/`) : l'appli est construite en mode SPA statique, sans serveur.
- Nouveau workflow « Pages » : construction avec le sous-dossier `/Index/`, page de repli `404.html`, déploiement automatique à chaque fusion sur `main`.
- Pages « Page introuvable » et « Cette page ne s'est pas chargée » en français.
- Connexion : les liens reçus par e-mail (inscription, nouveau mot de passe) tiennent compte du sous-dossier de publication. Ajouter `https://outils-hn.github.io/Index/**` aux « Redirect URLs » de Supabase (Authentication → URL Configuration).

## 2.1 — 31 octobre 2026

- Adresses mises à jour après le renommage du compte GitHub en `outils-hn` : « Suggestion / bug » ouvre l'Accueil sur `https://outils-hn.github.io/`, et le sélecteur d'applis pointe vers Strate (`https://outils-hn.github.io/Strate/`) et Trame (`https://outils-hn.github.io/Trame/`), publiées sur GitHub Pages.
