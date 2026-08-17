FROM node:22.23.1-alpine AS deps
WORKDIR /app
RUN npm install --global pnpm@11.17.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22.23.1-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@11.17.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22.23.1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=8080

RUN addgroup -S nodejs && adduser -S fogewise -G nodejs

COPY --from=build --chown=fogewise:nodejs /app/public ./public
COPY --from=build --chown=fogewise:nodejs /app/.next/standalone ./
COPY --from=build --chown=fogewise:nodejs /app/.next/static ./.next/static

USER fogewise
EXPOSE 8080
CMD ["node", "server.js"]
