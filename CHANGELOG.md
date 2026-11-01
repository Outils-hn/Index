# Journal des versions — Index

Le numéro de version se met à jour dans `src/lib/version.ts` (pied de page et fenêtre « À propos » le lisent).

Chaque version qui change quelque chose de visible pour l'équipe a une puce « Nouveauté : … », en langage courant : c'est la seule phrase affichée sur la page « Nouveautés » de l'Accueil.

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
