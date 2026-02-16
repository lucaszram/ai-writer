import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Writer - Headline & Image Tools",
  description: "Headline analyzer and image organizer powered by AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-8">
            <h1 className="text-xl font-bold">AI Writer</h1>
            <a href="/headlines" className="text-gray-400 hover:text-white transition">
              Headlines
            </a>
            <a href="/images" className="text-gray-400 hover:text-white transition">
              Images
            </a>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
