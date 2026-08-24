import { spawnSync } from "node:child_process";

function prismaCompatibleDatabaseUrl(value) {
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

const buildEnvironment = { ...process.env };
for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  buildEnvironment[key] = prismaCompatibleDatabaseUrl(buildEnvironment[key]);
}

function run(command, args, attempts = 1) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(command, args, {
      env: buildEnvironment,
      stdio: "inherit",
      shell: false,
    });
    if (result.error) throw result.error;
    if (result.status === 0) return;
    if (attempt === attempts) process.exit(result.status ?? 1);
    console.warn(
      `[build] ${args.join(" ")} failed on attempt ${attempt}; retrying the transient provider connection.`,
    );
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
  }
}

function runSoft(command, args) {
  const result = spawnSync(command, args, {
    env: buildEnvironment,
    stdio: "inherit",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    console.warn(
      `[build] ${args.join(" ")} did not complete; continuing the build.`,
    );
  }
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const rollbackMigration =
  buildEnvironment.PRISMA_ROLLBACK_FAILED_MIGRATION?.trim();

if (rollbackMigration) {
  if (!/^\d{14}_[a-z0-9_]+$/.test(rollbackMigration)) {
    throw new Error(
      "PRISMA_ROLLBACK_FAILED_MIGRATION must be a valid Prisma migration name.",
    );
  }
  console.warn(
    `[build] Marking failed migration ${rollbackMigration} as rolled back before deployment.`,
  );
  run(npx, [
    "prisma",
    "migrate",
    "resolve",
    "--rolled-back",
    rollbackMigration,
  ]);
}

run(npx, ["prisma", "migrate", "deploy"], 3);
run(npx, ["prisma", "generate"]);

/*
 * A deployed Kondo needs a book its reader can open.
 *
 * Seeding never runs in production and the importer is a command line, so
 * without this the EPUB reader ships with nothing to show and no way to fix
 * that from the deployed app. The script upserts one title on a fixed slug and
 * leaves it alone once it exists, so deploys converge rather than accumulate.
 *
 * `runSoft` rather than `run`: a missing storage configuration is a reason to
 * ship without the sample book, never a reason to fail the deploy.
 */
runSoft(npx, ["tsx", "scripts/ensure-pilot-book.ts"]);

run(npx, ["next", "build"]);
