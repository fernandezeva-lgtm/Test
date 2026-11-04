// Variables de estilo estándar de MCP Apps que el host comparte con los widgets.
// Valores de Finora DS (src/design/tokens.css): azules corporativos + negros.
import type { McpUiHostStyles, McpUiStyles } from "@modelcontextprotocol/ext-apps";

const common = {
  "--font-sans": `"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  "--font-mono": `ui-monospace, SFMono-Regular, Menlo, monospace`,
  "--border-radius-xs": "4px",
  "--border-radius-sm": "8px",
  "--border-radius-md": "12px",
  "--border-radius-lg": "16px",
  "--border-radius-xl": "20px",
  "--border-radius-full": "9999px",
  "--border-width-regular": "1px",
  "--font-weight-normal": "400",
  "--font-weight-medium": "500",
  "--font-weight-semibold": "600",
  "--font-weight-bold": "700",
};

const light = {
  "--color-background-primary": "#ffffff",
  "--color-background-secondary": "#f5f7f9",
  "--color-background-tertiary": "#ebeff3",
  "--color-background-inverse": "#050608",
  "--color-background-info": "#e8f5fb",
  "--color-background-danger": "#fdecee",
  "--color-background-success": "#e6f4ee",
  "--color-background-warning": "#fdf3e2",
  "--color-text-primary": "#0b0d10",
  "--color-text-secondary": "#5b6470",
  "--color-text-tertiary": "#87909c",
  "--color-text-inverse": "#ffffff",
  "--color-text-info": "#00668e",
  "--color-text-danger": "#d0021b",
  "--color-text-success": "#00875a",
  "--color-text-warning": "#b86e00",
  "--color-border-primary": "#d8dee5",
  "--color-border-secondary": "#ebeff3",
  "--color-ring-primary": "#0099d8",
};

const dark = {
  "--color-background-primary": "#121519",
  "--color-background-secondary": "#171b20",
  "--color-background-tertiary": "#1e2329",
  "--color-background-inverse": "#eef2f6",
  "--color-background-info": "#0b2a38",
  "--color-background-danger": "#3a1418",
  "--color-background-success": "#0e2e22",
  "--color-background-warning": "#33260e",
  "--color-text-primary": "#eef2f6",
  "--color-text-secondary": "#b4bcc6",
  "--color-text-tertiary": "#87909c",
  "--color-text-inverse": "#050608",
  "--color-text-info": "#5cbbe4",
  "--color-text-danger": "#ff5c6c",
  "--color-text-success": "#3fc18e",
  "--color-text-warning": "#f0a83a",
  "--color-border-primary": "#2b3138",
  "--color-border-secondary": "#1e2329",
  "--color-ring-primary": "#23a6dd",
};

export function hostStyles(theme: "light" | "dark"): McpUiHostStyles {
  return {
    variables: { ...common, ...(theme === "dark" ? dark : light) } as McpUiStyles,
    // Tipografía del DS: el widget la inyecta (su CSP la permite vía _meta.ui.csp).
    css: { fonts: `@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");` },
  };
}
