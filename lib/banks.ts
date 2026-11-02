export type Bank = {
  id: string;
  name: string;
  /** Color de fondo del avatar (aproximado al de cada entidad). */
  color: string;
  initials: string;
};

/** Los 10 principales bancos de España por volumen de activos. */
export const BANKS: Bank[] = [
  { id: "caixabank", name: "CaixaBank", color: "#007EAE", initials: "CB" },
  { id: "santander", name: "Banco Santander", color: "#EC0000", initials: "SAN" },
  { id: "bbva", name: "BBVA", color: "#004481", initials: "BBVA" },
  { id: "sabadell", name: "Banco Sabadell", color: "#006DFF", initials: "BS" },
  { id: "bankinter", name: "Bankinter", color: "#FF7300", initials: "BK" },
  { id: "unicaja", name: "Unicaja", color: "#00A651", initials: "UNI" },
  { id: "abanca", name: "Abanca", color: "#0D2A5B", initials: "AB" },
  { id: "kutxabank", name: "Kutxabank", color: "#E2001A", initials: "KB" },
  { id: "ibercaja", name: "Ibercaja", color: "#0055A4", initials: "IC" },
  { id: "cajamar", name: "Cajamar", color: "#00843D", initials: "CJ" },
];

export function getBank(id: string): Bank | undefined {
  return BANKS.find((b) => b.id === id);
}

/** Intenta asociar el nombre de institución que devuelve Plaid con uno de nuestros bancos. */
export function matchBankByName(name: string | null | undefined): Bank | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase();
  return BANKS.find(
    (b) => n.includes(b.id) || n.includes(b.name.toLowerCase().replace("banco ", "")),
  );
}
