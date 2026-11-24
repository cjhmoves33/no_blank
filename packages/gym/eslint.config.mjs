import {
  base,
  react,
  reactRecommended,
  readability,
  typeChecked,
} from "@no-blank/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig(
  base,
  reactRecommended,
  typeChecked(import.meta.dirname),
  readability,
  react,
  {
    rules: {
      "react/forbid-dom-props": [
        "error",
        {
          forbid: [
            {
              propName: "className",
              message:
                "web 의 Tailwind 는 packages/gym 을 읽지 않아서 이 클래스의 CSS 가 생기지 않습니다. style 을 쓰세요.",
            },
          ],
        },
      ],
    },
  },
);
