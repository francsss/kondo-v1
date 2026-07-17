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
