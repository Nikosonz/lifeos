import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy. Two entries here are concessions to Next.js
// itself rather than choices:
//   - 'unsafe-inline' on script-src: Next's App Router inlines bootstrap
//     and flight-payload scripts on every page. Removing it needs
//     per-request nonces threaded through a middleware, which proxy.ts
//     can't do today (its matcher is next-intl's, and nonces can't be set
//     from a static config). Tracked as the next tightening step, not
//     shipped as one.
//   - 'unsafe-inline' on style-src: Tailwind v4 emits inline style
//     attributes, and next/font injects an inline <style> block.
// 'unsafe-eval' is dev-only (React Refresh needs it); production drops it.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  // data: covers the self-hosted Vazirmatn woff2 files being inlined by
  // next/font in some builds; blob: covers Next's image optimizer.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Same-origin only — matching ADR-0019's "no browser cross-origin
  // caller exists" finding from the CSP side as well as the CORS side.
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output traces only the files apps/web's server actually
  // needs (via @vercel/nft) into .next/standalone, so the production image
  // doesn't need a full `npm install` or the monorepo's dev node_modules —
  // see the deployment skill and the production Dockerfile.
  output: "standalone",

  // The only layer that can set these today: proxy.ts's matcher
  // deliberately excludes /api (Bearer auth isn't a middleware concern),
  // and docker-compose.prod.yml publishes port 3000 with no reverse proxy
  // in front. Next's headers() config is independent of the middleware
  // matcher, so `source: "/:path*"` genuinely covers /api/v1 too —
  // including runRoute's error envelopes. See ADR-0019.
  //
  // **There are deliberately no Access-Control-* headers here.** That is a
  // decision (ADR-0019), not an omission: /api/v1 has no browser
  // cross-origin caller — apps/web fetches it with root-relative paths,
  // and the Flutter client is native Dio with no web target — so opening
  // CORS today would widen the attack surface for a capability nothing
  // uses. If a browser client ever fails here with a CORS error, that
  // failure is the intended signal to go read ADR-0019 and decide
  // properly, not to add a permissive header as a bug-fix reflex.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // frame-ancestors above supersedes this for modern browsers;
          // kept for older ones that never implemented it.
          { key: "X-Frame-Options", value: "DENY" },
          // The app requests none of these. Denying them outright means a
          // future dependency can't quietly start asking.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Production only, and deliberately: a max-age this long served
          // over plain http://localhost would pin the dev machine's
          // browser to HTTPS for two years and break local dev in a way
          // that's genuinely painful to undo. No preload directive —
          // submitting to the preload list is irreversible on a timescale
          // this project can't yet commit to, and there's no domain
          // deployed to submit.
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
