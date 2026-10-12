// Feature 1: shell vacío. La Feature 2 agrega "Resolver el caso" y la
// Feature 4 la lista de entregas pendientes de revisión.
export default function DashboardPage() {
  return (
    <main>
      <h1 className="text-lg font-semibold text-zinc-900">Inicio</h1>
      <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Cómo funciona</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
          <li>Resuelves un caso financiero ficticio desde tu teléfono (menos de 15 minutos).</li>
          <li>Otra persona del piloto lo revisa sin saber quién eres.</li>
          <li>Recibes un expediente con tu trabajo, quién lo revisó y lo que no prueba.</li>
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          Puedes borrar tu entrega y tu expediente cuando quieras.
        </p>
      </section>
    </main>
  );
}
