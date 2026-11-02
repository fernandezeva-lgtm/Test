"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles } from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/asistente", label: "Asistente IA", icon: Sparkles },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              active ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30" : "text-muted hover:bg-brand-50 hover:text-brand-600"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
