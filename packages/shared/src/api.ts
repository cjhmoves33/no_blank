/** GET /api/greeting */
export interface GreetingResponse {
  message: string;
}

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

/** 네트워크로 받은 값을 GreetingResponse 로 검증합니다. 알 수 없는 필드는 버립니다. */
export function parseGreetingResponse(input: unknown): GreetingResponse {
  if (
    typeof input === "object" &&
    input !== null &&
    "message" in input &&
    typeof input.message === "string"
  ) {
    return { message: input.message };
  }

  throw new Error("Invalid GreetingResponse: expected { message: string }");
}
