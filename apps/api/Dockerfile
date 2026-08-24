# DebtFlow API — production image (multi-stage).
# Build context: repo root.

# ---------- Builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npx prisma generate --schema=apps/api/prisma/schema.prisma \
  && npm run build --workspace packages/shared \
  && npm run build --workspace apps/api \
  # Biên dịch seed.ts → seed.js để prod seed bằng `node` (ts-node là devDep, sẽ bị prune).
  && npx tsc apps/api/prisma/seed.ts --esModuleInterop --module commonjs --target ES2022 \
       --skipLibCheck --outDir apps/api/prisma \
  # Bỏ devDependencies — prisma CLI nằm ở dependencies nên vẫn còn cho migrate deploy.
  && npm prune --omit=dev \
  && npx prisma generate --schema=apps/api/prisma/schema.prisma

# ---------- Runtime ----------
FROM node:22-alpine
WORKDIR /app
# openssl cho Prisma; postgresql-client (psql) + gzip cho tính năng khôi phục backup.
RUN apk add --no-cache openssl postgresql-client gzip
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
