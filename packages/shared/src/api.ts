/** GET /api/health */
export interface HealthResponse {
  status: "ok" | "error";
  /** 의존성별 상태. 예: { db: 'up' } */
  checks?: Record<string, "up" | "down">;
}

/** 오류 응답. Fastify 기본 오류 처리기가 만드는 형태와 같습니다. */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}
