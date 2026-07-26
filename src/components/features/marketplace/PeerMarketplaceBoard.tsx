"use client";

import Link from "next/link";
import {
  ArrowRightLeft,
  HandHeart,
  LoaderCircle,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type City = { id: string; name: string };
type Owner = {
  id: string;
  firstName: string;
  lastName: string;
  university: { shortName: string | null; name: string } | null;
};
type ExchangeOffer = {
  id: string;
  haveCurrency: string;
  needCurrency: string;
  haveAmount: string | null;
  needAmount: string | null;
  note: string | null;
  city: { name: string } | null;
  owner: Owner;
  createdAt: string;
};
type SkillOffer = {
  id: string;
  title: string;
  category: string;
  description: string;
  availability: string | null;
  city: { name: string } | null;
  owner: Owner;
  createdAt: string;
};

const control =
  "h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green";

export function PeerMarketplaceBoard({
  type,
  cities,
  currentUserId,
  exchangeOffers,
  skillOffers,
}: {
  type: "exchange" | "skills";
  cities: City[];
  currentUserId: string;
  exchangeOffers: ExchangeOffer[];
  skillOffers: SkillOffer[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(
        type === "exchange"
          ? "/api/marketplace/exchange"
          : "/api/marketplace/skills",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "The offer could not be published.");
      }
      event.currentTarget.reset();
      setShowForm(false);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The offer could not be published.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function closeOffer(id: string) {
    if (!window.confirm("Close this offer?")) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/marketplace/${type}/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(payload?.error ?? "The offer could not be closed.");
      return;
    }
    router.refresh();
  }

  const title = type === "exchange" ? "Community Exchange" : "Student Skills";
  const description =
    type === "exchange"
      ? "Post what currency you have and what you need, then agree directly with another member. Kondo never holds or transfers money."
      : "Share practical peer help—from language practice to design, coding or study support. This is a community skills board, not a freelancing marketplace.";

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            Peer to peer
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}>
          <Plus className="h-4 w-4" />
          {showForm ? "Close form" : "Post an offer"}
        </Button>
      </div>

      <Card className="mt-6 flex items-start gap-3 border-emerald-200 bg-kondo-mint/45 dark:border-emerald-400/15 dark:bg-emerald-400/5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-kondo-green" />
        <p className="text-xs leading-5 text-muted-foreground">
          Check the member profile, meet safely, never pay a deposit, and report
          suspicious behavior. Kondo only helps members discover and contact
          each other.
        </p>
      </Card>

      {showForm ? (
        <Card className="mt-5">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <label>
              <span className="mb-2 block text-xs font-black">City</span>
              <select className={control} name="cityId">
                <option value="">Any city</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            {type === "exchange" ? (
              <>
                <label>
                  <span className="mb-2 block text-xs font-black">
                    Currency I have
                  </span>
                  <input
                    className={control}
                    maxLength={12}
                    name="haveCurrency"
                    placeholder="CNY"
                    required
                  />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-black">
                    Amount I have
                  </span>
                  <input
                    className={control}
                    name="haveAmount"
                    placeholder="500"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-black">
                    Currency I need
                  </span>
                  <input
                    className={control}
                    maxLength={12}
                    name="needCurrency"
                    placeholder="XAF"
                    required
                  />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-black">
                    Amount I need
                  </span>
                  <input
                    className={control}
                    name="needAmount"
                    placeholder="Optional"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-xs font-black">Note</span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-border bg-background p-4 text-sm"
                    maxLength={500}
                    name="note"
                    placeholder="Preferred meeting area or useful context. Never post bank details."
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  <span className="mb-2 block text-xs font-black">
                    Category
                  </span>
                  <input
                    className={control}
                    maxLength={60}
                    name="category"
                    placeholder="Language practice"
                    required
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-xs font-black">Title</span>
                  <input
                    className={control}
                    maxLength={120}
                    minLength={4}
                    name="title"
                    placeholder="I can help with conversational Mandarin"
                    required
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-xs font-black">
                    What can you help with?
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-border bg-background p-4 text-sm"
                    maxLength={700}
                    minLength={10}
                    name="description"
                    required
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-xs font-black">
                    Availability
                  </span>
                  <input
                    className={control}
                    maxLength={160}
                    name="availability"
                    placeholder="Weekday evenings"
                  />
                </label>
              </>
            )}
            {error ? (
              <p className="sm:col-span-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
                {error}
              </p>
            ) : null}
            <div className="sm:col-span-2">
              <Button disabled={busy} type="submit">
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
                {busy ? "Publishing…" : "Publish offer"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {(type === "exchange" ? exchangeOffers : skillOffers).map((raw) => {
          const owner = raw.owner;
          const own = owner.id === currentUserId;
          return (
            <Card className="flex h-full flex-col" key={raw.id}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                {type === "exchange" ? (
                  <ArrowRightLeft className="h-5 w-5" />
                ) : (
                  <HandHeart className="h-5 w-5" />
                )}
              </span>
              {type === "exchange" ? (
                <>
                  <h2 className="mt-4 text-xl font-black">
                    {(raw as ExchangeOffer).haveAmount
                      ? `${(raw as ExchangeOffer).haveAmount} `
                      : ""}
                    {(raw as ExchangeOffer).haveCurrency}
                    <span className="mx-2 text-kondo-green">→</span>
                    {(raw as ExchangeOffer).needAmount
                      ? `${(raw as ExchangeOffer).needAmount} `
                      : ""}
                    {(raw as ExchangeOffer).needCurrency}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                    {(raw as ExchangeOffer).note ||
                      "Contact the member to agree safely."}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-4 text-xs font-black uppercase tracking-wide text-kondo-green">
                    {(raw as SkillOffer).category}
                  </p>
                  <h2 className="mt-2 text-lg font-black">
                    {(raw as SkillOffer).title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                    {(raw as SkillOffer).description}
                  </p>
                  {(raw as SkillOffer).availability ? (
                    <p className="mt-3 text-xs font-bold text-muted-foreground">
                      {(raw as SkillOffer).availability}
                    </p>
                  ) : null}
                </>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                {owner.firstName} {owner.lastName}
                {owner.university
                  ? ` · ${owner.university.shortName ?? owner.university.name}`
                  : ""}
                {raw.city ? ` · ${raw.city.name}` : ""}
              </p>
              <div className="mt-4 flex gap-2">
                {own ? (
                  <Button
                    disabled={busy}
                    onClick={() => closeOffer(raw.id)}
                    size="sm"
                    variant="secondary"
                  >
                    Close offer
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link
                      href={`/messages/new?recipient=${owner.id}&sourceType=${type === "exchange" ? "exchange_offer" : "skill_offer"}&sourceId=${raw.id}`}
                    >
                      Contact directly
                    </Link>
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
