FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

# VITE_API_URL is baked in at build time
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# Production: serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Railway provides $PORT — start.sh substitutes it into nginx config
COPY railway-start.sh /docker-entrypoint.d/30-railway-port.sh
RUN chmod +x /docker-entrypoint.d/30-railway-port.sh

EXPOSE 80
