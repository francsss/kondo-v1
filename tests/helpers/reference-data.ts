import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomCountryCode() {
  const pick = () =>
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `${pick()}${pick()}`;
}

/**
 * Creates a disposable Country.
 *
 * `Country.code` is `@db.Char(2)` and unique, so the space is small and shared
 * by every integration file running in parallel against the same database.
 * Deriving the code from a UUID made it worse: UUIDs are hexadecimal, which
 * leaves only 256 codes and collides with real ISO codes such as AD, BE or CF.
 * Retrying on the unique-constraint violation is what actually makes this
 * safe, whatever the alphabet.
 */
export async function createTestCountry(
  prisma: PrismaClient,
  options: { name?: string } = {},
) {
  const name = options.name ?? `Test Land ${randomUUID().slice(0, 8)}`;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      return await prisma.country.create({
        data: { code: randomCountryCode(), name },
        select: { id: true, code: true, name: true },
      });
    } catch (error) {
      const collided =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!collided || attempt === 12) throw error;
    }
  }
  throw new Error("Could not allocate a free country code.");
}
