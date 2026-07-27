import chinaHigherEducation from "../../prisma/reference-data/china-higher-education-2026.json";

const cityById = new Map(
  chinaHigherEducation.cities.map((city) => [city.id, city]),
);
const cityByName = new Map(
  chinaHigherEducation.cities.map((city) => [
    city.name.trim().toLowerCase(),
    city,
  ]),
);
const universityById = new Map(
  chinaHigherEducation.universities.map((university) => [
    university.id,
    university,
  ]),
);
const universityByName = new Map(
  chinaHigherEducation.universities.map((university) => [
    university.name.trim().toLowerCase(),
    university,
  ]),
);

export function chinaCityNativeName(id: string, name: string) {
  return (
    cityById.get(id)?.nativeName ??
    cityByName.get(name.trim().toLowerCase())?.nativeName ??
    null
  );
}

export function chinaUniversityNativeName(id: string, name: string) {
  return (
    universityById.get(id)?.nativeName ??
    universityByName.get(name.trim().toLowerCase())?.nativeName ??
    null
  );
}
