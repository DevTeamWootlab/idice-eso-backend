FROM node:26-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install --global yarn@1.22.22
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN yarn build

FROM node:26-bookworm-slim AS production-dependencies
WORKDIR /app
RUN npm install --global yarn@1.22.22
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node scripts/start-container.sh scripts/run-production-bootstrap.mjs ./scripts/
RUN chmod 0555 ./scripts/start-container.sh ./scripts/run-production-bootstrap.mjs && mkdir -p logs && chown -R node:node logs
USER node
EXPOSE 3000
CMD ["./scripts/start-container.sh"]
