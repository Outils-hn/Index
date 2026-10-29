/** Logo : une fiche avec son onglet de classement violet. */
export function IndexMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
      <rect x="3" y="2.5" width="7" height="3.5" fill="var(--color-index)" />
      <rect x="3.75" y="6.25" width="14.5" height="12.5" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground" />
      <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.2" className="text-foreground" />
      <line x1="7" y1="14.5" x2="12.5" y2="14.5" stroke="currentColor" strokeWidth="1.2" className="text-foreground" />
    </svg>
  );
}
