FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4242
# OPENCLAW_SESSIONS_DIR must be mounted from host
ENV OPENCLAW_SESSIONS_DIR=/data/sessions
CMD ["node", "server.js"]
