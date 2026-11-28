# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN npm install -g pnpm@11.28.12
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@no-blank/server..."
RUN pnpm --filter "@no-blank/server..." build
RUN pnpm deploy --filter @no-blank/server --prod --legacy /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 4000
# ball-motion 은 기본으로 TS 소스를 내보내는데, Node 는 node_modules 안의 TS 를 실행하지 않습니다.
# built 조건으로 ball-motion 이 빌드한 dist 를 고릅니다.
CMD ["node", "--conditions=built", "dist/server.js"]
