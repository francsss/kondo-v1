import { redirect } from "next/navigation";

// The category views share the hub's search surface so there is exactly one
// implementation of opportunity discovery.
export default function Page() {
  redirect("/opportunities?category=scholarships");
}
