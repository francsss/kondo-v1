"use client";

import { ImagePlus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { uploadPublicImage } from "@/lib/client-media";
import { getMarketplaceSubmitIntent } from "@/lib/marketplace-form";

type Option = { id: string; name: string };

export function ListingForm({
  categories,
  cities,
  listing,
}: {
  categories: Option[];
  cities: Option[];
  listing?: {
    id: string;
    slug: string;
    categoryId: string;
    cityId: string;
    title: string;
    description: string;
    priceFen: number;
    isNegotiable: boolean;
    imageCount: number;
  };
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      (HTMLElement & { name?: string; value?: string }) | null;
    const intent = getMarketplaceSubmitIntent(submitter);
    if (!intent) {
      setError("Choose whether to save a draft or publish the listing.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const publish = intent === "publish";
    if (!listing && publish && !images.length) {
      setError("Add at least one image before publishing.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const title = String(form.get("title") ?? "");
      const imageIds = [];
      for (const [index, image] of images.entries()) {
        imageIds.push(
          await uploadPublicImage(
            image,
            "LISTING_IMAGE",
            `${title} listing image ${index + 1}`,
          ),
        );
      }
      const payload = {
        categoryId: form.get("categoryId"),
        cityId: form.get("cityId"),
        title,
        description: form.get("description"),
        priceFen: Math.round(Number(form.get("price")) * 100),
        isNegotiable: form.get("isNegotiable") === "on",
        expiresInDays: Number(form.get("expiresInDays")),
        ...(images.length ? { imageIds } : {}),
        ...(!listing ? { publish } : {}),
      };
      const response = await fetch(
        listing ? `/api/marketplace/${listing.id}` : "/api/marketplace",
        {
          method: listing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error ?? "Could not save the listing.");
      }
      if (listing) {
        router.push("/marketplace/selling");
      } else if (result.requiresReview || !publish) {
        router.push("/marketplace/selling");
      } else {
        router.push(`/marketplace/${result.listing.slug}`);
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save the listing.",
      );
    } finally {
      setPending(false);
    }
  }

  function selectImages(files: FileList | null) {
    const selected = Array.from(files ?? []).slice(0, 8);
    setImages(selected);
    setError(
      (files?.length ?? 0) > 8
        ? "A listing can contain up to eight images."
        : "",
    );
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-bold">Category</span>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={listing?.categoryId}
            name="categoryId"
            required
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold">City</span>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={listing?.cityId}
            name="cityId"
            required
          >
            <option value="">Choose a city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-bold">Title</span>
        <input
          className="h-12 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
          defaultValue={listing?.title}
          maxLength={140}
          minLength={3}
          name="title"
          required
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-bold">Description</span>
        <textarea
          className="min-h-40 w-full rounded-2xl border border-slate-200 bg-transparent p-4 text-sm leading-6 outline-none focus:border-kondo-green dark:border-white/10"
          defaultValue={listing?.description}
          maxLength={5000}
          minLength={10}
          name="description"
          required
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-bold">Price (CNY)</span>
          <input
            className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
            defaultValue={listing ? listing.priceFen / 100 : undefined}
            min={0}
            name="price"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold">Expires after</span>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue="30"
            name="expiresInDays"
          >
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          defaultChecked={listing?.isNegotiable}
          name="isNegotiable"
          type="checkbox"
        />
        Price is negotiable
      </label>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        multiple
        onChange={(event) => selectImages(event.target.files)}
        ref={input}
        type="file"
      />
      <button
        className="flex w-full items-center gap-3 rounded-3xl border border-dashed border-slate-300 p-5 text-left text-sm transition hover:border-kondo-green dark:border-white/15"
        onClick={() => input.current?.click()}
        type="button"
      >
        <ImagePlus className="h-6 w-6 text-kondo-green" />
        <span>
          {images.length
            ? `${images.length} new image${images.length === 1 ? "" : "s"} selected`
            : listing?.imageCount
              ? `Keep ${listing.imageCount} current image${listing.imageCount === 1 ? "" : "s"}, or select replacements`
              : "Add 1–8 validated images"}
        </span>
      </button>
      <p className="text-xs leading-5 text-slate-400">
        Kondo never handles payment. Do not request deposits, gift cards,
        cryptocurrency, or off-platform advance transfers.
      </p>
      {error ? (
        <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        {!listing ? (
          <Button
            disabled={pending}
            name="intent"
            type="submit"
            value="draft"
            variant="secondary"
          >
            Save draft
          </Button>
        ) : null}
        <Button
          disabled={pending}
          name="intent"
          type="submit"
          value={listing ? "save" : "publish"}
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : listing ? "Save changes" : "Publish listing"}
        </Button>
      </div>
    </form>
  );
}
