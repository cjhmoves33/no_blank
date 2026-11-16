import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 이미지용: .next/standalone 에 실행에 필요한 파일만 모아 server.js 로 기동합니다.
  output: "standalone",
  // 모노레포 루트부터 의존성을 추적해야 workspace 패키지(@no-blank/shared 등)가 포함됩니다.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
