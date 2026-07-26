"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Plan = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  priceMinor: number | null;
  currency: string;
  billingInterval: "MONTHLY" | "YEARLY";
  featureKeys: string[];
};

export function PremiumPlanManager({
  initialPlans,
  canManage,
}: {
  initialPlans: Plan[];
  canManage: boolean;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  async function save(plan: Plan) {
    if (!canManage || busyId) return;
    setBusyId(plan.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/subscription-plans/${plan.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "The plan could not be saved.");
      }
      setMessage("Subscription plan saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The plan could not be saved.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mt-7 space-y-4">
      {message ? (
        <p className="rounded-2xl bg-muted p-4 text-sm font-bold" role="status">
          {message}
        </p>
      ) : null}
      {plans.map((plan, index) => (
        <Card className="grid gap-4 sm:grid-cols-2" key={plan.id}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Plan name</span>
            <input
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base"
              disabled={!canManage}
              onChange={(event) =>
                setPlans((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, name: event.target.value }
                      : item,
                  ),
                )
              }
              value={plan.name}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">
              Price (minor units)
            </span>
            <input
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base"
              disabled={!canManage}
              min={0}
              onChange={(event) =>
                setPlans((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          priceMinor: event.target.value
                            ? Number(event.target.value)
                            : null,
                        }
                      : item,
                  ),
                )
              }
              type="number"
              value={plan.priceMinor ?? ""}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">Description</span>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-border bg-background p-4 text-base"
              disabled={!canManage}
              onChange={(event) =>
                setPlans((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, description: event.target.value }
                      : item,
                  ),
                )
              }
              value={plan.description}
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-bold">
            <input
              checked={plan.active}
              disabled={!canManage}
              onChange={(event) =>
                setPlans((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, active: event.target.checked }
                      : item,
                  ),
                )
              }
              type="checkbox"
            />
            Available to users
          </label>
          {canManage ? (
            <Button
              disabled={Boolean(busyId)}
              onClick={() => save(plan)}
              type="button"
            >
              {busyId === plan.id ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save plan
            </Button>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
