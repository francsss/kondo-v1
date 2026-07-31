"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function MessagesError({ reset }: { reset: () => void }) {
  return (
    <div className="grid min-h-[65dvh] place-items-center px-5 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-300">
          <AlertCircle className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-black text-kondo-ink dark:text-white">
          Messages could not be loaded
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your conversations are safe. Check your connection and try again.
        </p>
        <Button className="mt-5" onClick={reset}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
