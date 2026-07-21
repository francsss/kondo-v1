"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
  _count: { listings: number };
};

export function MarketplaceCategoryManager({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function request(url: string, method: string, body?: unknown) {
    setPending(true);
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setPending(false);
    setMessage(
      response?.ok
        ? "Categories updated."
        : (payload?.error ?? "Could not update categories."),
    );
    if (response?.ok) router.refresh();
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("/api/admin/marketplace/categories", "POST", {
      name: form.get("name"),
      slug: form.get("slug"),
      icon: form.get("icon") || null,
      description: form.get("description") || null,
      order: Number(form.get("order")),
      isActive: true,
    });
  }

  async function update(
    event: React.FormEvent<HTMLFormElement>,
    category: Category,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request(`/api/admin/marketplace/categories/${category.id}`, "PATCH", {
      slug: form.get("slug"),
      name: form.get("name"),
      description: form.get("description") || null,
      icon: form.get("icon") || null,
      order: Number(form.get("order")),
      isActive: form.get("isActive") === "on",
    });
  }

  return (
    <Card className="mt-7">
      <h2 className="font-black text-kondo-ink dark:text-white">Categories</h2>
      <form
        className="mt-4 grid gap-3 lg:grid-cols-[90px_1fr_1fr_1.5fr_90px_auto]"
        onSubmit={create}
      >
        <input
          className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          maxLength={8}
          name="icon"
          placeholder="Icon"
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          minLength={2}
          name="name"
          placeholder="Category name"
          required
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          maxLength={80}
          name="slug"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="category-slug"
          required
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          maxLength={300}
          name="description"
          placeholder="Description"
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          defaultValue={categories.length}
          min={0}
          name="order"
          type="number"
        />
        <Button disabled={pending} size="sm" type="submit">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>
      <div className="mt-5 divide-y divide-slate-100 dark:divide-white/10">
        {categories.map((category) => (
          <form
            className="grid gap-3 py-4 first:pt-0 lg:grid-cols-[90px_1fr_1fr_1.5fr_90px_auto_auto_auto] lg:items-center"
            key={category.id}
            onSubmit={(event) => update(event, category)}
          >
            <input
              className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              defaultValue={category.icon ?? ""}
              maxLength={8}
              name="icon"
              placeholder="Icon"
            />
            <input
              className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              defaultValue={category.name}
              minLength={2}
              name="name"
              required
            />
            <input
              className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              defaultValue={category.slug}
              maxLength={80}
              name="slug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
            <input
              className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              defaultValue={category.description ?? ""}
              maxLength={300}
              name="description"
              placeholder="Description"
            />
            <input
              className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
              defaultValue={category.order}
              min={0}
              name="order"
              type="number"
            />
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                defaultChecked={category.isActive}
                name="isActive"
                type="checkbox"
              />
              Active
            </label>
            <Button
              disabled={pending}
              size="sm"
              type="submit"
              variant="secondary"
            >
              Save
            </Button>
            <Button
              aria-label={`Delete ${category.name}`}
              disabled={pending || category._count.listings > 0}
              onClick={() =>
                request(
                  `/api/admin/marketplace/categories/${category.id}`,
                  "DELETE",
                )
              }
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground lg:col-span-full">
              {category._count.listings} listings use this category.
            </p>
          </form>
        ))}
      </div>
      {message ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </Card>
  );
}
