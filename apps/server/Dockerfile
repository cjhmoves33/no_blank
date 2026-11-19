# syntax=docker/dockerfile:1
# 빌드 컨텍스트는 모노레포 루트입니다: docker build -f apps/server/Dockerfile .

FROM node:24-alpine AS base
RUN npm install -g pnpm@11.28.12
WORKDIR /repo

FROM base AS build
# lockfile 만으로 패키지를 먼저 받아 둡니다. 소스 코드가 바뀌어도 이 레이어는 캐시됩니다.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@no-blank/server..."
RUN pnpm --filter "@no-blank/server..." build
# server 와 런타임 의존성(prod)만 /out 으로 추려 냅니다. (package.json 의 "files": dist, drizzle)
RUN pnpm deploy --filter @no-blank/server --prod --legacy /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
