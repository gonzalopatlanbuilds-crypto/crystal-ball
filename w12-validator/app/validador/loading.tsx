// Mientras el servidor lee la evidencia (en Vercel puede tardar un poco).
export default function Cargando() {
  return (
    <p className="py-8 text-center text-sm text-zinc-500" role="status">
      Cargando…
    </p>
  );
}
