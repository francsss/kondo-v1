import { redirect } from "next/navigation";

export default function NewOrganizationPage() {
  redirect("/onboarding/organization?new=1");
}
