import { parseServerMessage, type ServerMessage } from "@no-blank/shared";

const HOME_SOCKET_URL = parseHomeSocketUrl(process.env.NEXT_PUBLIC_API_URL);

const FIRST_RETRY_MILLISECONDS = 1000;
const LONGEST_RETRY_MILLISECONDS = 10_000;
const ACTIVITY_WINDOW_MILLISECONDS = 5 * 60 * 1000;
const POLICY_VIOLATION = 1008;

type Link =
  | { readonly kind: "linked"; readonly socket: WebSocket }
  | {
      readonly kind: "waiting";
      readonly timer: ReturnType<typeof setTimeout>;
    }
  | { readonly kind: "resting" }
  | { readonly kind: "stopped" };

interface HomeConnection {
  /** 체육관 위에서 커서를 움직였거나 탭이 다시 보이게 되었음을 알립니다. */
  noticeActivity(): void;
  close(): void;
}

/**
 * 홈에 연결하고, 끊기면 최근 5분 안에 활동이 있었을 때만 다시 연결합니다.
 * 부른 순간을 페이지를 연 활동으로 칩니다.
 */
export function connectToHome(
  onMessage: (message: ServerMessage) => void,
): HomeConnection {
  let link: Link = { kind: "stopped" };
  let retryMilliseconds = FIRST_RETRY_MILLISECONDS;
  let lastActivity = Date.now();

  function connect(): void {
    const socket = new WebSocket(HOME_SOCKET_URL);

    socket.addEventListener("open", () => {
      retryMilliseconds = FIRST_RETRY_MILLISECONDS;
    });
    socket.addEventListener("message", (event) => {
      const message = readMessage(event.data);

      if (message !== null) {
        onMessage(message);
      }
    });
    socket.addEventListener("close", (event) => {
      if (link.kind !== "linked") {
        return;
      }

      if (event.code === POLICY_VIOLATION) {
        link = { kind: "stopped" };

        return;
      }

      link = { kind: "waiting", timer: setTimeout(retry, retryMilliseconds) };
      retryMilliseconds = Math.min(
        retryMilliseconds * 2,
        LONGEST_RETRY_MILLISECONDS,
      );
    });
    link = { kind: "linked", socket };
  }

  function retry(): void {
    if (Date.now() - lastActivity > ACTIVITY_WINDOW_MILLISECONDS) {
      link = { kind: "resting" };

      return;
    }

    connect();
  }

  connect();

  return {
    noticeActivity() {
      lastActivity = Date.now();

      if (link.kind === "resting") {
        retryMilliseconds = FIRST_RETRY_MILLISECONDS;
        connect();
      }
    },
    close() {
      const closing = link;

      link = { kind: "stopped" };

      if (closing.kind === "linked") {
        closing.socket.close();
      } else if (closing.kind === "waiting") {
        clearTimeout(closing.timer);
      }
    },
  };
}

function parseHomeSocketUrl(raw: string | undefined): string {
  const apiUrl = raw || "http://localhost:4000";
  const url = homeUrlOn(apiUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `NEXT_PUBLIC_API_URL must start with http:// or https://, got "${apiUrl}"`,
    );
  }

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.href;
}

// URL.canParse 는 Next 16 의 기본 대상(Chrome 111, Safari 16.4)에 없어서, 모듈을 읽는 순간 페이지가 깨집니다.
function homeUrlOn(apiUrl: string): URL {
  try {
    return new URL("/api/home", apiUrl);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL must be a valid URL, got "${apiUrl}"`);
  }
}

function readMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string") {
    return null;
  }

  try {
    return parseServerMessage(JSON.parse(data));
  } catch {
    return null;
  }
}
