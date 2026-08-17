/**
 * Reader themes, in one place.
 *
 * Two sets of styles are needed for each theme and they cannot share a
 * mechanism: the shell around the book is Kondo's own DOM and uses Tailwind,
 * while the book itself renders inside an iframe that Tailwind does not reach,
 * so epub.js is handed plain CSS instead.
 *
 * Sepia is here because reading a long text on a bright white panel at night
 * is the complaint every reading app eventually receives.
 */

export type ReaderTheme = "light" | "sepia" | "dark";

export const READER_THEMES: Record<ReaderTheme, { shell: string }> = {
  light: { shell: "bg-white text-kondo-ink" },
  sepia: { shell: "bg-[#f6efe0] text-[#3b3226]" },
  dark: { shell: "bg-[#12100f] text-[#e8e3da]" },
};

const PALETTE: Record<ReaderTheme, { background: string; text: string }> = {
  light: { background: "#ffffff", text: "#14201b" },
  sepia: { background: "#f6efe0", text: "#3b3226" },
  dark: { background: "#12100f", text: "#e8e3da" },
};

/**
 * CSS injected into the book's iframe.
 *
 * `line-height` and the measure are set here rather than left to the
 * publisher's stylesheet, because EPUB typography varies wildly between files
 * and a textbook should not read differently from a novel in the same app.
 */
export function readerThemeStyles(theme: ReaderTheme) {
  const { background, text } = PALETTE[theme];
  return {
    body: {
      background,
      color: text,
      "line-height": "1.65",
      "padding-left": "1.25rem",
      "padding-right": "1.25rem",
    },
    "p, li": { color: text, "line-height": "1.65" },
    "h1, h2, h3, h4, h5, h6": { color: text },
    // Links stay visible in every theme without inheriting a colour that
    // disappears against a dark background.
    a: { color: theme === "dark" ? "#8fe3b8" : "#136b4f" },
    img: { "max-width": "100%", height: "auto" },
  };
}
