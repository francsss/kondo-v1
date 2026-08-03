"use client";

import { motion } from "framer-motion";

export function HomeFeedReveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      className="motion-reduce:!transform-none motion-reduce:!opacity-100"
      data-home-feed-reveal=""
      initial={{ opacity: 0, y: 18 }}
      transition={{
        delay,
        duration: 0.36,
        ease: [0.22, 1, 0.36, 1],
      }}
      viewport={{ amount: 0.12, margin: "0px 0px -5% 0px", once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}
