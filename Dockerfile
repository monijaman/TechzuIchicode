# Application image scaffold.
# This expects a Node.js application in ./backend with package.json and package-lock.json.

FROM node:20-alpine AS dependencies
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY backend/ ./
EXPOSE 5000
CMD ["npm", "start"]
