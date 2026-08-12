import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pinyin } from "pinyin-pro";
import { COUNTRIES } from "../src/lib/countries";

const MOE_LIST_ID = "10000101";
const MOE_BASE_URL = "https://hudong.moe.gov.cn/school/wcmdata";
const MOE_SOURCE_URL = "https://hudong.moe.gov.cn/qggxmd/";
const CSC_SOURCE_URL =
  "https://campuschina.org/Upload/file/20240408/20240408111834_0971.pdf";
const OUTPUT_DIRECTORY = path.join(process.cwd(), "prisma", "reference-data");
const OUTPUT_DATA_PATH = path.join(
  OUTPUT_DIRECTORY,
  "china-higher-education-2026.json",
);
const OUTPUT_MIGRATION_DIRECTORY = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260723120000_complete_onboarding_reference_data",
);
const OUTPUT_MIGRATION_PATH = path.join(
  OUTPUT_MIGRATION_DIRECTORY,
  "migration.sql",
);
const CSC_DATA_PATH = path.join(
  process.cwd(),
  "scripts",
  "data",
  "csc-host-universities-2024.json",
);

type MoeRow = {
  number: number;
  nativeName: string;
  officialCode: string;
  authority: string;
  nativeCity: string;
  level: string;
  note: string;
};

type CscRow = {
  number: number;
  provinceNative: string;
  province: string;
  nativeName: string;
  name: string;
};

type CityRecord = {
  id: string;
  slug: string;
  name: string;
  nativeName: string;
  province: string | null;
  provinceNative: string | null;
};

type UniversityRecord = {
  id: string;
  slug: string;
  officialCode: string;
  name: string;
  nativeName: string;
  citySlug: string;
  cityName: string;
  level: string;
  note: string | null;
  internationalHost: boolean;
};

const existingCitySlugs: Record<string, string> = {
  北京市: "beijing",
  上海市: "shanghai",
  武汉市: "wuhan",
  杭州市: "hangzhou",
};

const existingUniversitySlugs: Record<string, string> = {
  北京大学: "peking-university",
  清华大学: "tsinghua-university",
  武汉大学: "wuhan-university",
  浙江大学: "zhejiang-university",
};

const institutionSuffixes = [
  ["职业技术大学", "Vocational and Technical University"],
  ["职业技术学院", "Vocational and Technical College"],
  ["职业大学", "Vocational University"],
  ["中医药大学", "University of Chinese Medicine"],
  ["医科大学", "Medical University"],
  ["师范大学", "Normal University"],
  ["农业大学", "Agricultural University"],
  ["科技大学", "University of Science and Technology"],
  ["理工大学", "University of Technology"],
  ["工业大学", "University of Technology"],
  ["交通大学", "Jiaotong University"],
  ["财经大学", "University of Finance and Economics"],
  ["外国语大学", "International Studies University"],
  ["大学", "University"],
  ["学院", "College"],
] as const;

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNativeName(value: string) {
  return value.replaceAll("（", "(").replaceAll("）", ")").trim();
}

function parseRows(html: string): MoeRow[] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) =>
      [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
        decodeHtml(cell[1]),
      ),
    )
    .filter((cells) => cells.length >= 6 && /^\d+$/.test(cells[0]))
    .map((cells) => ({
      number: Number(cells[0]),
      nativeName: normalizeNativeName(cells[1]),
      officialCode: cells[2],
      authority: cells[3],
      nativeCity: cells[4],
      level: cells[5],
      note: cells[6] ?? "",
    }));
}

async function fetchText(url: string, attempts = 5): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Kondo reference-data generator" },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw lastError;
}

async function fetchOfficialDirectory() {
  const countHtml = await fetchText(
    `${MOE_BASE_URL}/getCounts.jsp?listid=${MOE_LIST_ID}&page=1`,
  );
  const count = Number(countHtml.match(/(\d+)\s*条/)?.[1]);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("The Ministry of Education record count is unavailable.");
  }

  const pageCount = Math.ceil(count / 20);
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const rows: MoeRow[] = [];

  for (let offset = 0; offset < pages.length; offset += 10) {
    const batch = pages.slice(offset, offset + 10);
    const pageRows = await Promise.all(
      batch.map(async (page) => {
        const expected = page === pageCount ? count - (page - 1) * 20 : 20;
        for (let attempt = 1; attempt <= 5; attempt += 1) {
          const html = await fetchText(
            `${MOE_BASE_URL}/getDataIndex.jsp?listid=${MOE_LIST_ID}&page=${page}`,
          );
          const parsed = parseRows(html);
          if (parsed.length === expected) return parsed;
          await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        }
        throw new Error(
          `Ministry page ${page} did not return ${expected} rows.`,
        );
      }),
    );
    rows.push(...pageRows.flat());
  }

  rows.sort((left, right) => left.number - right.number);
  if (
    rows.length !== count ||
    rows.some((row, index) => row.number !== index + 1)
  ) {
    throw new Error(
      `Official directory validation failed: expected ${count}, received ${rows.length}.`,
    );
  }
  return rows;
}

