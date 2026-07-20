"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function logout() {
    setPending(true);
    setFeedback("");
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    if (!response?.ok) {
      const result = await response?.json().catch(() => ({}));
      setPending(false);
      setFeedback(result?.error ?? "Sign out failed.");
      return;
    }
    window.location.assign("/login");
  }

  return (
    <div>
      <Button
        disabled={pending}
        onClick={logout}
        type="button"
        variant="danger"
      >
        <LogOut className="h-4 w-4" />
        {pending ? "Signing out…" : "Sign out of this device"}
      </Button>
      {feedback ? (
        <p className="mt-3 text-sm text-red-600">{feedback}</p>
      ) : null}
    </div>
  );
}
