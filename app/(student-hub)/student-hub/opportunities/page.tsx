import { redirect } from "next/navigation";

// Part 5 replaced this City-Hub-derived listing with the Opportunities domain.
// The route is kept as a redirect so existing links and bookmarks still work.
export default function Page() {
  redirect("/opportunities");
}
