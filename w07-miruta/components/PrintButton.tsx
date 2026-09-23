"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-blue-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 print:hidden"
    >
      Descargar / Compartir
    </button>
  );
}