function stableId(namespace: string, value: string) {
  return `c${namespace}${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
}

function romanizeCompact(value: string) {
  const words = pinyin(value, {
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
  })
    .map((word) => word.replace(/[^a-z0-9]+/gi, ""))
    .filter(Boolean);
  const joined = words.join("").toLowerCase();
  return joined ? joined[0].toUpperCase() + joined.slice(1) : value;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function englishInstitutionName(nativeName: string) {
  for (const [suffix, englishSuffix] of institutionSuffixes) {
    if (!nativeName.endsWith(suffix)) continue;
    const prefix = nativeName.slice(0, -suffix.length);
    return `${romanizeCompact(prefix)} ${englishSuffix}`.trim();
  }
  return romanizeCompact(nativeName);
}

function provinceNativeFromAuthority(authority: string) {
  const match = authority.match(
    /^(.+?(?:省|自治区|壮族自治区|回族自治区|维吾尔自治区|市))/,
  );
  return match?.[1] ?? null;
}

function englishProvince(nativeName: string | null) {
  if (!nativeName) return null;
  return romanizeCompact(
    nativeName
      .replace(/壮族自治区$|回族自治区$|维吾尔自治区$|自治区$|省$|市$/u, "")
      .trim(),
  );
}

function sql(value: string | null | boolean) {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${value.replaceAll("'", "''")}'`;
}

