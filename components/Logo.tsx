export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  // Estrella de cuatro puntas con los colores de la marca.
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="12" fill="#007EAE" />
      <path d="M20 7c1.2 6.6 4.4 9.8 11 11-6.6 1.2-9.8 4.4-11 11-1.2-6.6-4.4-9.8-11-11 6.6-1.2 9.8-4.4 11-11Z" fill="#FFC72C" />
      <circle cx="29.5" cy="10.5" r="2.2" fill="#E4002B" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Mis<span className={light ? "text-star" : "text-brand-500"}>Finanzas</span>
      </span>
    </span>
  );
}
