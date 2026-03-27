FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN node_modules/.bin/tsc -p tsconfig.json

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./dist/src/generated
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/src/server.js"]