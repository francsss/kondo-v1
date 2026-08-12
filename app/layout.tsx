import type { Metadata, Viewport } from "next";
import { ProductAnalyticsLifecycle } from "@/components/analytics/ProductAnalytics";
import { MobileViewportStabilizer } from "@/components/app/MobileViewportStabilizer";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { getAppUrl } from "@/lib/app-url";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "@livekit/components-styles";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "Kondo — Your campus companion in China",
    template: "%s · Kondo",
  },
  description:
    "The digital ecosystem for international students in China — community, marketplace, and student guides before, during, and after your studies.",
  applicationName: "Kondo",
  manifest: "/manifest.webmanifest",
  keywords: [
    "international students in China",
    "study in China",
    "student community",
    "China student guide",
    "student marketplace",
    "foreign students China",
  ],
  openGraph: {
    type: "website",
    title: "Kondo — Find your people. Find your way.",
    description:
      "Community, trusted answers, local marketplace, and practical guides for international students in China.",
    siteName: "Kondo",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 627,
        alt: "Kondo — Find your people. Find your way.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kondo — Find your people. Find your way.",
    description: "The digital ecosystem for international students in China.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The mobile keyboard resizes the layout instead of overlaying it, so a
  // bottom-anchored composer stays above the keyboard the way a native chat
  // app behaves, rather than being covered and pushed out of view.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1412" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableColorScheme
          enableSystem
          disableTransitionOnChange
        >
          <MobileViewportStabilizer />
          <ProductAnalyticsLifecycle />
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
