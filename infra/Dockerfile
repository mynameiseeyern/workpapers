# syntax=docker/dockerfile:1
# Workpapers image: PocketBase (pinned) + migrations + hooks + the built SPA in pb_public.
# Build from the repo root:  docker build -f infra/Dockerfile -t workpapers .

FROM node:22-alpine AS web
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile=false && pnpm --filter web build

FROM alpine:3.22 AS pb
# Pin PocketBase deliberately; bump only with a changelog read (pre-1.0, breaking changes happen).
ARG PB_VERSION=0.30.0
ARG TARGETARCH=amd64
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/checksums.txt" -O /tmp/checksums.txt \
 && cd /tmp && grep "linux_${TARGETARCH}.zip" checksums.txt | sed "s#pocketbase_.*zip#pb.zip#" | sha256sum -c - \
 && unzip /tmp/pb.zip -d /pb && chmod +x /pb/pocketbase

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 1026 app
ENV TZ=Australia/Sydney
COPY --from=pb /pb/pocketbase /pb/pocketbase
COPY pb/pb_migrations /pb/pb_migrations
COPY pb/pb_hooks /pb/pb_hooks
COPY --from=web /src/apps/web/dist /pb/pb_public
RUN mkdir -p /pb/pb_data && chown -R app:app /pb
USER app
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks", "--publicDir=/pb/pb_public"]
