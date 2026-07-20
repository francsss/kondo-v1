type OperationalContext = Record<
  string,
  boolean | number | string | null | undefined
>;

function redactSensitiveErrorText(value: string | undefined) {
  if (!value) return undefined;

  return value
    .replace(
      /((?:"|')?(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|session(?:id)?|database_url)(?:"|')?\s*(?:=|:)\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
    .replace(
      /\b([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s/]+@/gi,
      "$1[REDACTED]@",
    );
}

function errorDescriptor(error: unknown) {
  if (!(error instanceof Error)) {
    return { errorType: "UnknownError" };
  }

  const codedError = error as Error & { code?: unknown; digest?: unknown };
  return {
    errorType: error.name || "Error",
    errorCode:
      typeof codedError.code === "string" ? codedError.code : undefined,
    errorDigest:
      typeof codedError.digest === "string" ? codedError.digest : undefined,
  };
}

export function logServerError(
  event: string,
  error: unknown,
  context: OperationalContext = {},
) {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      ...errorDescriptor(error),
      errorMessage: redactSensitiveErrorText(
        error instanceof Error ? error.message : String(error),
      ),
      errorStack: redactSensitiveErrorText(
        error instanceof Error ? error.stack : undefined,
      ),
      ...context,
      timestamp: new Date().toISOString(),
    }),
  );
}
