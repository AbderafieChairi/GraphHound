export function getLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyTheme(theme: {
  color_bg: string;
  color_panel: string;
  color_primary: string;
  color_accent: string;
}) {
  if (typeof window === "undefined") return;
  const isBgLight = getLuminance(theme.color_bg) > 0.5;
  const isPanelLight = getLuminance(theme.color_panel) > 0.5;
  const isPrimaryLight = getLuminance(theme.color_primary) > 0.5;
  const isAccentLight = getLuminance(theme.color_accent) > 0.5;

  const style = document.documentElement.style;
  style.setProperty("--background", theme.color_bg);
  style.setProperty("--card", theme.color_panel);
  style.setProperty("--popover", theme.color_panel);
  style.setProperty("--sidebar", theme.color_panel);
  style.setProperty("--primary", theme.color_primary);
  style.setProperty("--accent", theme.color_accent);

  style.setProperty("--foreground", isBgLight ? "oklch(0.19 0.02 260)" : "oklch(0.985 0 0)");
  style.setProperty(
    "--card-foreground",
    isPanelLight ? "oklch(0.19 0.02 260)" : "oklch(0.985 0 0)",
  );
  style.setProperty(
    "--popover-foreground",
    isPanelLight ? "oklch(0.19 0.02 260)" : "oklch(0.985 0 0)",
  );
  style.setProperty(
    "--sidebar-foreground",
    isPanelLight ? "oklch(0.19 0.02 260)" : "oklch(0.985 0 0)",
  );

  style.setProperty(
    "--primary-foreground",
    isPrimaryLight ? "oklch(0.19 0.02 260)" : "oklch(0.985 0 0)",
  );
  style.setProperty(
    "--accent-foreground",
    isAccentLight ? "oklch(0.19 0.02 260)" : "oklch(0.985 0 0)",
  );

  style.setProperty("--border", isBgLight ? "oklch(0.86 0.018 250)" : "oklch(1 0 0 / 10%)");
  style.setProperty("--input", isBgLight ? "oklch(0.9 0.016 250)" : "oklch(1 0 0 / 15%)");
  style.setProperty("--muted", isBgLight ? "oklch(0.94 0.012 250)" : "oklch(0.269 0 0)");
  style.setProperty("--muted-foreground", isBgLight ? "oklch(0.45 0.025 260)" : "oklch(0.708 0 0)");

  document.documentElement.classList.toggle("light", isBgLight);
  document.documentElement.classList.toggle("dark", !isBgLight);
}
