FROM node:20-slim

WORKDIR /app

# Installer minimal LaTeX
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Kopier package files
COPY package.json package-lock.json ./

# Installer dependencies
RUN npm ci --only=production

# Kopier resten av filene
COPY . .

# Opprett temp-mappe
RUN mkdir -p /tmp/latex-jobs

EXPOSE 3001

CMD ["node", "server.js"]
