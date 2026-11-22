# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN npm install -g pnpm@11.28.12
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@no-blank/web..."
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter "@no-blank/web..." build
# git 은 빈 폴더를 저장하지 않으므로, public 에 파일이 없으면 clone 한 저장소에는 폴더 자체가 없습니다.
# 아래 runtime 단계의 COPY 가 실패하지 않도록 폴더를 보장합니다.
RUN mkdir -p apps/web/public

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# standalone 은 모노레포 구조를 유지하므로 server.js 는 apps/web/ 아래에 위치합니다.
# Next.js 가 런타임에 .next/cache 에 쓸 수 있도록 node 사용자에게 소유권을 줍니다.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
