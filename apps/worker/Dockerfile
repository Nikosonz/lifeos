# Production image for @lifeos/worker. Build from the REPO ROOT (needs
# access to packages/*), e.g.:
#   docker build -f apps/worker/Dockerfile -t lifeos-worker .
#
# The worker is currently a placeholder (see CLAUDE.md Known Limitations) —
# this image exists so the deploy pipeline has something real to build and
# run, not because there are real jobs yet.
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY .npmrc package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

FROM base AS builder
COPY --from=deps /app ./
COPY . .
RUN npm run build --workspace=@lifeos/worker

# Separate prod-only install: `deps` above includes devDependencies (tsup,
# typescript, ...) needed to build but not to run — reusing it wholesale in
# the runner bloated the image to 1.29GB, most of it dead build tooling.
# `--omit=dev` alone only trims that to ~1.1GB, not further: this repo has
# ONE shared package-lock.json for all workspaces (npm workspaces, no
# Turborepo/pnpm — see CLAUDE.md), so any root `npm ci` installs every
# workspace's regular dependencies, not just @lifeos/worker's. Measured
# directly (`du -sh node_modules/*` inside the built image): ~420MB is
# next+@swc, ~43MB @prisma, ~33MB @img (sharp) — all apps/web's
# dependencies, none of which the worker imports. A real fix needs
# workspace-aware pruning (Turborepo `prune`, pnpm, or a hand-rolled
# post-install prune script) — deliberately not built now, matching this
# project's "add Turborepo later only if build times/output size actually
# demand it" stance. Revisit once the worker has real jobs; a placeholder
# doesn't justify that complexity yet.
FROM base AS prod-deps
COPY .npmrc package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001
COPY --from=prod-deps --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/apps/worker/package.json ./package.json
USER worker
CMD ["node", "dist/index.js"]
