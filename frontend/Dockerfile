# --- eInvoices.world frontend (multi-stage) ---
FROM node:20-alpine AS builder

WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=4096

# The public API URL that the SPA will hit at runtime. Baked at build time
# because create-react-app inlines REACT_APP_* into the bundle.
ARG REACT_APP_BACKEND_URL=/
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY . .
RUN yarn build

# --- Runtime: nginx serves the built SPA + proxies /api to backend ---
FROM nginx:1.27-alpine AS runtime

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=10s \
    CMD wget -qO- http://localhost/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
