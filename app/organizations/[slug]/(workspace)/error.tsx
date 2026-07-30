"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function OrganizationWorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      className="mx-auto my-10 max-w-2xl rounded-4xl border border-border bg-card p-8 text-center shadow-sm"
      role="alert"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mx-auto h-9 w-9 text-warning"
      />
      <h1 className="mt-4 text-2xl font-black">
        This workspace could not be loaded
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Your account is safe. Try loading the organization workspace again.
      </p>
      <Button className="mt-6" onClick={reset}>
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </section>
  );
}
