# Index

Crée une application web de gestion de fiches techniques pour un bureau d'études spécialisé en façade architecturale. L'application utilise Supabase pour la base de données et le stockage des fichiers (Fichiers PDF inférieurs à 5 Mo).

Interface principale (Vue Projeteur) :

Une barre de recherche globale "Smart" très rapide qui cherche par nom de produit, fournisseur ou tags.

Des filtres rapides sous forme de boutons pour les catégories principales : 'Colles & Mastics', 'Fixations & Chevilles', 'Membranes & Étanchéité', 'Profilés & Accessoires', 'Isolants'.

Les résultats s'affichent sous forme de cartes épurées. Chaque carte montre : le nom du produit (en gras), le fournisseur, les tags (petits badges colorés), la date de mise à jour, et un bouton principal "Ouvrir la fiche technique" qui ouvre le PDF dans un nouvel onglet.

Interface d'administration (Ajout/Modification) :

Un bouton pour ajouter un produit via un formulaire simple : Nom, Fournisseur (menu déroulant), Catégorie (menu déroulant), Mots-clés/Tags (séparés par des virgules).

Une zone de glisser-déposer (Drag & Drop) pour charger le fichier PDF du produit. Le fichier est stocké directement dans le bucket de stockage Supabase.

Donne à l'application un design moderne, pro et technique (tons gris foncé, blanc, avec des accents bleus ou orange légers, style ingénierie/bureau d'études).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://index-hn.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3678acde-4b5f-4c7d-b5a2-8ddd3dfdf9d0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
