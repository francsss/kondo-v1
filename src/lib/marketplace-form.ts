export type MarketplaceSubmitIntent = "draft" | "publish" | "save";

type SubmitterLike = {
  name?: unknown;
  value?: unknown;
};

export function getMarketplaceSubmitIntent(
  submitter: SubmitterLike | null | undefined,
): MarketplaceSubmitIntent | null {
  if (submitter?.name !== "intent") return null;

  if (
    submitter.value === "draft" ||
    submitter.value === "publish" ||
    submitter.value === "save"
  ) {
    return submitter.value;
  }

  return null;
}
