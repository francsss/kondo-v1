export const AFRICAN_COUNTRIES = [
  { code: "DZ", name: "Algeria", emoji: "🇩🇿" },
  { code: "AO", name: "Angola", emoji: "🇦🇴" },
  { code: "BJ", name: "Benin", emoji: "🇧🇯" },
  { code: "BW", name: "Botswana", emoji: "🇧🇼" },
  { code: "BF", name: "Burkina Faso", emoji: "🇧🇫" },
  { code: "BI", name: "Burundi", emoji: "🇧🇮" },
  { code: "CV", name: "Cabo Verde", emoji: "🇨🇻" },
  { code: "CM", name: "Cameroon", emoji: "🇨🇲" },
  { code: "CF", name: "Central African Republic", emoji: "🇨🇫" },
  { code: "TD", name: "Chad", emoji: "🇹🇩" },
  { code: "KM", name: "Comoros", emoji: "🇰🇲" },
  { code: "CG", name: "Congo", emoji: "🇨🇬" },
  { code: "CD", name: "Democratic Republic of the Congo", emoji: "🇨🇩" },
  { code: "CI", name: "Côte d’Ivoire", emoji: "🇨🇮" },
  { code: "DJ", name: "Djibouti", emoji: "🇩🇯" },
  { code: "EG", name: "Egypt", emoji: "🇪🇬" },
  { code: "GQ", name: "Equatorial Guinea", emoji: "🇬🇶" },
  { code: "ER", name: "Eritrea", emoji: "🇪🇷" },
  { code: "SZ", name: "Eswatini", emoji: "🇸🇿" },
  { code: "ET", name: "Ethiopia", emoji: "🇪🇹" },
  { code: "GA", name: "Gabon", emoji: "🇬🇦" },
  { code: "GM", name: "Gambia", emoji: "🇬🇲" },
  { code: "GH", name: "Ghana", emoji: "🇬🇭" },
  { code: "GN", name: "Guinea", emoji: "🇬🇳" },
  { code: "GW", name: "Guinea-Bissau", emoji: "🇬🇼" },
  { code: "KE", name: "Kenya", emoji: "🇰🇪" },
  { code: "LS", name: "Lesotho", emoji: "🇱🇸" },
  { code: "LR", name: "Liberia", emoji: "🇱🇷" },
  { code: "LY", name: "Libya", emoji: "🇱🇾" },
  { code: "MG", name: "Madagascar", emoji: "🇲🇬" },
  { code: "MW", name: "Malawi", emoji: "🇲🇼" },
  { code: "ML", name: "Mali", emoji: "🇲🇱" },
  { code: "MR", name: "Mauritania", emoji: "🇲🇷" },
  { code: "MU", name: "Mauritius", emoji: "🇲🇺" },
  { code: "MA", name: "Morocco", emoji: "🇲🇦" },
  { code: "MZ", name: "Mozambique", emoji: "🇲🇿" },
  { code: "NA", name: "Namibia", emoji: "🇳🇦" },
  { code: "NE", name: "Niger", emoji: "🇳🇪" },
  { code: "NG", name: "Nigeria", emoji: "🇳🇬" },
  { code: "RW", name: "Rwanda", emoji: "🇷🇼" },
  { code: "ST", name: "São Tomé and Príncipe", emoji: "🇸🇹" },
  { code: "SN", name: "Senegal", emoji: "🇸🇳" },
  { code: "SC", name: "Seychelles", emoji: "🇸🇨" },
  { code: "SL", name: "Sierra Leone", emoji: "🇸🇱" },
  { code: "SO", name: "Somalia", emoji: "🇸🇴" },
  { code: "ZA", name: "South Africa", emoji: "🇿🇦" },
  { code: "SS", name: "South Sudan", emoji: "🇸🇸" },
  { code: "SD", name: "Sudan", emoji: "🇸🇩" },
  { code: "TZ", name: "Tanzania", emoji: "🇹🇿" },
  { code: "TG", name: "Togo", emoji: "🇹🇬" },
  { code: "TN", name: "Tunisia", emoji: "🇹🇳" },
  { code: "UG", name: "Uganda", emoji: "🇺🇬" },
  { code: "ZM", name: "Zambia", emoji: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", emoji: "🇿🇼" },
] as const;

export type AfricanCountryCode = (typeof AFRICAN_COUNTRIES)[number]["code"];

export const AFRICAN_COUNTRY_CODES = AFRICAN_COUNTRIES.map(
  (country) => country.code,
);

const byCode = new Map(
  AFRICAN_COUNTRIES.map((country) => [country.code, country]),
);

export function getAfricanCountry(code: string) {
  return byCode.get(code.toUpperCase() as AfricanCountryCode) ?? null;
}

export function isAfricanCountryCode(code: string) {
  return getAfricanCountry(code) !== null;
}
