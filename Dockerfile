FROM node:24-alpine AS dependencies
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY tsconfig.json tsconfig.build.json ./
COPY apps ./apps
COPY src ./src
COPY packages ./packages
RUN pnpm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S pms && adduser -S -G pms pms
COPY --from=dependencies /workspace/node_modules ./node_modules
COPY --from=build /workspace/dist ./dist
COPY database/migrations ./database/migrations
COPY package.json ./package.json
USER pms
EXPOSE 3001
CMD ["node", "dist/apps/api/src/main.js"]
