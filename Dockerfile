FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY backend/prisma ./prisma
COPY backend/prisma.config.ts backend/tsconfig.json ./
COPY backend/src ./src

# Generate only reads the schema. This placeholder is not a real credential.
# The real DATABASE_URL is supplied by Render at runtime.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run prisma:generate
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node
CMD ["node", "dist/server.js"]
