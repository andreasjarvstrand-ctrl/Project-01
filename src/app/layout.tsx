import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Productive — procurement project management",
  description:
    "Project management that speaks procurement's language: sourcing events, stage-gates, scorecards, RAID logs, and contracts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
