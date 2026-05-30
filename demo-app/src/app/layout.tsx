import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluid Demo - Dynamic UI Infrastructure",
  description: "Complete demonstration of Fluid's capabilities: intent-based generation, chat UI, suggestions, rollback, and telemetry",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
