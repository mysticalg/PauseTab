FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY website/package.json website/package.json
COPY extension/package.json extension/package.json

RUN npm ci

COPY backend backend

RUN npm run build --workspace backend

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist

WORKDIR /app/backend

EXPOSE 8787

CMD ["node", "dist/index.js"]
