import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * The last resort, for a URL that matches no route at all.
 *
 * Next's built-in 404 has no styling and, more importantly, no link anywhere —
 * a member who mistyped a path inside one of Kondo's dedicated spaces landed
 * on a bare page with neither the space's navigation nor the control that
 * leaves it, and had to use the browser's own back button to escape the app.
 *
 * Segment-level not-found files handle a `notFound()` thrown by a page that
 * did match. This handles the case where nothing matched, which is the one
 * they cannot reach. Deliberately self-contained: it renders outside every
 * layout, so it assumes no shell, no session, and no provider.
 */
export default function RootNotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        textAlign: "center",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        background: "#faf9f5",
        color: "#14201b",
      }}
    >
      <div style={{ maxWidth: "26rem" }}>
        <p style={{ fontSize: "2.5rem", margin: 0 }} aria-hidden="true">
          🧭
        </p>
        <h1
          style={{
            marginTop: "1rem",
            fontSize: "1.35rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            marginTop: "0.5rem",
            fontSize: "0.9rem",
            lineHeight: 1.6,
            color: "#5c6b64",
          }}
        >
          This page may have moved, or the link may be incomplete.
        </p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link
            href="/home"
            style={{
              display: "inline-block",
              padding: "0.7rem 1.4rem",
              borderRadius: "999px",
              background: "#136b4f",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.9rem",
              textDecoration: "none",
            }}
          >
            Return to Kondo
          </Link>
        </p>
      </div>
    </main>
  );
}
