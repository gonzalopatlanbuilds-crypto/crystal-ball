type Props = {
  onRegresar: () => void;
  onEnviar: () => void;
};

export default function PantallaConsentimiento({ onRegresar, onEnviar }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">
        Elige qué datos objetar
      </h1>
      <p className="text-base text-zinc-600">Esta pantalla se construye en el siguiente paso.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRegresar}
          className="w-full rounded-full border border-zinc-300 px-6 py-4 text-base font-semibold text-zinc-700"
        >
          Regresar
        </button>
        <button
          type="button"
          onClick={onEnviar}
          className="w-full rounded-full bg-zinc-900 px-6 py-4 text-base font-semibold text-white"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
