FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

# Railway provides $PORT — server.js binds to it
CMD ["node", "server.js"]
