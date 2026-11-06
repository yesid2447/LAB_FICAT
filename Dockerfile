FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 4500
CMD ["node", "app.js"]
