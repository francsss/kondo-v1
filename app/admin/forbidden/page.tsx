import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function AdminForbiddenPage() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4 py-16">
      <Card className="w-full py-12 text-center">
        <ShieldX className="mx-auto h-9 w-9 text-red-500" />
        <h1 className="mt-5 text-2xl font-black text-kondo-ink dark:text-white">
          Access denied
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Your current operational role does not include the permission needed
          for this page.
        </p>
        <Button asChild className="mt-7">
          <Link href="/admin/reports">Return to your report queue</Link>
        </Button>
      </Card>
    </div>
  );
}
