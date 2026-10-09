FROM node:24-alpine AS dependencies
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/pms-api-client/package.json ./packages/pms-api-client/package.json
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS production-dependencies
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/pms-api-client/package.json ./packages/pms-api-client/package.json
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY tsconfig.json tsconfig.build.json ./
COPY apps ./apps
COPY src ./src
COPY libs ./libs
COPY packages ./packages
RUN pnpm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Every runtime entrypoint is a plain `node dist/...` command, so the bundled
# package managers are dead weight whose transitive dependencies would ship
# their vulnerabilities in the scanned image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
RUN addgroup -S pms && adduser -S -G pms pms
COPY --from=production-dependencies /workspace/node_modules ./node_modules
COPY --from=build /workspace/dist ./dist
COPY database/migrations ./database/migrations
COPY database/seeds ./database/seeds
COPY package.json ./package.json
USER pms
EXPOSE 3001
CMD ["node", "dist/apps/api/src/main.js"]
