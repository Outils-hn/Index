/** Logo : pastille de la couleur de l'appli, avec son pictogramme (meme logo que sur l'Accueil). */
export function IndexMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} className="shrink-0" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5.5" fill="#6D4AFF"/><g transform="translate(4.56 4.56) scale(.62)" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></g></svg>
  );
}
