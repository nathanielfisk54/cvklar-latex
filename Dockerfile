FROM texlive/texlive:latest

WORKDIR /app

# Installer Node.js 20
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Kopier alle filer
COPY . .

# Installer dependencies
RUN npm install --omit=dev

# Opprett temp-mappe for LaTeX jobs
RUN mkdir -p /tmp/latex-jobs

EXPOSE 3001

CMD ["node", "server.js"]
