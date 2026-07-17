"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4 py-16">
      <Card className="w-full py-12 text-center">
        <AlertTriangle className="mx-auto h-9 w-9 text-orange-500" />
        <h1 className="mt-5 text-2xl font-black text-kondo-ink dark:text-white">
          Admin workspace unavailable
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          The operation could not be completed. No internal error or private
          case data has been exposed.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="secondary">
            <Link href="/admin/reports">Return to reports</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
