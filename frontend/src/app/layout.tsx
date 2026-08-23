import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Promail | Email Scheduler",
  description: "A clear view of everything moving through Promail.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
