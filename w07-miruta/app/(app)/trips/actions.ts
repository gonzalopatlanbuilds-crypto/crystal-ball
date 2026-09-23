"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseTripForm, evaluarViaje } from "@/lib/trips";
import type { Route } from "@/lib/routes";

export type TripFormState = { error: string } | undefined;

export async function registrarViaje(
  _prevState: TripFormState,
  formData: FormData
): Promise<TripFormState> {
  const parsed = parseTripForm(formData);
  if (!parsed.success) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select(
      "id, name, origin_label, destination_label, distance_km, expected_duration_min_low, expected_duration_min_high, expected_speed_kmh_low, expected_speed_kmh_high"
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Route>();

  if (routeError || !route) {
    console.error("registrarViaje: no se pudo cargar la ruta", routeError);
    return { error: "No se pudo cargar la ruta. Intenta de nuevo." };
  }

  const evaluacion = evaluarViaje(route, parsed.data);

  const { error } = await supabase.from("trips").insert({
    driver_id: user.id,
    route_id: route.id,
    start_time: new Date(parsed.data.startTime).toISOString(),
    end_time: new Date(parsed.data.endTime).toISOString(),
    telemetry_avg_speed_kmh: parsed.data.telemetryAvgSpeedKmh,
    telemetry_label: parsed.data.telemetryLabel,
    status: evaluacion.status,
    flag_reason: evaluacion.flagReason,
  });

  if (error) {
    console.error("registrarViaje: insert en trips falló", error);
    return { error: "No se pudo guardar el viaje. Intenta de nuevo." };
  }

  redirect("/trips");
}
