"use client";

import { motion, useReducedMotion } from "framer-motion";

export function HomeFeedReveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      data-home-feed-reveal=""
      initial={reducedMotion ? false : { opacity: 0, scale: 0.992, y: 14 }}
      transition={{
        delay: reducedMotion ? 0 : delay,
        duration: reducedMotion ? 0 : 0.42,
        ease: [0.22, 1, 0.36, 1],
      }}
      viewport={{ amount: 0.1, margin: "0px 0px -5% 0px", once: true }}
      whileInView={reducedMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}
