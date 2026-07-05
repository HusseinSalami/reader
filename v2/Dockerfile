FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  libvips-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY dist/ ./dist/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/server.js"]
