import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Validador de Evidencia de Empaque",
  description:
    "Concilia CSV de proveedores de empaque: hallazgos deterministas, revisión humana con nota obligatoria e historial de versiones. Datos simulados.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white">{children}</body>
    </html>
  );
}
