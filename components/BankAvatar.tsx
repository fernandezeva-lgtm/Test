import { getBank } from "@/lib/banks";

export function BankAvatar({ bankId, name, size = "md" }: { bankId: string; name?: string; size?: "sm" | "md" | "lg" }) {
  const bank = getBank(bankId);
  const initials = bank?.initials ?? (name ?? "?").slice(0, 2).toUpperCase();
  const dims = { sm: "h-8 w-8 text-[10px]", md: "h-11 w-11 text-xs", lg: "h-14 w-14 text-sm" }[size];
  return (
    <span
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-2xl font-extrabold tracking-tight text-white shadow-sm`}
      style={{ background: bank?.color ?? "#5b7282" }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
