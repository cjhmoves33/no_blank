import type { HealthResponse } from "@no-blank/shared";
import type { FastifyPluginAsync } from "fastify";

/**
 * docker compose 의 healthcheck 가 이 엔드포인트를 호출합니다.
 * 200 이면 healthy, 그 외(503 등)면 unhealthy 로 판정되어 web 컨테이너가 기동을 기다립니다.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>("/health", async (_request, _reply) => {
    // TODO(you): 헬스 체크가 무엇을 보장해야 할지 결정해 주세요.
    //  - 지금은 "프로세스가 살아 있다(liveness)"만 응답합니다.
    return { status: "ok" };
  });
};
