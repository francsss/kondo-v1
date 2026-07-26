"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  Clock3,
  HandHeart,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { STUDENT_SKILL_CATEGORIES } from "@/lib/peer-marketplace";
import { cn } from "@/lib/utils";

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
  "h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10";

const currencyOptions = SUPPORTED_CURRENCIES.map((currency) => ({
  id: currency.code,
  name: `${currency.code} · ${currency.name}`,
  secondary: currency.symbol,
}));
const skillCategoryOptions = STUDENT_SKILL_CATEGORIES.map((category) => ({
  id: category,
  name: category,
}));

function offerDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

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
  const reducedMotion = useReducedMotion();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [cityId, setCityId] = useState("");
  const [haveCurrency, setHaveCurrency] = useState("CNY");
  const [needCurrency, setNeedCurrency] = useState("");
  const [skillCategory, setSkillCategory] = useState("");

  const offers = type === "exchange" ? exchangeOffers : skillOffers;
  const filteredOffers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return offers;
    return offers.filter((raw) => {
      const owner = `${raw.owner.firstName} ${raw.owner.lastName}`;
      const common = `${owner} ${raw.city?.name ?? ""} ${
        raw.owner.university?.shortName ?? raw.owner.university?.name ?? ""
      }`;
      const searchable =
        type === "exchange"
          ? `${common} ${(raw as ExchangeOffer).haveCurrency} ${
              (raw as ExchangeOffer).needCurrency
            } ${(raw as ExchangeOffer).note ?? ""}`
          : `${common} ${(raw as SkillOffer).title} ${
              (raw as SkillOffer).category
            } ${(raw as SkillOffer).description}`;
      return searchable.toLocaleLowerCase().includes(normalized);
    });
  }, [offers, query, type]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form);
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
      setCityId("");
      setHaveCurrency("CNY");
      setNeedCurrency("");
      setSkillCategory("");
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

  const exchange = type === "exchange";
  const title = exchange ? "Community Exchange" : "Student Skills";
  const description = exchange
    ? "Find trusted peers for a direct currency exchange. Kondo creates the introduction—members decide the details safely."
    : "Turn the knowledge already inside Kondo into useful connections, from language practice to creative and academic support.";

  return (
    <div className="mt-8">
      <section
        className={cn(
          "relative overflow-hidden rounded-[2rem] border p-6 shadow-lift sm:p-8",
          exchange
            ? "border-emerald-300/25 bg-gradient-to-br from-kondo-navy via-kondo-forest to-emerald-700 text-white"
            : "border-violet-300/25 bg-gradient-to-br from-[#151c35] via-[#303064] to-[#7655a8] text-white",
        )}
      >
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[42px] border-white/[0.06]"
        />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-kondo-lime">
              <Sparkles className="h-4 w-4" /> Made for the Kondo community
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
              {description}
            </p>
          </div>
          <Button
            className="border-white/20 bg-white text-kondo-forest hover:bg-kondo-mint"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {showForm ? "Close studio" : "Create an offer"}
          </Button>
        </div>
        <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
          {[
            [`${offers.length}`, "Active offers"],
            [exchange ? "Direct" : "Peer-led", "How it works"],
            ["No fees", "Kondo never handles money"],
          ].map(([value, label]) => (
            <div
              className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-sm"
              key={label}
            >
              <p className="text-lg font-black">{value}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/55">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <AnimatePresence initial={false}>
        {showForm ? (
          <motion.div
            animate={{ height: "auto", opacity: 1, y: 0 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0, y: -8 }}
            initial={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
          >
            <Card className="mt-5 overflow-visible p-5 sm:p-7">
              <div className="mb-6 flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                  {exchange ? (
                    <ArrowRightLeft className="h-5 w-5" />
                  ) : (
                    <HandHeart className="h-5 w-5" />
                  )}
                </span>
                <div>
                  <h2 className="font-black text-foreground">Offer studio</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    A few clear choices are enough. You can close your offer at
                    any time.
                  </p>
                </div>
              </div>
              <form className="grid gap-5 sm:grid-cols-2" onSubmit={submit}>
                <input name="cityId" type="hidden" value={cityId} />
                <SearchableSelect
                  clearLabel="Any city"
                  label="City"
                  onSelect={setCityId}
                  options={cities.map((city) => ({
                    id: city.id,
                    name: city.name,
                  }))}
                  placeholder="Any city"
                  searchPlaceholder="Search cities"
                  selected={cityId}
                />
                {exchange ? (
                  <>
                    <input
                      name="haveCurrency"
                      type="hidden"
                      value={haveCurrency}
                    />
                    <SearchableSelect
                      label="Currency I have"
                      onSelect={setHaveCurrency}
                      options={currencyOptions}
                      placeholder="Choose a currency"
                      searchPlaceholder="Search code or currency"
                      selected={haveCurrency}
                    />
                    <label>
                      <span className="mb-2 block text-sm font-bold">
                        Amount I have
                      </span>
                      <input
                        className={control}
                        inputMode="decimal"
                        name="haveAmount"
                        placeholder="500"
                      />
                    </label>
                    <input
                      name="needCurrency"
                      type="hidden"
                      value={needCurrency}
                    />
                    <SearchableSelect
                      label="Currency I need"
                      onSelect={setNeedCurrency}
                      options={currencyOptions.filter(
                        (currency) => currency.id !== haveCurrency,
                      )}
                      placeholder="Choose a currency"
                      searchPlaceholder="Search code or currency"
                      selected={needCurrency}
                    />
                    <label>
                      <span className="mb-2 block text-sm font-bold">
                        Amount I need
                      </span>
                      <input
                        className={control}
                        inputMode="decimal"
                        name="needAmount"
                        placeholder="Optional"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-2 block text-sm font-bold">Note</span>
                      <textarea
                        className="min-h-28 w-full rounded-2xl border border-border bg-background p-4 text-sm outline-none transition focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
                        maxLength={500}
                        name="note"
                        placeholder="Add a public meeting area or useful context. Never post bank details."
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <input
                      name="category"
                      type="hidden"
                      value={skillCategory}
                    />
                    <SearchableSelect
                      label="Skill category"
                      onSelect={setSkillCategory}
                      options={skillCategoryOptions}
                      placeholder="Choose a category"
                      searchPlaceholder="Search skill categories"
                      selected={skillCategory}
                    />
                    <label className="sm:col-span-2">
                      <span className="mb-2 block text-sm font-bold">
                        Title
                      </span>
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
                      <span className="mb-2 block text-sm font-bold">
                        What can you help with?
                      </span>
                      <textarea
                        className="min-h-28 w-full rounded-2xl border border-border bg-background p-4 text-sm outline-none transition focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
                        maxLength={700}
                        minLength={10}
                        name="description"
                        required
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-2 block text-sm font-bold">
                        Availability
                      </span>
                      <select
                        className={control}
                        defaultValue=""
                        name="availability"
                      >
                        <option value="">Flexible / discuss together</option>
                        <option value="Weekday mornings">
                          Weekday mornings
                        </option>
                        <option value="Weekday afternoons">
                          Weekday afternoons
                        </option>
                        <option value="Weekday evenings">
                          Weekday evenings
                        </option>
                        <option value="Weekends">Weekends</option>
                        <option value="Online only">Online only</option>
                      </select>
                    </label>
                  </>
                )}
                {error ? (
                  <p
                    className="sm:col-span-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <Button
                    disabled={
                      busy ||
                      (exchange
                        ? !haveCurrency || !needCurrency
                        : !skillCategory)
                    }
                    type="submit"
                  >
                    {busy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {busy ? "Publishing…" : "Publish offer"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Visible only to authenticated Kondo members.
                  </p>
                </div>
              </form>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card className="mt-5 flex items-start gap-3 border-emerald-200 bg-kondo-mint/45 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-kondo-green" />
        <p className="text-xs leading-5 text-muted-foreground">
          Review the member profile, meet in a safe place, never pay a deposit,
          and report suspicious behavior. Kondo only facilitates discovery.
        </p>
      </Card>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Discover
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">
            Fresh community offers
          </h2>
        </div>
        <label className="flex h-11 w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 shadow-sm transition focus-within:border-kondo-green focus-within:ring-4 focus-within:ring-kondo-green/10 sm:max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Search offers</span>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              exchange
                ? "Search currency, city or member"
                : "Search skills, city or member"
            }
            value={query}
          />
          {query ? (
            <button
              aria-label="Clear offer search"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              onClick={() => setQuery("")}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      {filteredOffers.length ? (
        <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredOffers.map((raw, index) => {
            const owner = raw.owner;
            const own = owner.id === currentUserId;
            return (
              <motion.article
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex min-h-72 flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card p-5 text-card-foreground shadow-[0_10px_35px_rgb(var(--foreground)/0.05)] transition duration-300 hover:-translate-y-1 hover:border-kondo-green/35 hover:shadow-lift"
                initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
                key={raw.id}
                transition={{
                  delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.2),
                }}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl transition group-hover:opacity-80",
                    exchange ? "bg-emerald-200" : "bg-violet-200",
                  )}
                />
                <div className="relative flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-2xl",
                      exchange
                        ? "bg-kondo-mint text-kondo-green dark:bg-emerald-400/10"
                        : "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
                    )}
                  >
                    {exchange ? (
                      <ArrowRightLeft className="h-5 w-5" />
                    ) : (
                      <HandHeart className="h-5 w-5" />
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {offerDate(raw.createdAt)}
                  </span>
                </div>
                {exchange ? (
                  <>
                    <div className="relative mt-5 flex items-center gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          Offers
                        </p>
                        <p className="mt-1 text-xl font-black">
                          {(raw as ExchangeOffer).haveAmount
                            ? `${(raw as ExchangeOffer).haveAmount} `
                            : ""}
                          {(raw as ExchangeOffer).haveCurrency}
                        </p>
                      </div>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-kondo-green transition group-hover:translate-x-0.5">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          Needs
                        </p>
                        <p className="mt-1 text-xl font-black">
                          {(raw as ExchangeOffer).needAmount
                            ? `${(raw as ExchangeOffer).needAmount} `
                            : ""}
                          {(raw as ExchangeOffer).needCurrency}
                        </p>
                      </div>
                    </div>
                    <p className="relative mt-4 flex-1 text-sm leading-6 text-muted-foreground">
                      {(raw as ExchangeOffer).note ||
                        "Open to a safe, direct agreement with another member."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="relative mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
                      {(raw as SkillOffer).category}
                    </p>
                    <h3 className="relative mt-2 text-xl font-black tracking-tight">
                      {(raw as SkillOffer).title}
                    </h3>
                    <p className="relative mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                      {(raw as SkillOffer).description}
                    </p>
                    {(raw as SkillOffer).availability ? (
                      <p className="relative mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {(raw as SkillOffer).availability}
                      </p>
                    ) : null}
                  </>
                )}
                <div className="relative mt-5 border-t border-border pt-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-kondo-lime to-emerald-300 text-xs font-black text-kondo-forest">
                      {owner.firstName[0]}
                      {owner.lastName[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">
                        {owner.firstName} {owner.lastName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {raw.city?.name ??
                          owner.university?.shortName ??
                          owner.university?.name ??
                          "Kondo member"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    {own ? (
                      <Button
                        disabled={busy}
                        fullWidth
                        onClick={() => closeOffer(raw.id)}
                        size="sm"
                        variant="secondary"
                      >
                        Close my offer
                      </Button>
                    ) : (
                      <Button asChild fullWidth size="sm">
                        <Link
                          href={`/messages/new?recipient=${owner.id}&sourceType=${
                            exchange ? "exchange_offer" : "skill_offer"
                          }&sourceId=${raw.id}`}
                        >
                          Start a conversation
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </section>
      ) : (
        <section className="mt-5 overflow-hidden rounded-[2rem] border border-dashed border-border bg-gradient-to-br from-card to-muted/50 p-8 text-center sm:p-12">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
            {query ? (
              <UserRoundSearch className="h-6 w-6" />
            ) : (
              <Sparkles className="h-6 w-6" />
            )}
          </span>
          <h3 className="mt-4 text-xl font-black">
            {query ? "No matching offer yet" : "This board is ready for you"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {query
              ? "Try another city, currency, skill or member name."
              : `Be the first to create a useful ${
                  exchange ? "exchange" : "skill"
                } connection for the community.`}
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              setQuery("");
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Create the first offer
          </Button>
        </section>
      )}
    </div>
  );
}
