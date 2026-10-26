# Dockerfile
#
# Build multi-étapes : on compile le TypeScript dans une première image,
# puis on ne garde que le JavaScript compilé et les dépendances de production.
# Les secrets (ANTHROPIC_API_KEY, MCP_AUTH_TOKEN) sont injectés au lancement,
# jamais copiés dans l'image.

# ---- Étape 1 : build ----
FROM node:25-alpine AS build
WORKDIR /app

# Copier d'abord les manifestes permet à Docker de réutiliser la couche
# npm ci en cache tant que les dépendances ne changent pas.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Étape 2 : runtime ----
FROM node:25-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# tini devient le PID 1 et transmet les signaux (Ctrl+C, SIGTERM de Render) à Node,
# qui sinon les ignorerait et ne s'arrêterait qu'au bout du délai de kill forcé.
RUN apk add --no-cache tini

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Utilisateur non-root fourni par l'image officielle Node.
USER node

# Render fournit PORT au lancement ; 3000 reste la valeur par défaut en local.
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/http.js"]
