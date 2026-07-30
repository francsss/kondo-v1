"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrganizationPublicProfileDTO } from "@/lib/organization-public-profile";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export function OrganizationGallery({
  organizationType,
  images,
}: {
  organizationType: string;
  images: OrganizationPublicProfileDTO["gallery"];
}) {
  const [active, setActive] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => {
    const previous = active;
    setActive(null);
    window.requestAnimationFrame(() => {
      if (previous !== null) triggerRefs.current[previous]?.focus();
    });
  }, [active]);

  useEffect(() => {
    if (active === null) return;
    window.requestAnimationFrame(() => closeRef.current?.focus());
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight")
        setActive((current) =>
          current === null ? null : (current + 1) % images.length,
        );
      if (event.key === "ArrowLeft")
        setActive((current) =>
          current === null
            ? null
            : (current - 1 + images.length) % images.length,
        );
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [active, close, images.length]);

  function open(index: number) {
    setActive(index);
    captureProductEvent(PRODUCT_EVENTS.ORGANIZATION_GALLERY_OPENED, {
      organization_type: organizationType,
      image_count: images.length,
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <button
            className={`group relative overflow-hidden rounded-3xl bg-muted text-left ${
              index === 0 && images.length > 2
                ? "col-span-2 row-span-2 sm:col-span-2"
                : ""
            }`}
            key={image.id}
            onClick={() => open(index)}
            ref={(node) => {
              triggerRefs.current[index] = node;
            }}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={image.altText}
              className="aspect-[4/3] h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
              loading={index > 2 ? "lazy" : "eager"}
              src={image.url}
            />
            {image.caption ? (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-8 text-xs font-bold text-white">
                {image.caption}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {active !== null ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[110] grid place-items-center bg-black/90 p-4 backdrop-blur-md"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={close}
            role="presentation"
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
          >
            <button
              aria-label="Close gallery"
              className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur"
              onClick={close}
              ref={closeRef}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
            {images.length > 1 ? (
              <>
                <button
                  aria-label="Previous image"
                  className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white sm:left-6"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActive((active - 1 + images.length) % images.length);
                  }}
                  type="button"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  aria-label="Next image"
                  className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white sm:right-6"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActive((active + 1) % images.length);
                  }}
                  type="button"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
            <motion.figure
              animate={{ opacity: 1, scale: 1 }}
              className="max-h-[88dvh] max-w-6xl"
              initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={images[active]!.altText}
                className="max-h-[80dvh] max-w-full rounded-2xl object-contain shadow-2xl"
                src={images[active]!.url}
              />
              {images[active]!.caption ? (
                <figcaption className="mx-auto mt-3 max-w-2xl text-center text-sm text-white/75">
                  {images[active]!.caption}
                </figcaption>
              ) : null}
            </motion.figure>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
