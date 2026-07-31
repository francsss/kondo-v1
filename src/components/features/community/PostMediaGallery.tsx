"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import {
  lockBodyScroll,
  makeBodySiblingsInert,
} from "@/lib/modal-accessibility";
import { cn } from "@/lib/utils";

export type PostMediaItem = {
  media: { id: string; altText: string | null };
};

export function PostMediaGallery({
  galleryLabel = "Post gallery",
  media,
  immersive = false,
}: {
  galleryLabel?: string;
  media: PostMediaItem[];
  immersive?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const reducedMotion = useReducedMotion();
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;

    const unlockBody = lockBodyScroll();
    const overlay = document.querySelector<HTMLElement>("[data-post-gallery]");
    const restoreSiblings = overlay
      ? makeBodySiblingsInert(overlay)
      : undefined;
    window.setTimeout(
      () => document.getElementById("post-gallery-close")?.focus(),
      40,
    );

    return () => {
      restoreSiblings?.();
      unlockBody();
    };
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeGallery();
      } else if (event.key === "ArrowLeft") {
        showPrevious();
      } else if (event.key === "ArrowRight") {
        showNext();
      } else if (event.key === "+" || event.key === "=") {
        setZoom((value) => Math.min(3, value + 0.5));
      } else if (event.key === "-") {
        setZoom((value) => Math.max(1, value - 0.5));
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function openGallery(index: number) {
    setZoom(1);
    setActiveIndex(index);
  }

  function closeGallery() {
    const trigger =
      activeIndex === null ? null : triggerRefs.current[activeIndex];
    setActiveIndex(null);
    setZoom(1);
    window.setTimeout(() => trigger?.focus(), reducedMotion ? 0 : 220);
  }

  function showPrevious() {
    setZoom(1);
    setActiveIndex((index) =>
      index === null ? null : (index - 1 + media.length) % media.length,
    );
  }

  function showNext() {
    setZoom(1);
    setActiveIndex((index) =>
      index === null ? null : (index + 1) % media.length,
    );
  }

  const activeMedia = activeIndex === null ? null : media[activeIndex]?.media;
  const gridClass =
    media.length === 1
      ? "grid-cols-1"
      : media.length === 2
        ? "grid-cols-2"
        : "grid-cols-2 grid-rows-2";

  return (
    <>
      <div
        className={cn(
          "mt-4 grid max-h-[640px] gap-1.5 overflow-hidden rounded-[1.25rem] bg-muted",
          gridClass,
          immersive && "rounded-[1.5rem]",
        )}
      >
        {media.slice(0, 4).map(({ media: item }, index) => (
          <button
            aria-label={`Open image ${index + 1} of ${media.length}`}
            className={cn(
              "group relative min-h-40 overflow-hidden bg-muted text-left focus-visible:z-10",
              media.length === 1 && "min-h-64 sm:min-h-96",
              media.length === 3 && index === 0 && "row-span-2",
            )}
            key={item.id}
            onClick={() => openGallery(index)}
            ref={(node) => {
              triggerRefs.current[index] = node;
            }}
            type="button"
          >
            <MediaImage
              alt={item.altText ?? `Post image ${index + 1}`}
              className={cn(
                "h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]",
                media.length === 1 && "aspect-[4/3] max-h-[620px]",
              )}
              height={900}
              mediaId={item.id}
              sizes={
                media.length === 1
                  ? "(min-width: 1280px) 860px, 94vw"
                  : "(min-width: 1280px) 430px, 47vw"
              }
              width={1200}
            />
            <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/5" />
            {index === 3 && media.length > 4 ? (
              <span className="absolute inset-0 grid place-items-center bg-black/55 text-2xl font-black text-white backdrop-blur-[2px]">
                +{media.length - 4}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {activeMedia && activeIndex !== null ? (
                <motion.div
                  animate={{ opacity: 1 }}
                  aria-label={galleryLabel}
                  aria-modal="true"
                  className="fixed inset-0 z-[110] flex flex-col overflow-hidden bg-slate-950/95 text-white backdrop-blur-xl"
                  data-post-gallery
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  role="dialog"
                  transition={{ duration: reducedMotion ? 0 : 0.2 }}
                >
                  <div className="relative z-20 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-black/15 px-3 backdrop-blur-xl sm:px-5">
                    <div className="min-w-[82px] shrink-0">
                      <p className="text-sm font-black">{galleryLabel}</p>
                      <p
                        aria-live="polite"
                        className="text-xs font-semibold text-white/55"
                      >
                        {activeIndex + 1} of {media.length}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        aria-label="Zoom out"
                        className="border-white/10 bg-white/10 text-white hover:border-white/20 hover:bg-white/15"
                        disabled={zoom <= 1}
                        onClick={() =>
                          setZoom((value) => Math.max(1, value - 0.5))
                        }
                        size="icon"
                        type="button"
                        variant="secondary"
                      >
                        <Minus aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      <span className="hidden w-12 text-center text-xs font-black tabular-nums sm:block">
                        {Math.round(zoom * 100)}%
                      </span>
                      <Button
                        aria-label="Zoom in"
                        className="border-white/10 bg-white/10 text-white hover:border-white/20 hover:bg-white/15"
                        disabled={zoom >= 3}
                        onClick={() =>
                          setZoom((value) => Math.min(3, value + 0.5))
                        }
                        size="icon"
                        type="button"
                        variant="secondary"
                      >
                        <Plus aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      {zoom > 1 ? (
                        <Button
                          aria-label="Reset zoom"
                          className="border-white/10 bg-white/10 text-white hover:border-white/20 hover:bg-white/15"
                          onClick={() => setZoom(1)}
                          size="icon"
                          type="button"
                          variant="secondary"
                        >
                          <RotateCcw aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        aria-label="Close gallery"
                        className="ml-1 border-white/10 bg-white/10 text-white hover:border-white/20 hover:bg-white/15"
                        id="post-gallery-close"
                        onClick={closeGallery}
                        size="icon"
                        type="button"
                        variant="secondary"
                      >
                        <X aria-hidden="true" className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div
                    className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden px-2 py-4 sm:px-16"
                    onDoubleClick={() =>
                      setZoom((value) => (value > 1 ? 1 : 2))
                    }
                    onWheel={(event) => {
                      event.preventDefault();
                      setZoom((value) =>
                        Math.min(
                          3,
                          Math.max(
                            1,
                            value + (event.deltaY < 0 ? 0.25 : -0.25),
                          ),
                        ),
                      );
                    }}
                  >
                    {media.length > 1 ? (
                      <>
                        <Button
                          aria-label="Previous image"
                          className="absolute left-3 z-20 hidden border-white/10 bg-black/30 text-white backdrop-blur hover:border-white/20 hover:bg-black/50 sm:inline-flex"
                          onClick={showPrevious}
                          size="icon"
                          type="button"
                          variant="secondary"
                        >
                          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                        </Button>
                        <Button
                          aria-label="Next image"
                          className="absolute right-3 z-20 hidden border-white/10 bg-black/30 text-white backdrop-blur hover:border-white/20 hover:bg-black/50 sm:inline-flex"
                          onClick={showNext}
                          size="icon"
                          type="button"
                          variant="secondary"
                        >
                          <ChevronRight
                            aria-hidden="true"
                            className="h-5 w-5"
                          />
                        </Button>
                      </>
                    ) : null}

                    <motion.div
                      animate={{ opacity: 1, scale: zoom, y: 0 }}
                      className="flex h-full w-full items-center justify-center"
                      drag
                      dragConstraints={
                        zoom > 1
                          ? { bottom: 240, left: -280, right: 280, top: -240 }
                          : { bottom: 160, left: -180, right: 180, top: -160 }
                      }
                      dragElastic={zoom > 1 ? 0.12 : 0.55}
                      dragSnapToOrigin={zoom === 1}
                      exit={{
                        opacity: 0,
                        scale: reducedMotion ? 1 : 0.94,
                        y: reducedMotion ? 0 : 14,
                      }}
                      initial={{
                        opacity: 0,
                        scale: reducedMotion ? 1 : 0.94,
                        y: reducedMotion ? 0 : 14,
                      }}
                      key={activeMedia.id}
                      onDragEnd={(_, info) => {
                        if (zoom > 1) return;
                        if (
                          Math.abs(info.offset.y) >
                            Math.abs(info.offset.x) * 1.15 &&
                          Math.abs(info.offset.y) > 105
                        ) {
                          closeGallery();
                        } else if (
                          info.offset.x < -75 ||
                          info.velocity.x < -600
                        ) {
                          showNext();
                        } else if (
                          info.offset.x > 75 ||
                          info.velocity.x > 600
                        ) {
                          showPrevious();
                        }
                      }}
                      transition={{
                        duration: reducedMotion ? 0 : 0.22,
                        ease: "easeOut",
                      }}
                    >
                      <MediaImage
                        alt={activeMedia.altText ?? `${galleryLabel} image`}
                        className="max-h-full max-w-full select-none object-contain drop-shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
                        height={1600}
                        mediaId={activeMedia.id}
                        priority
                        sizes="100vw"
                        width={2200}
                      />
                    </motion.div>
                  </div>

                  <div className="relative z-20 flex h-12 shrink-0 items-center justify-center gap-1.5 border-t border-white/10 bg-black/15 px-4 backdrop-blur-xl">
                    {media.length > 1
                      ? media.map(({ media: item }, index) => (
                          <button
                            aria-label={`Show image ${index + 1}`}
                            aria-pressed={index === activeIndex}
                            className={cn(
                              "h-1.5 rounded-full transition-all",
                              index === activeIndex
                                ? "w-6 bg-white"
                                : "w-1.5 bg-white/30 hover:bg-white/60",
                            )}
                            key={item.id}
                            onClick={() => {
                              setZoom(1);
                              setActiveIndex(index);
                            }}
                            type="button"
                          />
                        ))
                      : null}
                    <p className="absolute right-4 hidden text-[11px] font-semibold text-white/45 sm:block">
                      Double-click or scroll to zoom
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
