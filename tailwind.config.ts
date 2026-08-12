import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        // Large phones, where a top-bar action has room for its label.
        xs: "400px",
      },
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          foreground: "rgb(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          foreground: "rgb(var(--warning-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--info) / <alpha-value>)",
          foreground: "rgb(var(--info-foreground) / <alpha-value>)",
        },
        ring: "rgb(var(--ring) / <alpha-value>)",
        overlay: "rgb(var(--overlay) / <alpha-value>)",
        kondo: {
          ink: "#101828",
          navy: "#173B35",
          forest: "#165B4A",
          green: "rgb(var(--brand) / <alpha-value>)",
          mint: "#DFF7EC",
          lime: "#DDF58A",
          sand: "#F8F7F2",
          cloud: "#F2F4F0",
          muted: "#667085",
        },
      },
      boxShadow: {
        soft: "0 18px 50px rgba(16, 24, 40, 0.08)",
        lift: "0 24px 70px rgba(20, 71, 58, 0.14)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "overlay-in": {
          from: { opacity: "0", transform: "scale(0.99)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "sheet-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        "overlay-in": "overlay-in 160ms ease-out",
        "sheet-in": "sheet-in 200ms cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
