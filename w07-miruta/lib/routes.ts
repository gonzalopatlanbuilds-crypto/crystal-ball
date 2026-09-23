export interface Route {
  id: string;
  name: string;
  origin_label: string;
  destination_label: string;
  distance_km: number;
  expected_duration_min_low: number;
  expected_duration_min_high: number;
  expected_speed_kmh_low: number;
  expected_speed_kmh_high: number;
}
