# DebtFlow Web — production image: build tĩnh → Nginx (serve SPA + proxy /api).
# Build context: repo root.

# ---------- Builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

# Build shared (typecheck cần dist .d.ts) rồi build web.
RUN npm run build --workspace packages/shared \
  && npm run build --workspace apps/web

# ---------- Runtime: Nginx ----------
FROM nginx:1.27-alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
