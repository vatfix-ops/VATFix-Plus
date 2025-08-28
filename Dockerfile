# Dockerfile — VATFix Plus (Node.js + Tini, TLS ready)

# Use official lightweight Node.js LTS base
FROM node:20-slim

# Install tini for proper signal handling (zombie reaping)
RUN apt-get update && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package manifests first (better caching)
COPY package*.json ./

# Install deps
RUN npm ci --omit=dev

# Copy all source
COPY . .

# Expose app port
EXPOSE 3000

# Ensure NODE_ENV production
ENV NODE_ENV=production

# Use tini as entrypoint to fix zombie processes
ENTRYPOINT ["/usr/bin/tini", "-s", "--"]

# Start server
CMD ["node", "server.mjs"]
