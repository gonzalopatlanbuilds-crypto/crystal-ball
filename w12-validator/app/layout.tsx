import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Validator",
  description: "Validator — en construcción. Datos simulados.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white">{children}</body>
    </html>
  );
}
