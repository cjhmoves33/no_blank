import { type GreetingResponse, parseGreetingResponse } from "@no-blank/shared";

// 서버 컴포넌트에서만 사용합니다. API_URL 은 요청 시점에 읽히므로 Docker 런타임 환경변수로 주입할 수 있습니다.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

async function apiGet<T>({
  path,
  parse,
}: {
  path: string;
  parse: (body: unknown) => T;
}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);

  if (!res.ok) {
    throw new Error(`GET ${path} failed with ${res.status}`);
  }

  const body: unknown = await res.json();

  return parse(body);
}

export function getGreeting(): Promise<GreetingResponse> {
  return apiGet({ path: "/api/greeting", parse: parseGreetingResponse });
}
