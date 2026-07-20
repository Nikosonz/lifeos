import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output traces only the files apps/web's server actually
  // needs (via @vercel/nft) into .next/standalone, so the production image
  // doesn't need a full `npm install` or the monorepo's dev node_modules —
  // see the deployment skill and the production Dockerfile.
  output: "standalone",
};

export default withNextIntl(nextConfig);
