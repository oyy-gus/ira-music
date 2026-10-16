FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache font-noto-emoji ttf-dejavu fontconfig

ENV NODE_ENV=production

COPY --from=builder /app /app

EXPOSE 3000

CMD ["node", "src/index.js"]
