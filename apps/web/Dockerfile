# Production image for @lifeos/web. Build from the REPO ROOT (needs access
# to packages/*), e.g.:
#   docker build -f apps/web/Dockerfile -t lifeos-web .
#
# Alpine + the linux-musl-openssl-3.0.x binary target already declared in
# packages/db/prisma/schema.prisma — no Prisma client regeneration needed
# for this base image (see the deployment skill).
FROM node:22-alpine AS base
WORKDIR /app

# --- deps: install once, cached independently of app source changes ---
FROM base AS deps
COPY .npmrc package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

# --- builder: generate the Prisma client, build the Next.js app ---
FROM base AS builder
COPY --from=deps /app ./
COPY . .
RUN npm run db:generate --workspace=@lifeos/db
# Next.js needs a syntactically valid JWT secret to build (no real DB/auth
# calls happen at build time) — same placeholder shape as CI's build job.
# The REAL secret is injected as a runtime env var (see docker-compose.prod.yml),
# never baked into this image layer.
ARG JWT_ACCESS_SECRET=docker-build-placeholder-secret-at-least-32-chars
ENV JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
RUN npm run build --workspace=@lifeos/web

# --- runner: minimal runtime image, no source/devDependencies ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# .next/standalone contains server.js + a trimmed node_modules + whatever
# @vercel/nft traced as a genuine runtime need (confirmed locally: this
# includes packages/db/generated/prisma, since Prisma's generated client
# loads its native engine binary via a dynamic, non-statically-bundleable
# require() — Turbopack inlines packages/core and packages/contracts
# directly into the compiled route handlers, so neither needs to appear
# here separately). .next/static is deliberately NOT included by NFT
# tracing and must be copied separately, per Next's own standalone docs.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# public/ is NOT copied by NFT tracing either, for the same reason .next/static
# isn't — Next's own output docs: "This minimal server does not copy the public
# or .next/static folders by default." This line was absent until 2026-08-27
# and cost nothing only because apps/web had no public/ directory at all. It
# does now (the Open Graph cards), and without this COPY they 404 in production
# while working perfectly under `next dev` — the worst shape of bug, since
# nothing local reproduces it. Verify with a curl from INSIDE the container.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
