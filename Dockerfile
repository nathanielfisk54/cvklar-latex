FROM texlive/texlive:latest

WORKDIR /app

# Installer Node.js 20
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Kopier package files
COPY package*.json ./

# Installer dependencies
RUN npm ci --only=production

# Kopier server
COPY server.js ./

# Opprett temp-mappe for LaTeX jobs
RUN mkdir -p /tmp/latex-jobs

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 3001

CMD ["node", "server.js"]
