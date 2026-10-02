// Cargo's look on a tldraw canvas: the near-black neutrals, the emerald accent
// and the amber secondary from cargo's website, set in Inter and Source Code Pro.
// The canvas stores colour *names* (green, yellow, grey), so a .tldr exported
// from here opens on tldraw.com in tldraw's own palette, in the same roles.
import "@fontsource/inter/400.css";
import "@fontsource/inter/400-italic.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/600.css";
import { DEFAULT_THEME, type TLDefaultColor, type TLTheme } from "tldraw";

const dark = DEFAULT_THEME.colors.dark;

function tone(
  base: TLDefaultColor,
  solid: string,
  semi: string,
  frame: { stroke: string; heading: string; fill: string; text: string },
): TLDefaultColor {
  return {
    ...base,
    solid,
    fill: solid,
    linedFill: solid,
    semi,
    frameHeadingStroke: frame.stroke,
    frameHeadingFill: frame.heading,
    frameStroke: frame.stroke,
    frameFill: frame.fill,
    frameText: frame.text,
  };
}

export const cargoTheme: TLTheme = {
  ...DEFAULT_THEME,
  fonts: {
    ...DEFAULT_THEME.fonts,
    sans: { fontFamily: "'Inter', sans-serif" },
    mono: { fontFamily: "'Source Code Pro', monospace" },
  },
  colors: {
    ...DEFAULT_THEME.colors,
    dark: {
      ...dark,
      background: "#0A0A0A",
      negativeSpace: "#0A0A0A",
      text: "#FAFAFA",
      // emerald-400 on emerald-950: what's on main
      green: tone(dark.green, "#34D399", "#06261C", {
        stroke: "#065F46",
        heading: "#052E22",
        fill: "#0B1411",
        text: "#D1FAE5",
      }),
      // amber-400 on a warm near-black: what's still in review
      yellow: tone(dark.yellow, "#FBBF24", "#261C06", {
        stroke: "#92400E",
        heading: "#2A1C05",
        fill: "#14110A",
        text: "#FEF3C7",
      }),
      // neutral-500 / neutral-850: structure and secondary text
      grey: tone(dark.grey, "#8A8A8A", "#1C1C1C", {
        stroke: "#2E2E2E",
        heading: "#171717",
        fill: "#111111",
        text: "#E5E5E5",
      }),
    },
  },
};

export const BRAND_FONTS = [
  "400 16px Inter",
  "600 16px Inter",
  "700 16px Inter",
  "400 16px 'Source Code Pro'",
  "600 16px 'Source Code Pro'",
];
