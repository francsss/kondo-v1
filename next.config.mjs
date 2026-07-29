import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const isDevelopment = process.env.NODE_ENV === "development";
const hasSecurePublicOrigin =
  process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false;
const projectRoot = dirname(fileURLToPath(import.meta.url));
const configuredDevOrigins = (process.env.KONDO_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const baiduDevelopmentSources = isDevelopment
  ? " http://api.map.baidu.com http://*.baidu.com http://*.bdimg.com http://*.bcebos.com"
  : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  // JSAPI 4 compiles Baidu's vector renderer from WebAssembly. In production,
  // blocking Wasm compilation lets the SDK and logo load but prevents the map
  // from ever creating its drawable canvas. `wasm-unsafe-eval` permits Wasm
  // compilation without enabling arbitrary JavaScript eval.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://*.posthog.com https://api.map.baidu.com https://*.baidu.com https://*.bdimg.com https://*.bcebos.com${baiduDevelopmentSources}${isDevelopment ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline' https://api.map.baidu.com https://*.baidu.com https://*.bdimg.com https://*.bcebos.com${baiduDevelopmentSources}`,
  `img-src 'self' data: blob: https:${isDevelopment ? " http:" : ""}`,
  "font-src 'self' data:",
  // Baidu's vector worker fetches generated data/blob texture URLs while
  // decoding tiles. These are worker-local map assets, not remote endpoints.
  `connect-src 'self' data: blob: https: wss:${isDevelopment ? " http: ws:" : ""}`,
  // Baidu JSAPI 4 decodes its vector tiles inside Web Workers loaded from
  // api.map.baidu.com. Blocking that worker leaves only the Baidu logo and an
  // empty map surface even though the SDK callback and Map constructor succeed.
  "worker-src 'self' blob: data: https://api.map.baidu.com",
  // Safari versions that predate CSP worker-src use child-src as the worker
  // fallback. Keep this list deliberately narrower than script-src.
  "child-src 'self' blob: https://api.map.baidu.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(!isDevelopment && hasSecurePublicOrigin
    ? ["upgrade-insecure-requests"]
    : []),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.*.*", ...configuredDevOrigins],
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: [
    "@napi-rs/canvas",
    "pdf-to-img",
    "pdfjs-dist",
    "tesseract.js",
  ],
  outputFileTracingIncludes: {
    "/api/student-hub/imports/*/analyze": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/idb-keyval/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/node-fetch/**/*",
      "./node_modules/pdf-to-img/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/zlibjs/**/*",
      "./vendor/tessdata/**/*",
    ],
  },
  turbopack: {
    root: projectRoot,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
