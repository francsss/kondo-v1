import type { Metadata } from "next";
import Link from "next/link";
import { Check, Crown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPremiumAccess } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Meet Premium" };

export default async function MeetPremiumPage() {
  const user = await requireUser();
  const [access, plans] = await Promise.all([
    getPremiumAccess(user.id),
    prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Optional upgrades for richer privacy-first student discovery. Random video matching and core discovery remain available without a subscription."
        eyebrow="Meet"
        title="Premium discovery"
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#238164] p-8 text-white shadow-lift sm:p-10">
          <Crown className="h-8 w-8 text-kondo-lime" />
          <h2 className="mt-6 text-3xl font-black tracking-tight">
            More ways to discover. The same privacy controls.
          </h2>
          <div className="mt-7 space-y-4">
            {[
              "View complete profiles from discovery previews",
              "Explore extended areas and other study cities",
              "Send connection requests from the discovery map",
              "Keep every visibility preference under your control",
            ].map((feature) => (
              <p className="flex items-start gap-3 text-sm" key={feature}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-kondo-lime" />
                {feature}
              </p>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          {access.active ? (
            <Card>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
                Active subscription
              </p>
              <h2 className="mt-2 text-xl font-black">{access.planName}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {access.expiresAt
                  ? `Current period ends ${new Date(
                      access.expiresAt,
                    ).toLocaleDateString()}.`
                  : "Your subscription is active."}
              </p>
            </Card>
          ) : (
            plans.map((plan) => (
              <Card key={plan.id}>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
                  {plan.billingInterval.toLowerCase()}
                </p>
                <h2 className="mt-2 text-xl font-black">{plan.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {plan.description}
                </p>
                <Button className="mt-5" disabled fullWidth>
                  Checkout unavailable
                </Button>
              </Card>
            ))
          )}
          <Card className="bg-muted/45">
            <ShieldCheck className="h-5 w-5 text-kondo-green" />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Billing is intentionally inactive until the official Alipay
              adapter and verified webhook flow are configured. Kondo does not
              simulate payments or grant access from an unverified checkout.
            </p>
          </Card>
          <Button asChild fullWidth variant="secondary">
            <Link href="/communities?tab=meet">Return to Meet</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
