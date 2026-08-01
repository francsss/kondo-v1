import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const appRoot = join(root, "app");

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function routeFromFile(file) {
  const directory = relative(appRoot, file)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !/^\(.+\)$/.test(segment));
  const route = `/${directory.join("/")}`.replace(/\/$/, "") || "/";
  return route;
}

function pageAccess(file, source) {
  const normalized = relative(root, file).split(sep).join("/");
  if (normalized.startsWith("app/admin/")) return "ADMIN_PERMISSION";
  if (normalized.includes("/(workspace)/")) return "ORGANIZATION_MEMBERSHIP";
  if (
    normalized.startsWith("app/(platform)/") ||
    normalized.startsWith("app/(student-hub)/")
  ) {
    return "AUTHENTICATED_USER";
  }
  if (/requireUser\(|requireServerUser\(/.test(source)) {
    return "AUTHENTICATED_USER";
  }
  if (/getCurrentUser\(/.test(source)) return "PUBLIC_OPTIONAL_SESSION";
  return "PUBLIC_OR_REDIRECT";
}

function apiAccess(file, source) {
  const route = routeFromFile(file);
  if (route.startsWith("/api/admin/")) return "ADMIN_PERMISSION";
  if (route.startsWith("/api/internal/")) return "WORKER_SECRET";
  if (/authorizeAdminApi\(/.test(source)) return "ADMIN_PERMISSION";
  if (
    /requireOrganizationPermission|requireOrganizationMembership/.test(source)
  ) {
    return "ORGANIZATION_PERMISSION";
  }
  if (/getCurrentUser\(|requireUser\(|requireServerUser\(/.test(source)) {
    return "AUTHENTICATED_USER";
  }
  if (route === "/api/health" || route.startsWith("/api/auth/")) {
    return "PUBLIC_CONTROLLED";
  }
  return "PUBLIC_OR_DOMAIN_GUARDED";
}

const files = filesUnder(appRoot);
const pageFiles = files.filter((file) => file.endsWith(`${sep}page.tsx`));
const apiFiles = files.filter((file) => file.endsWith(`${sep}route.ts`));
const pages = pageFiles.map((file) => {
  const source = readFileSync(file, "utf8");
  return {
    route: routeFromFile(file),
    access: pageAccess(file, source),
    file: relative(root, file).split(sep).join("/"),
  };
});
const apis = apiFiles.map((file) => {
  const source = readFileSync(file, "utf8");
  const methods = [
    ...source.matchAll(
      /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g,
    ),
  ].map((match) => match[1]);
  return {
    route: routeFromFile(file),
    methods: methods.length ? methods : ["COMPOSED"],
    access: apiAccess(file, source),
    file: relative(root, file).split(sep).join("/"),
  };
});

const issues = [];
for (const entry of apis.filter(({ route }) =>
  route.startsWith("/api/admin/"),
)) {
  const source = readFileSync(join(root, entry.file), "utf8");
  if (!/authorizeAdminApi\(/.test(source)) {
    issues.push(`${entry.file}: Admin API has no explicit permission check.`);
  }
}
for (const entry of pages.filter(({ route }) => route.startsWith("/admin"))) {
  if (entry.route === "/admin/forbidden") continue;
  const source = readFileSync(join(root, entry.file), "utf8");
  if (
    !/requireAdminPermission\(/.test(source) &&
    !(/requireAdmin\(/.test(source) && /hasAdminPermission\(/.test(source))
  ) {
    issues.push(`${entry.file}: Admin page has no explicit permission check.`);
  }
}

const expectedEntryRoutes = [
  "/home",
  "/student-hub",
  "/discover",
  "/communities",
  "/messages",
  "/saved",
  "/housing",
  "/marketplace",
  "/organizations",
  "/opportunities",
  "/payments",
  "/settings",
];
for (const route of expectedEntryRoutes) {
  if (!pages.some((page) => page.route === route)) {
    issues.push(`Missing primary or contextual entry route: ${route}.`);
  }
}

const expectedCompatibilityRoutes = [
  "/dashboard",
  "/explore",
  "/student-hub/opportunities",
  "/opportunities/scholarships",
  "/opportunities/internships",
  "/opportunities/jobs",
  "/opportunities/programs",
];
for (const route of expectedCompatibilityRoutes) {
  const page = pages.find((entry) => entry.route === route);
  if (!page) {
    issues.push(`Missing compatibility route: ${route}.`);
    continue;
  }
  const source = readFileSync(join(root, page.file), "utf8");
  if (!/(?:permanentRedirect|redirect)\(/.test(source)) {
    issues.push(`${page.file}: compatibility route does not redirect.`);
  }
}

const directAnalyticsFiles = filesUnder(join(root, "src"))
  .filter((file) => /\.(?:ts|tsx)$/.test(file))
  .filter((file) =>
    /posthog\.(?:capture|identify|reset)/.test(readFileSync(file, "utf8")),
  )
  .map((file) => relative(root, file).split(sep).join("/"));
const allowedAnalyticsFiles = new Set([
  "src/components/analytics/ProductAnalytics.tsx",
  "src/lib/product-analytics-client.ts",
  "src/lib/product-analytics-server.ts",
]);
for (const file of directAnalyticsFiles) {
  if (!allowedAnalyticsFiles.has(file)) {
    issues.push(
      `${file}: raw PostHog call bypasses the analytics abstraction.`,
    );
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  counts: {
    pages: pages.length,
    apis: apis.length,
    adminPages: pages.filter(({ route }) => route.startsWith("/admin")).length,
    adminApis: apis.filter(({ route }) => route.startsWith("/api/admin/"))
      .length,
  },
  expectedEntryRoutes,
  expectedCompatibilityRoutes,
  pages: pages.sort((a, b) => a.route.localeCompare(b.route)),
  apis: apis.sort((a, b) => a.route.localeCompare(b.route)),
  issues,
};

if (process.argv.includes("--summary")) {
  console.log(JSON.stringify({ counts: result.counts, issues }, null, 2));
} else {
  console.log(JSON.stringify(result, null, 2));
}
if (issues.length) process.exitCode = 1;
