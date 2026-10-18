import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Libro Abierto",
  description:
    "Quién paga el verificador de compatibilidad, cuánto cuesta operarlo y qué no puede cambiar quien lo financie. Datos simulados.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white">{children}</body>
    </html>
  );
}
