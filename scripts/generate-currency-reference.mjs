import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

/**
 * Regenerates `src/lib/currencies.ts` from ICU's active ISO 4217 list.
 *
 * Entries already in the file are preserved byte for byte: their symbols are
 * hand-picked (FCFA, GH₵, KSh) and read better than ICU's fallbacks. Only the
 * currencies missing from the file are added, which is what makes this safe to
 * re-run.
 */

const outputPath =
  process.argv[2] ??
  fileURLToPath(new URL("../src/lib/currencies.ts", import.meta.url));

// Codes ICU lists that no one is paid in: IMF special drawing rights and the
// ALBA unit of account. A student pricing a bicycle never wants either.
const NOT_CIRCULATING = new Set(["XDR", "XSU"]);

// The currencies a student in China actually reaches for first. Everything
// else follows alphabetically.
const PINNED = ["CNY", "USD", "EUR", "GBP"];

/**
 * ICU falls back to the three-letter code when a currency has no symbol in its
 * English locale data, which is how "PKR 400" happens. These are the everyday
 * written symbols, applied last so the file is the same on every run.
 */
const SYMBOL_OVERRIDES = {
  BDT: "৳",
  CZK: "Kč",
  DKK: "kr",
  HUF: "Ft",
  IDR: "Rp",
  KHR: "៛",
  KZT: "₸",
  LAK: "₭",
  LKR: "Rs",
  MNT: "₮",
  MYR: "RM",
  NOK: "kr",
  NPR: "रू",
  PKR: "₨",
  PLN: "zł",
  RUB: "₽",
  SEK: "kr",
  THB: "฿",
  TWD: "NT$",
  UAH: "₴",
};

const existing = new Map();
for (const [, code, name, symbol] of readFileSync(outputPath, "utf8").matchAll(
  /\{ code: "([A-Z]{3})", name: "([^"]+)", symbol: "([^"]+)" \}/g,
)) {
  existing.set(code, { code, name, symbol });
}
if (existing.size === 0) throw new Error("Parsed no currencies to preserve");

const displayNames = new Intl.DisplayNames(["en"], { type: "currency" });

/**
 * The generated file is committed, so it has to match what `format:check`
 * expects — otherwise regenerating it fails CI on whitespace alone.
 */
async function formatTypeScript(source, filepath) {
  return prettier.format(source, {
    ...(await prettier.resolveConfig(filepath)),
    filepath,
  });
}

function icuSymbol(code) {
  const parts = new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
  }).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? code;
}

const rows = new Map(existing);
for (const code of Intl.supportedValuesOf("currency")) {
  if (NOT_CIRCULATING.has(code) || rows.has(code)) continue;
  const name = displayNames.of(code);
  if (!name || name === code) continue;
  rows.set(code, { code, name, symbol: icuSymbol(code) });
}

for (const [code, symbol] of Object.entries(SYMBOL_OVERRIDES)) {
  const row = rows.get(code);
  if (row) row.symbol = symbol;
}

const pinned = PINNED.map((code) => {
  const row = rows.get(code);
  if (!row) throw new Error(`Pinned currency ${code} is missing`);
  return row;
});
const rest = [...rows.values()]
  .filter((row) => !PINNED.includes(row.code))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const body = [...pinned, ...rest]
  .map(
    (row) =>
      `  { code: "${row.code}", name: "${row.name}", symbol: "${row.symbol}" },`,
  )
  .join("\n");

const source = `export type SupportedCurrency = {
  code: string;
  name: string;
  symbol: string;
};

/**
 * Every circulating ISO 4217 currency.
 *
 * Kondo prices most things in CNY, but the people using it come from
 * everywhere, and a currency picker is one of the places a product quietly
 * tells you who it was built for. The four a student in China reaches for
 * first lead the list; the rest follow alphabetically.
 *
 * Regenerate with \`npm run reference:currencies\`.
 */
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
${body}
];

export const SUPPORTED_CURRENCY_CODES = new Set(
  SUPPORTED_CURRENCIES.map((currency) => currency.code),
);
`;

writeFileSync(outputPath, await formatTypeScript(source, outputPath));

console.log(
  `Wrote ${rows.size} currencies (${rows.size - existing.size} added, ${existing.size} preserved)`,
);
