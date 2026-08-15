"use client";

import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSignOut } from "@/lib/use-sign-out";

/**
 * The settings screen's sign-out. Same hook as the shell menus, so the two
 * cannot drift: this copy used to surface failures while the shell's silently
 * swallowed them.
 */
export function LogoutButton() {
  const { signOut, pending, error } = useSignOut();

  return (
    <div>
      <Button
        aria-busy={pending}
        disabled={pending}
        onClick={() => void signOut()}
        type="button"
        variant="danger"
      >
        {pending ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
          />
        ) : (
          <LogOut aria-hidden="true" className="h-4 w-4" />
        )}
        {pending ? "Signing out…" : "Sign out of this device"}
      </Button>
      {error ? (
        <p className="mt-3 text-sm font-bold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
