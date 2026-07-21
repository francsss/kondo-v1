import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function AdminNotFound() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4 py-16">
      <Card className="w-full py-12 text-center">
        <FileQuestion className="mx-auto h-9 w-9 text-muted-foreground" />
        <h1 className="mt-5 text-2xl font-black text-kondo-ink dark:text-white">
          Admin resource not found
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          The requested case does not exist or is no longer available to this
          operational workspace.
        </p>
        <Button asChild className="mt-7">
          <Link href="/admin/reports">Return to reports</Link>
        </Button>
      </Card>
    </div>
  );
}
