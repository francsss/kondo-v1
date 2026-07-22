import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { getAppUrl } from "@/lib/app-url";
import "./globals.css";
import "@livekit/components-styles";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "Kondo — Your student life in China, connected",
    template: "%s · Kondo",
  },
  description:
    "The trusted community, marketplace, and student guide for Africans studying in China.",
  applicationName: "Kondo",
  keywords: [
    "African students in China",
    "student community",
    "China student guide",
    "student marketplace",
  ],
  openGraph: {
    type: "website",
    title: "Kondo — Find your people. Find your way.",
    description:
      "Community, trusted answers, local marketplace, and practical guides for African students in China.",
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
    description: "The digital home for African students in China.",
    images: ["/og.png"],
  },
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
