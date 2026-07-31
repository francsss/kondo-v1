import { redirect } from "next/navigation";

// Part 5 replaced this City-Hub-derived listing with the Opportunities domain.
export default function Page() {
  redirect("/opportunities?category=internships");
}
