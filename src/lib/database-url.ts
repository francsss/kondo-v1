/**
 * Prisma 5 rejects libpq's channel_binding query parameter even though Neon
 * accepts it. TLS remains required through sslmode=require; removing only this
 * unsupported hint prevents schema-engine and runtime connection failures.
 */
export function prismaCompatibleDatabaseUrl(value: string | undefined) {
  if (!value) return value;
  const questionMark = value.indexOf("?");
  if (questionMark < 0) return value;
  const hashMark = value.indexOf("#", questionMark);
  const base = value.slice(0, questionMark);
  const query = value.slice(
    questionMark + 1,
    hashMark < 0 ? value.length : hashMark,
  );
  const hash = hashMark < 0 ? "" : value.slice(hashMark);
  const parameters = query
    .split("&")
    .filter((parameter) => {
      const [rawKey] = parameter.split("=", 1);
      try {
        return decodeURIComponent(rawKey).toLowerCase() !== "channel_binding";
      } catch {
        return rawKey.toLowerCase() !== "channel_binding";
      }
    })
    .join("&");
  return `${base}${parameters ? `?${parameters}` : ""}${hash}`;
}

export function normalizePrismaEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
) {
  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const normalized = prismaCompatibleDatabaseUrl(environment[key]);
    if (normalized) environment[key] = normalized;
  }
  return environment;
}
