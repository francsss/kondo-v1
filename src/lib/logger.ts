type OperationalContext = Record<
  string,
  boolean | number | string | null | undefined
>;

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
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...context,
      timestamp: new Date().toISOString(),
    }),
  );
}
