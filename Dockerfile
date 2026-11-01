# NutriLens — single-container deploy (Render / Railway / Fly / any VPS)
#
# The React client is built inside the image (client/dist is not in git),
# so this Dockerfile is all a host needs.

FROM node:22-bookworm-slim

WORKDIR /app

# 1. server dependencies (better-sqlite3 is optional; node:sqlite is the fallback)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# 2. the client needs its devDependencies (vite, typescript) to build
COPY client/package.json client/package-lock.json ./client/
RUN npm --prefix client install --include=dev --no-audit --no-fund

# 3. source + build
COPY server ./server
COPY scripts ./scripts
COPY client ./client
RUN npm --prefix client run build && rm -rf client/node_modules

ENV NODE_ENV=production
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME ["/data"]

ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
