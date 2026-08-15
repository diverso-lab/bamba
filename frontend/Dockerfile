# ---------- base ----------
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- dev (hot reload) ----------
FROM base AS dev
ENV CHOKIDAR_USEPOLLING=true
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---------- build ----------
FROM base AS build
COPY . .
RUN npm run build

# ---------- prod (nginx) ----------
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
