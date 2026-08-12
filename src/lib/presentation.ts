export function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? "K"}${lastName[0] ?? ""}`.toUpperCase();
}

export function formatRelativeDate(value: Date) {
  const seconds = Math.round((value.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];

  for (const [unit, secondsInUnit] of ranges) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }

  return "just now";
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function formatPrice(priceFen: number) {
  return new Intl.NumberFormat("en-CN", {
    style: "currency",
    currency: "CNY",
    // "¥75", not "CN¥75". The disambiguating form is for documents that mix
    // yuan and yen; a price tag in a Chinese marketplace is not one, and the
    // extra two characters blunt the one number the card exists to show.
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: priceFen % 100 === 0 ? 0 : 2,
  }).format(priceFen / 100);
}

export const avatarGradients = [
  "from-amber-200 to-orange-400 text-amber-950",
  "from-emerald-200 to-teal-500 text-emerald-950",
  "from-violet-200 to-fuchsia-400 text-violet-950",
  "from-sky-200 to-blue-500 text-blue-950",
  "from-rose-200 to-pink-400 text-rose-950",
];

export function stableGradient(value: string) {
  const index = [...value].reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  return avatarGradients[index % avatarGradients.length];
}

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function defaultAvatarDataUri(
  firstName: string,
  lastName: string,
  seed?: string,
) {
  const label = initials(firstName, lastName);
  const hash = stableHash(seed || `${firstName}:${lastName}`);
  const hue = hash % 360;
  const secondaryHue = (hue + 34 + ((hash >>> 9) % 78)) % 360;
  const circleX = 18 + ((hash >>> 5) % 28);
  const circleY = 18 + ((hash >>> 11) % 28);
  const rotation = (hash >>> 17) % 180;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue} 72% 72%)"/>
        <stop offset="1" stop-color="hsl(${secondaryHue} 68% 42%)"/>
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="48" fill="url(#g)"/>
    <circle cx="${circleX}" cy="${circleY}" r="28" fill="white" fill-opacity=".16"/>
    <path d="M-10 76 L76 -10 L108 22 L22 108 Z" fill="white" fill-opacity=".11" transform="rotate(${rotation} 48 48)"/>
    <text x="48" y="55" text-anchor="middle" dominant-baseline="middle" fill="hsl(${hue} 50% 14%)" font-family="Arial, sans-serif" font-size="31" font-weight="800">${escapeSvgText(label)}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
