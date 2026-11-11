"use client";

import dynamic from "next/dynamic";

// El simulador lee localStorage al arrancar, así que solo se renderiza en
// el navegador. Sin esto, el HTML del servidor (sin escenarios) no
// coincidiría con el del navegador (con escenarios).
const Simulador = dynamic(() => import("@/components/Simulador"), {
  ssr: false,
  loading: () => <p className="mt-6 text-sm text-zinc-500">Cargando el simulador…</p>,
});

export default function SimuladorCliente() {
  return <Simulador />;
}
