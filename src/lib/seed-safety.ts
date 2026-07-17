type SeedEnvironment = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  KONDO_ALLOW_DESTRUCTIVE_SEED?: string;
};

function isProductionValue(value: string | undefined) {
  return value?.trim().toLowerCase() === "production";
}

export function assertDestructiveSeedAllowed(
  environment: SeedEnvironment = process.env,
) {
  if (
    isProductionValue(environment.NODE_ENV) ||
    isProductionValue(environment.VERCEL_ENV)
  ) {
    throw new Error(
      "Destructive seed blocked: production environments can never be seeded.",
    );
  }

  if (environment.KONDO_ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error(
      "Destructive seed blocked: set KONDO_ALLOW_DESTRUCTIVE_SEED=true only for an intentional local/demo reset.",
    );
  }
}
