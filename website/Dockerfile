FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY website/package.json website/package.json
COPY extension/package.json extension/package.json

RUN npm ci

COPY website website

ARG VITE_PAUSETAB_API_BASE_URL
ARG VITE_PAUSETAB_SUPPORT_EMAIL

ENV VITE_PAUSETAB_API_BASE_URL=${VITE_PAUSETAB_API_BASE_URL}
ENV VITE_PAUSETAB_SUPPORT_EMAIL=${VITE_PAUSETAB_SUPPORT_EMAIL}

RUN npm run build --workspace website

FROM nginx:1.29-alpine AS runtime

COPY website/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/website/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
