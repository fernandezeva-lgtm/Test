// Variables de estilo estándar de MCP Apps que el host comparte con los widgets.
// Valores de Finora DS (src/design/tokens.css): azules corporativos + negros.
import type { McpUiHostStyles, McpUiStyles } from "@modelcontextprotocol/ext-apps";

const common = {
  "--font-sans": `"Figtree", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  "--font-mono": `ui-monospace, SFMono-Regular, Menlo, monospace`,
  "--border-radius-xs": "4px",
  "--border-radius-sm": "8px",
  "--border-radius-md": "14px",
  "--border-radius-lg": "18px",
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
  "--color-background-secondary": "#f2f2f2",
  "--color-background-tertiary": "#e9ebed",
  "--color-background-inverse": "#1b2129",
  "--color-background-info": "#d6ebfb",
  "--color-background-danger": "#fbe7e7",
  "--color-background-success": "#e3f1e4",
  "--color-background-warning": "#fdf0d2",
  "--color-text-primary": "#1b2129",
  "--color-text-secondary": "#5f6670",
  "--color-text-tertiary": "#7b828b",
  "--color-text-inverse": "#ffffff",
  "--color-text-info": "#1f5c8a",
  "--color-text-danger": "#c62828",
  "--color-text-success": "#2e7d32",
  "--color-text-warning": "#9a6400",
  "--color-border-primary": "#dfe2e5",
  "--color-border-secondary": "#e9ebed",
  "--color-ring-primary": "#3d9be0",
};

const dark = {
  "--color-background-primary": "#1a1f25",
  "--color-background-secondary": "#14181d",
  "--color-background-tertiary": "#242a31",
  "--color-background-inverse": "#eef1f4",
  "--color-background-info": "#1a3346",
  "--color-background-danger": "#3a1b1b",
  "--color-background-success": "#1a3220",
  "--color-background-warning": "#3a2e12",
  "--color-text-primary": "#eef1f4",
  "--color-text-secondary": "#b3bac2",
  "--color-text-tertiary": "#8a929b",
  "--color-text-inverse": "#1b2129",
  "--color-text-info": "#8cc6f2",
  "--color-text-danger": "#ff7a7a",
  "--color-text-success": "#6cc070",
  "--color-text-warning": "#f0bb4a",
  "--color-border-primary": "#2c333b",
  "--color-border-secondary": "#242a31",
  "--color-ring-primary": "#6db6ec",
};

export function hostStyles(theme: "light" | "dark"): McpUiHostStyles {
  return {
    variables: { ...common, ...(theme === "dark" ? dark : light) } as McpUiStyles,
    // Tipografía del DS: el widget la inyecta (su CSP la permite vía _meta.ui.csp).
    css: { fonts: `@import url("https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap");` },
  };
}
