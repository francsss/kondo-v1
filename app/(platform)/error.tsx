"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function PlatformError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[720px] px-4 pb-28 pt-12 sm:px-6 lg:px-8">
      <Card className="text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-orange-500" />
        <h1 className="mt-4 text-xl font-black text-kondo-ink dark:text-white">
          This page could not be loaded
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is safe. Try loading the page again.
        </p>
        <Button className="mt-5" onClick={reset} type="button">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </Card>
    </div>
  );
}
