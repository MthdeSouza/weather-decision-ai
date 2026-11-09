import type { WeatherContext } from "@/types/chat";

const WEATHER_CODES: Record<number, string> = {
  0: "Céu limpo",
  1: "Parcialmente nublado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Neblina",
  51: "Garoa leve",
  53: "Garoa",
  55: "Chuva forte",
  56: "Garoa gelada",
  57: "Chuva gelada",
  61: "Chuva fraca",
  63: "Chuva",
  65: "Chuva forte",
  66: "Chuva gelada",
  67: "Chuva gelada forte",
  71: "Neve leve",
  73: "Neve",
  75: "Neve forte",
  77: "Granizo",
  80: "Pancadas de chuva",
  81: "Chuva forte",
  82: "Chuva muito forte",
  85: "Neve leve",
  86: "Neve forte",
  95: "Trovoada",
  96: "Trovoada com granizo",
  99: "Trovoada com granizo",
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getWeatherSummary(city: string): Promise<WeatherContext> {
  const normalizedCity = city.trim();

  if (!normalizedCity) {
    throw new Error("Cidade inválida.");
  }

  const geoResponse = await fetchJson<{
    results?: Array<{ name: string; latitude: number; longitude: number }>;
  }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedCity)}&count=1&language=pt&format=json`,
  );

  const location = geoResponse.results?.[0];

  if (!location) {
    throw new Error(`Cidade não encontrada: ${normalizedCity}`);
  }

  const weatherResponse = await fetchJson<{
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
      weather_code?: number;
    };
  }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto&language=pt`,
  );

  const current = weatherResponse.current ?? {};
  const weatherCode = Number(current.weather_code ?? 0);

  return {
    city: location.name,
    condition: WEATHER_CODES[weatherCode] ?? "Condição climática variável",
    temperature: Number(current.temperature_2m ?? 0),
    humidity: Number(current.relative_humidity_2m ?? 0),
    wind: Number(current.wind_speed_10m ?? 0),
  };
}
