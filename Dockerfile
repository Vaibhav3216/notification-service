# notification-service/Dockerfile
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3003

# Expose the service port
EXPOSE 3003

# Start the service
CMD ["node", "src/index.js"]