"use client";

import {
  Activity,
  Clock3,
  GraduationCap,
  MapPin,
  RadioTower,
  RefreshCw,
  Smartphone,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  getEstimatedSessionRange,
  type PresenceSnapshot,
} from "@/lib/presence-shared";

const DASHBOARD_REFRESH_MS = 60_000;

function unique(values: Array<string | null>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort((a, b) => a.localeCompare(b));
}

function relativeActivity(value: string, now: Date) {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(value).getTime()) / 1_000),
  );
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function aggregate(users: PresenceSnapshot[], key: "city" | "university") {
  const counts = new Map<string, number>();
  for (const user of users) {
    const label = user[key] ?? "Not specified";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export function LivePresenceDashboard({
  initialUsers,
  initialGeneratedAt,
}: {
  initialUsers: PresenceSnapshot[];
  initialGeneratedAt: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState("");
  const [university, setUniversity] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const now = useMemo(() => new Date(generatedAt), [generatedAt]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/presence", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        users: PresenceSnapshot[];
        generatedAt: string;
      };
      setUsers(data.users);
      setGeneratedAt(data.generatedAt);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, DASHBOARD_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          (!city || user.city === city) &&
          (!university || user.university === university) &&
          (!country || user.country === country) &&
          (!role || user.role === role),
      ),
    [city, country, role, university, users],
  );

  const averageMinutes = filteredUsers.length
    ? Math.round(
        filteredUsers.reduce(
          (total, user) =>
            total +
            Math.max(0, now.getTime() - new Date(user.connectedAt).getTime()),
          0,
        ) /
          filteredUsers.length /
          60_000,
      )
    : 0;
  const byCity = aggregate(filteredUsers, "city");
  const byUniversity = aggregate(filteredUsers, "university");

  return (
    <>
      <div className="mt-7 flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-kondo-green dark:bg-emerald-400/10">
            <RadioTower className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
          </span>
          <div>
            <p className="font-black text-kondo-ink dark:text-white">
              Presence is updating
            </p>
            <p className="text-xs text-muted-foreground">
              Last refresh {relativeActivity(generatedAt, new Date())} ·
              automatic every minute
            </p>
          </div>
        </div>
        <Button
          disabled={refreshing}
          onClick={() => void refresh()}
          size="sm"
          variant="secondary"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Users}
          label="Online now"
          value={filteredUsers.length.toLocaleString()}
        />
        <MetricCard
          icon={Clock3}
          label="Average current session"
          value={`${averageMinutes} min`}
        />
        <MetricCard icon={Activity} label="Heartbeat window" value="7 min" />
      </section>

      <Card className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Filter
            label="City"
            options={unique(users.map((user) => user.city))}
            value={city}
            onChange={setCity}
          />
          <Filter
            label="University"
            options={unique(users.map((user) => user.university))}
            value={university}
            onChange={setUniversity}
          />
          <Filter
            label="Country"
            options={unique(users.map((user) => user.country))}
            value={country}
            onChange={setCountry}
          />
          <Filter
            label="Role"
            options={unique(users.map((user) => user.role))}
            value={role}
            onChange={setRole}
          />
        </div>
      </Card>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Breakdown
          icon={MapPin}
          items={byCity}
          title="Online by city"
          total={filteredUsers.length}
        />
        <Breakdown
          icon={GraduationCap}
          items={byUniversity}
          title="Online by university"
          total={filteredUsers.length}
        />
      </div>

      <section className="mt-5 space-y-3" aria-live="polite">
        {filteredUsers.map((user) => {
          const estimated = getEstimatedSessionRange(user.connectedAt, now);
          return (
            <Card className="p-4 sm:p-5" key={user.userId}>
              <div className="flex items-start gap-3 sm:gap-4">
                <span className="relative shrink-0">
                  <Avatar
                    className="h-11 w-11 sm:h-12 sm:w-12"
                    firstName={user.firstName}
                    lastName={user.lastName}
                    mediaId={user.avatarMediaId}
                  />
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <p className="truncate font-black text-kondo-ink dark:text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      {user.role.replaceAll("_", " ")}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 sm:ml-auto dark:text-emerald-300">
                      {user.currentPage}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {[user.university, user.city, user.country]
                      .filter(Boolean)
                      .join(" · ") || "Location not specified"}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                    <PresenceDetail
                      label="Last activity"
                      value={relativeActivity(user.lastSeen, now)}
                    />
                    <PresenceDetail
                      label="Estimated online"
                      value={estimated.label}
                    />
                    <PresenceDetail
                      label="Connected at"
                      value={new Intl.DateTimeFormat(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(user.connectedAt))}
                    />
                    <PresenceDetail
                      label="Device"
                      value={`${user.device} · ${user.browser} · ${user.operatingSystem}`}
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {!filteredUsers.length ? (
          <Card className="py-14 text-center">
            <Smartphone className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-black text-kondo-ink dark:text-white">
              No online users match these filters
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Presence updates automatically as members use Kondo.
            </p>
          </Card>
        ) : null}
      </section>
    </>
  );
}

function Filter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
        {label}
      </span>
      <select
        className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-kondo-green"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-kondo-green" />
      </div>
      <p className="mt-3 text-3xl font-black text-kondo-ink dark:text-white">
        {value}
      </p>
    </Card>
  );
}

function Breakdown({
  icon: Icon,
  items,
  title,
  total,
}: {
  icon: typeof MapPin;
  items: Array<[string, number]>;
  title: string;
  total: number;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-kondo-green" />
        <h2 className="font-black text-kondo-ink dark:text-white">{title}</h2>
      </div>
      <div className="mt-4 space-y-3">
        {items.map(([label, count]) => (
          <div key={label}>
            <div className="flex justify-between gap-4 text-xs">
              <span className="truncate font-bold text-muted-foreground">
                {label}
              </span>
              <span className="font-black text-kondo-ink dark:text-white">
                {count}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-kondo-green"
                style={{ width: `${total ? (count / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
        {!items.length ? (
          <p className="py-5 text-center text-sm text-muted-foreground">
            No presence data yet.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function PresenceDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block font-semibold">{label}</span>
      <span className="mt-0.5 block truncate font-bold text-kondo-ink dark:text-white">
        {value}
      </span>
    </div>
  );
}
