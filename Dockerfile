# Use official Node.js image
FROM node:20-slim

# Install Chromium and its dependencies
RUN apt-get update && apt-get install -y chromium

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your code
COPY . .

# Set Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose your app port
EXPOSE 3000

# Start your app
CMD ["node", "server.js"]