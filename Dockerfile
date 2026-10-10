# Base  stage for building and dev
FROM node:26-alpine AS base

# Install yarn globally
RUN npm install -g yarn

# Set the working directory to /app inside the container
WORKDIR /usr/src/app

# Copy app files
COPY package.json ./
COPY yarn.lock ./
COPY . .

COPY yarn.lock ./
RUN yarn cache clean
RUN yarn install

COPY . .
RUN yarn build
