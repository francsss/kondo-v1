"use client";

import Link from "next/link";
import { Crown, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function MeetPremiumGate({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason: string;
}) {
  if (!open) return null;

  return (
    <div
      aria-labelledby="meet-premium-title"
      aria-modal="true"
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-kondo-navy/65 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-card shadow-2xl">
        <div className="bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#238164] p-7 text-white sm:p-9">
          <Button
            aria-label="Close Meet Premium"
            className="absolute right-4 top-4 text-white hover:bg-white/10"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="h-5 w-5" />
          </Button>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-kondo-lime">
            <Crown className="h-6 w-6" />
          </span>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-kondo-lime">
            Meet Premium
          </p>
          <h2
            className="mt-2 text-3xl font-black tracking-tight"
            id="meet-premium-title"
          >
            Discover more, without losing control.
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/70">{reason}</p>
        </div>
        <div className="space-y-4 p-7 sm:p-9">
          {[
            "View complete profiles from discovery previews",
            "Explore extended areas and other study cities",
            "Send connection requests directly from the map",
          ].map((feature) => (
            <div className="flex items-start gap-3" key={feature}>
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green" />
              <p className="text-sm font-bold">{feature}</p>
            </div>
          ))}
          <div className="rounded-2xl bg-muted p-4 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mb-2 h-4 w-4 text-kondo-green" />
            Billing is not active yet. Kondo will never simulate a payment or
            activate Premium without a verified provider transaction.
          </div>
          <Button asChild fullWidth>
            <Link href="/meet/premium">See Meet Premium</Link>
          </Button>
          <Button fullWidth onClick={onClose} type="button" variant="ghost">
            Continue basic discovery
          </Button>
        </div>
      </div>
    </div>
  );
}
