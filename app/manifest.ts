import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kondo",
    short_name: "Kondo",
    description:
      "Community, student tools and trusted local discovery for international students in China.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f8f7f2",
    theme_color: "#0f8a64",
    icons: [
      {
        src: "/kondo-mark.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
