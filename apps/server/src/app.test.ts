import {
  type ErrorResponse,
  type HealthResponse,
  parseGreetingResponse,
} from "@no-blank/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { greetings } from "./db/schema.js";
import { createTestDb } from "./test/create-test-db.js";

describe("API", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    app = await buildApp({ db: testDb.db });
  });

  afterEach(async () => {
    await app.close();
    await testDb.close();
  });

  it("GET /api/health 는 200 과 status: ok 를 반환한다", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    // 헬스 체크에 checks 필드가 추가되어도 깨지지 않도록 status 만 확인합니다.
    expect(res.json()).toMatchObject({
      status: "ok",
    } satisfies HealthResponse);
  });

  it("GET /api/greeting 은 seed 마이그레이션이 넣은 Hello World 를 반환한다", async () => {
    const res = await app.inject({ method: "GET", url: "/api/greeting" });

    expect(res.statusCode).toBe(200);
    // web 이 사용하는 parser 로 검증해서, 서버 응답이 API 계약을 지키는지 함께 확인합니다.
    expect(parseGreetingResponse(res.json())).toEqual({
      message: "Hello World",
    });
  });

  it("greetings 가 비어 있으면 GET /api/greeting 은 404 를 반환한다", async () => {
    await testDb.db.delete(greetings);

    const res = await app.inject({ method: "GET", url: "/api/greeting" });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: "No greeting found",
    } satisfies ErrorResponse);
  });

  it("정의되지 않은 경로는 404 를 반환한다", async () => {
    const res = await app.inject({ method: "GET", url: "/api/unknown" });

    expect(res.statusCode).toBe(404);
  });
});
