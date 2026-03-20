# Stage 1: Build
FROM node:18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# API URL vazia = chamadas relativas (proxy pelo nginx)
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Stage 2: Serve com nginx
FROM nginx:alpine

# Copiar build do Vite (outDir: ../dist relativo ao frontend)
COPY --from=build /dist /usr/share/nginx/html

# Config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint que substitui BACKEND_URL no nginx.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