function chunks<T>(values: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function buildMigration(
  cities: CityRecord[],
  universities: UniversityRecord[],
) {
  const countries = COUNTRIES;
  const statements: string[] = [
    "-- Generated from the official 2026 Ministry of Education directory.",
    "-- Existing rows are updated by stable code/slug so user relations are preserved.",
    "",
    `INSERT INTO "Country" ("id", "code", "name", "emoji", "isActive", "verified", "createdAt", "updatedAt")`,
    "VALUES",
    countries
      .map(
        (country) =>
          `  (${sql(stableId("country", country.code))}, ${sql(country.code)}, ${sql(country.name)}, ${sql(country.emoji)}, TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .join(",\n"),
    `ON CONFLICT ("code") DO UPDATE SET`,
    `  "name" = EXCLUDED."name",`,
    `  "emoji" = EXCLUDED."emoji",`,
    `  "isActive" = TRUE,`,
    `  "verified" = TRUE,`,
    `  "updatedAt" = CURRENT_TIMESTAMP;`,
    "",
  ];

  for (const batch of chunks(cities, 200)) {
    statements.push(
      `INSERT INTO "City" ("id", "slug", "name", "province", "countryId", "isActive", "verified", "createdAt", "updatedAt")`,
      "SELECT data.id, data.slug, data.name, data.province, country.id, TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP",
      `FROM (VALUES`,
      batch
        .map(
          (city) =>
            `  (${sql(city.id)}, ${sql(city.slug)}, ${sql(city.name)}, ${sql(city.province)})`,
        )
        .join(",\n"),
      `) AS data(id, slug, name, province)`,
      `CROSS JOIN "Country" AS country`,
      `WHERE country.code = 'CN'`,
      `ON CONFLICT ("countryId", "name") DO UPDATE SET`,
      `  "province" = EXCLUDED."province",`,
      `  "isActive" = TRUE,`,
      `  "verified" = TRUE,`,
      `  "updatedAt" = CURRENT_TIMESTAMP;`,
      "",
    );
  }

  for (const batch of chunks(universities, 200)) {
    statements.push(
      `INSERT INTO "University" ("id", "slug", "name", "shortName", "countryId", "cityId", "isActive", "verified", "createdAt", "updatedAt")`,
      "SELECT data.id, data.slug, data.name, data.native_name, country.id, city.id, TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP",
      `FROM (VALUES`,
      batch
        .map(
          (university) =>
            `  (${sql(university.id)}, ${sql(university.slug)}, ${sql(university.name)}, ${sql(university.nativeName)}, ${sql(university.cityName)})`,
        )
        .join(",\n"),
      `) AS data(id, slug, name, native_name, city_name)`,
      `JOIN "Country" AS country ON country.code = 'CN'`,
      `JOIN "City" AS city ON city."countryId" = country.id AND city.name = data.city_name`,
      `ON CONFLICT ("cityId", "name") DO UPDATE SET`,
      `  "shortName" = COALESCE("University"."shortName", EXCLUDED."shortName"),`,
      `  "countryId" = EXCLUDED."countryId",`,
      `  "cityId" = EXCLUDED."cityId",`,
      `  "isActive" = TRUE,`,
      `  "verified" = TRUE,`,
      `  "updatedAt" = CURRENT_TIMESTAMP;`,
      "",
    );
  }

  return `${statements.join("\n")}\n`;
}

async function main() {
  const cscRows = JSON.parse(await readFile(CSC_DATA_PATH, "utf8")) as CscRow[];
  const cscByNativeName = new Map(
    cscRows.map((row) => [normalizeNativeName(row.nativeName), row]),
  );
  const rows = await fetchOfficialDirectory();

  const cityProvinceCandidates = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const cscProvince = cscByNativeName.get(row.nativeName)?.provinceNative;
    const provinceNative =
      provinceNativeFromAuthority(row.authority) ?? cscProvince ?? null;
    if (!provinceNative) continue;
    const candidates =
      cityProvinceCandidates.get(row.nativeCity) ?? new Map<string, number>();
    candidates.set(provinceNative, (candidates.get(provinceNative) ?? 0) + 1);
    cityProvinceCandidates.set(row.nativeCity, candidates);
  }

  const cityDrafts = [...new Set(rows.map((row) => row.nativeCity))].map(
    (nativeName) => {
      const provinceNative =
        [...(cityProvinceCandidates.get(nativeName)?.entries() ?? [])].sort(
          (left, right) => right[1] - left[1],
        )[0]?.[0] ?? null;
      return {
        nativeName,
        provinceNative,
        province: englishProvince(provinceNative),
        baseName: romanizeCompact(
          nativeName
            .replace(/自治州$|地区$|盟$|市$/u, "")
            .replace(/特别行政区$/u, ""),
        ),
      };
    },
  );
  const nameCounts = new Map<string, number>();
  for (const city of cityDrafts) {
    nameCounts.set(city.baseName, (nameCounts.get(city.baseName) ?? 0) + 1);
  }

  const cities: CityRecord[] = cityDrafts
    .map((city) => {
      const name =
        (nameCounts.get(city.baseName) ?? 0) > 1 && city.province
          ? `${city.baseName} (${city.province})`
          : city.baseName;
      return {
        id: stableId("city", city.nativeName),
        slug:
          existingCitySlugs[city.nativeName] ??
          `china-${slugify(name)}-${createHash("sha1").update(city.nativeName).digest("hex").slice(0, 6)}`,
        name,
        nativeName: city.nativeName,
        province: city.province,
        provinceNative: city.provinceNative,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const cityByNativeName = new Map(
    cities.map((city) => [city.nativeName, city]),
  );

  const universities: UniversityRecord[] = rows.map((row) => {
    const csc = cscByNativeName.get(row.nativeName);
    const city = cityByNativeName.get(row.nativeCity);
    if (!city) throw new Error(`Missing city for ${row.nativeName}.`);
    const name = csc?.name ?? englishInstitutionName(row.nativeName);
    return {
      id: stableId("university", row.officialCode),
      slug:
        existingUniversitySlugs[row.nativeName] ??
        `moe-${row.officialCode.toLowerCase()}`,
      officialCode: row.officialCode,
      name,
      nativeName: row.nativeName,
      citySlug: city.slug,
      cityName: city.name,
      level: row.level,
      note: row.note || null,
      internationalHost: Boolean(csc),
    };
  });
  const universityNameCounts = new Map<string, number>();
  for (const university of universities) {
    const key = `${university.citySlug}\u0000${university.name.toLocaleLowerCase()}`;
    universityNameCounts.set(key, (universityNameCounts.get(key) ?? 0) + 1);
  }
  for (const university of universities) {
    const key = `${university.citySlug}\u0000${university.name.toLocaleLowerCase()}`;
    if ((universityNameCounts.get(key) ?? 0) > 1) {
      university.name = `${university.name} (${university.nativeName})`;
    }
  }

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await mkdir(OUTPUT_MIGRATION_DIRECTORY, { recursive: true });
  await writeFile(
    OUTPUT_DATA_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sources: [
          {
            name: "Ministry of Education of the People's Republic of China",
            url: MOE_SOURCE_URL,
            recordCount: universities.length,
          },
          {
            name: "China Scholarship Council - Chinese Host University List",
            url: CSC_SOURCE_URL,
            recordCount: cscRows.length,
          },
        ],
        cities,
        universities,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    OUTPUT_MIGRATION_PATH,
    buildMigration(cities, universities),
    "utf8",
  );
  console.info(
    `Generated ${cities.length} cities and ${universities.length} institutions.`,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
