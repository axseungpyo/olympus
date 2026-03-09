FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx next build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 7777
ENV NODE_ENV=production
CMD ["npx", "tsx", "server/index.ts"]
