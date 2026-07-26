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

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
run(npx, ["prisma", "migrate", "deploy"], 3);
run(npx, ["prisma", "generate"]);
run(npx, ["next", "build"]);
