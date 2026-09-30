# Base  stage for building and dev
FROM node:26-alpine AS base
# Set the working directory to /app inside the container
WORKDIR /usr/src/app
# Copy app files
COPY package.json ./
COPY yarn.lock ./
COPY . .

RUN yarn cache clean
RUN yarn set version berry
RUN yarn install
RUN yarn build
