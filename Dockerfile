# ---- build stage ----
FROM node:24-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:24-alpine
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./dist
COPY frontend /app/frontend

ENV NODE_ENV=production
ENV PORT=4480
ENV DB_PATH=/app/data/homeblock.db
EXPOSE 4480
CMD ["node", "dist/index.js"]
