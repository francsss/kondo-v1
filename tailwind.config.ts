import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kondo: {
          ink: "#101828",
          navy: "#173B35",
          forest: "#165B4A",
          green: "#10A36D",
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
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
