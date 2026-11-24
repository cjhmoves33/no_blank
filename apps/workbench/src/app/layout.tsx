import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "no_blank 작업대",
};

const BODY = { margin: 0 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body style={BODY}>{children}</body>
    </html>
  );
}
