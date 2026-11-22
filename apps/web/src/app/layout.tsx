import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "no_blank",
  description: "no_blank",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
