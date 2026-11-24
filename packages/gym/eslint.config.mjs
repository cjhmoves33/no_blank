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
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='addColorStop'] > Literal[value='transparent']",
          message:
            '"transparent" 는 투명한 검정이라 흐리는 가장자리가 검게 물듭니다. brushes.ts 의 clearOf(색) 으로 같은 색의 알파 0 을 쓰세요.',
        },
      ],
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
