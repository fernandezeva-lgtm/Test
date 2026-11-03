// Variables de estilo estándar de MCP Apps que el host comparte con los widgets.
import type { McpUiHostStyles, McpUiStyles } from "@modelcontextprotocol/ext-apps";

const common = {
  "--font-sans": `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
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
  "--color-background-secondary": "#f7f7f8",
  "--color-background-tertiary": "#ececf1",
  "--color-background-inverse": "#0d0d0d",
  "--color-background-info": "#eff6ff",
  "--color-background-danger": "#fef2f2",
  "--color-background-success": "#ecfdf5",
  "--color-background-warning": "#fffbeb",
  "--color-text-primary": "#0d0d0d",
  "--color-text-secondary": "#5d5d66",
  "--color-text-tertiary": "#8e8ea0",
  "--color-text-inverse": "#ffffff",
  "--color-text-info": "#2563eb",
  "--color-text-danger": "#dc2626",
  "--color-text-success": "#059669",
  "--color-text-warning": "#b45309",
  "--color-border-primary": "#e5e5e9",
  "--color-border-secondary": "#efeff2",
};

const dark = {
  "--color-background-primary": "#212121",
  "--color-background-secondary": "#2a2a2a",
  "--color-background-tertiary": "#363636",
  "--color-background-inverse": "#ececec",
  "--color-background-info": "#172a45",
  "--color-background-danger": "#3b1d1d",
  "--color-background-success": "#10332a",
  "--color-background-warning": "#3a2e12",
  "--color-text-primary": "#ececec",
  "--color-text-secondary": "#b4b4b4",
  "--color-text-tertiary": "#8a8a8a",
  "--color-text-inverse": "#0d0d0d",
  "--color-text-info": "#60a5fa",
  "--color-text-danger": "#f87171",
  "--color-text-success": "#34d399",
  "--color-text-warning": "#fbbf24",
  "--color-border-primary": "#3d3d3d",
  "--color-border-secondary": "#2f2f2f",
};

export function hostStyles(theme: "light" | "dark"): McpUiHostStyles {
  return { variables: { ...common, ...(theme === "dark" ? dark : light) } as McpUiStyles };
}
