/**
 * The EPUB the reader tests fall back to.
 *
 * Shared by the setup that imports it and the spec that reads it. It lives in
 * its own module because Playwright does not allow a spec to import a setup
 * file, and because a fixture's identity is not something either of them
 * should own alone.
 */
export const FIXTURE_SLUG = "e2e-reader-fixture";
export const FIXTURE_TITLE = "A Sample Book for the Kondo Reader";
