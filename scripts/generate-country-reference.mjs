import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const REGIONS = {
  Africa:
    "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW",
  Americas:
    "AI AG AR AW BS BB BZ BM BO BQ BR CA KY CL CO CR CU CW DM DO EC SV FK GF GL GD GP GT GY HT HN JM MQ MX MS NI PA PY PE PR BL KN LC MF PM VC SX SR TT TC US UY VE VG VI",
  Asia: "AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE",
  Europe:
    "AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB VA",
  Oceania:
    "AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV UM VU WF",
};

/**
 * CLDR is the source of truth, but a few of its labels read as data rather
 * than as something a student would pick out of a list. These keep the ISO
 * code and only rename the label.
 */
const NAME_OVERRIDES = {
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
  CV: "Cabo Verde",
  HK: "Hong Kong",
  MO: "Macao",
  PS: "Palestine",
  SH: "St. Helena",
  TL: "Timor-Leste",
};

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

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

function flagEmoji(code) {
  return String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

const rows = [];
const seen = new Set();
for (const [region, codes] of Object.entries(REGIONS)) {
  for (const code of codes.split(" ")) {
    if (seen.has(code)) throw new Error(`Duplicate code ${code}`);
    seen.add(code);
    const name =
      NAME_OVERRIDES[code] ?? displayNames.of(code)?.replaceAll(" & ", " and ");
    if (!name || name === code) throw new Error(`No display name for ${code}`);
    rows.push({ code, name, emoji: flagEmoji(code), region });
  }
}

rows.sort((a, b) => a.name.localeCompare(b.name, "en"));

const body = rows
  .map(
    (row) =>
      `  { code: "${row.code}", name: "${row.name}", emoji: "${row.emoji}", region: "${row.region}" },`,
  )
  .join("\n");

const outputPath =
  process.argv[2] ??
  fileURLToPath(new URL("../src/lib/countries.ts", import.meta.url));

const source = `/**
 * Every ISO 3166-1 country and territory Kondo accepts, sorted by English
 * name. Kondo is a digital ecosystem for international students in China, so
 * the country dimension has to cover the whole world: a student from Pakistan,
 * Kazakhstan, France or Cameroon all reach Kondo through the same selector.
 *
 * Names come from the CLDR English region names, flags from the ISO code
 * itself. Regenerate with \`npm run reference:countries\`.
 */
export type CountryRegion =
  | "Africa"
  | "Americas"
  | "Asia"
  | "Europe"
  | "Oceania";

export type CountryReference = {
  code: string;
  name: string;
  emoji: string;
  region: CountryRegion;
};

export const COUNTRIES: readonly CountryReference[] = [
${body}
];

export const COUNTRY_CODES: readonly string[] = COUNTRIES.map(
  (country) => country.code,
);

const byCode = new Map(COUNTRIES.map((country) => [country.code, country]));

export function getCountry(code: string | null | undefined) {
  if (!code) return null;
  return byCode.get(code.trim().toUpperCase()) ?? null;
}

export function isCountryCode(code: string | null | undefined) {
  return getCountry(code) !== null;
}

/**
 * Region stays available as a grouping dimension — African student
 * communities remain a real part of Kondo, they are simply no longer the
 * definition of who Kondo is for.
 */
export function countriesInRegion(region: CountryRegion) {
  return COUNTRIES.filter((country) => country.region === region);
}

/** Options shaped for \`SearchableSelect\`, searchable by name and by code. */
export function countrySelectOptions() {
  return COUNTRIES.map((country) => ({
    id: country.code,
    name: \`\${country.emoji} \${country.name}\`,
    secondary: country.region,
  }));
}
`;

writeFileSync(outputPath, await formatTypeScript(source, outputPath));

console.log(`Wrote ${rows.length} countries`);
