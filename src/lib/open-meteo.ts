import { BRAZIL_STATES } from "@/data/brazilStates";

const WEATHER_LABELS: Record<number, string> = {
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

const locationCache = new Map<string, Promise<OpenMeteoLocation>>();
const climateCache = new Map<string, Promise<HistoricalClimateContext>>();
const MAX_CACHE_ENTRIES = 200;

function cacheRequest<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  request: Promise<T>,
) {
  cache.set(key, request);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey && oldestKey !== key) {
      cache.delete(oldestKey);
    }
  }
  void request.catch(() => {
    if (cache.get(key) === request) {
      cache.delete(key);
    }
  });
  return request;
}

const normalizeString = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const getPercentValue = (value: unknown, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

export type OpenMeteoLocation = {
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
};

export type HistoricalClimateContext = {
  location: OpenMeteoLocation;
  source: string;
  period: {
    startDate: string;
    endDate: string;
    daysAnalyzed: number;
  };
  summary: {
    precipitationAverageMm: number;
    rainyDays: number;
    averageTemperatureC: number;
    intenseHeatDays: number;
    averageHumidityPercent: number;
    maxWindKmh: number;
    strongGustDays: number;
    adverseWeatherDays: number;
  };
  notes: string;
};

export async function geocodeLocation(
  city: string,
  state?: string,
  country = "Brazil",
): Promise<OpenMeteoLocation> {
  const normalizedCity = normalizeString(city);
  const stateName =
    BRAZIL_STATES.find(
      (item) => normalizeString(item.uf) === normalizeString(state ?? ""),
    )?.name ?? state ?? "";
  const normalizedState = stateName ? normalizeString(stateName) : "";
  const cacheKey = `${normalizedCity}|${normalizedState}|${normalizeString(country)}`;

  const cached = locationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const query = new URL("https://geocoding-api.open-meteo.com/v1/search");
    query.searchParams.set("name", city.trim());
    query.searchParams.set("count", "10");
    query.searchParams.set("language", "pt");
    query.searchParams.set("format", "json");

    if (country) {
      query.searchParams.set("country", "BR");
    }

    const payload = await fetchJson<{
      results?: Array<{
        name?: string;
        admin1?: string;
        country?: string;
        latitude?: number;
        longitude?: number;
      }>;
    }>(query.toString());

    const results = payload.results ?? [];

    const countryMatches = results.filter((result) => {
      const localizedCountry = normalizeString(result.country ?? "");
      return (
        !country ||
        localizedCountry === normalizeString(country) ||
        (normalizeString(country) === "brazil" &&
          localizedCountry === "brasil")
      );
    });
    const matches = countryMatches.filter((result) => {
      const resultState = normalizeString(result.admin1 ?? "");
      return (
        !normalizedState ||
        resultState === normalizedState ||
        resultState.includes(normalizedState)
      );
    });

    if (normalizedState && matches.length === 0) {
      throw new Error(
        `Cidade não encontrada no estado informado: ${city}, ${stateName}.`,
      );
    }

    const exactNameMatches = matches.filter(
      (result) => normalizeString(result.name ?? "") === normalizedCity,
    );
    const candidates = exactNameMatches.length ? exactNameMatches : matches;

    if (candidates.length > 1) {
      throw new Error(
        `Cidade ambígua. Informe um estado válido para identificar a localização correta: ${city}.`,
      );
    }

    const selected = candidates[0];

    if (
      !selected ||
      typeof selected.latitude !== "number" ||
      typeof selected.longitude !== "number"
    ) {
      throw new Error(
        `Cidade não encontrada ou ambígua: ${city}${state ? `, ${state}` : ""}`,
      );
    }

    const location: OpenMeteoLocation = {
      name: selected.name ?? city.trim(),
      state: selected.admin1 ?? state ?? "",
      country: selected.country ?? country,
      latitude: selected.latitude,
      longitude: selected.longitude,
    };

    return location;
  })();

  return cacheRequest(locationCache, cacheKey, request);
}

export async function getHistoricalClimateContext(input: {
  city: string;
  state?: string;
  startDate?: string;
}): Promise<HistoricalClimateContext> {
  const normalizedStart = input.startDate ?? toIsoDate(new Date());
  const startDate = new Date(`${normalizedStart}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalizedStart) ||
    Number.isNaN(startDate.getTime()) ||
    toIsoDate(startDate) !== normalizedStart
  ) {
    throw new Error("Data inicial inválida para consulta histórica.");
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const latestAvailableDate = new Date(today);
  latestAvailableDate.setUTCDate(latestAvailableDate.getUTCDate() - 5);
  const safeEndDate =
    startDate < latestAvailableDate ? new Date(startDate) : latestAvailableDate;

  const historicalStart = new Date(safeEndDate);
  historicalStart.setUTCFullYear(historicalStart.getUTCFullYear() - 3);

  const cacheKey = `${normalizeString(input.city)}|${normalizeString(input.state ?? "")}|${toIsoDate(startDate)}`;
  const cached = climateCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const location = await geocodeLocation(input.city, input.state, "Brazil");
    const archiveUrl = new URL("https://archive-api.open-meteo.com/v1/archive");
    archiveUrl.searchParams.set("latitude", String(location.latitude));
    archiveUrl.searchParams.set("longitude", String(location.longitude));
    archiveUrl.searchParams.set("start_date", toIsoDate(historicalStart));
    archiveUrl.searchParams.set("end_date", toIsoDate(safeEndDate));
    archiveUrl.searchParams.set(
      "daily",
      [
        "precipitation_sum",
        "temperature_2m_mean",
        "temperature_2m_max",
        "temperature_2m_min",
        "relative_humidity_2m_mean",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
        "weather_code",
      ].join(","),
    );
    archiveUrl.searchParams.set("timezone", "auto");
    archiveUrl.searchParams.set("models", "era5_land");

    const payload = await fetchJson<{
      daily?: {
        time?: string[];
        precipitation_sum?: Array<number | null>;
        temperature_2m_mean?: Array<number | null>;
        temperature_2m_max?: Array<number | null>;
        temperature_2m_min?: Array<number | null>;
        relative_humidity_2m_mean?: Array<number | null>;
        wind_speed_10m_max?: Array<number | null>;
        wind_gusts_10m_max?: Array<number | null>;
        weather_code?: Array<number | null>;
      };
    }>(archiveUrl.toString());

    const daily = payload.daily ?? {};
    const times = daily.time ?? [];
    const entries = times.map((date, index) => ({
      date,
      precipitationSum: getPercentValue(daily.precipitation_sum?.[index]),
      temperatureMean: getPercentValue(daily.temperature_2m_mean?.[index]),
      temperatureMax: getPercentValue(daily.temperature_2m_max?.[index]),
      temperatureMin: getPercentValue(daily.temperature_2m_min?.[index]),
      humidityMean: getPercentValue(daily.relative_humidity_2m_mean?.[index]),
      windMax: getPercentValue(daily.wind_speed_10m_max?.[index]),
      windGusts: getPercentValue(daily.wind_gusts_10m_max?.[index]),
      weatherCode: Number(daily.weather_code?.[index] ?? 0),
    }));

    const rainyDays = entries.filter(
      (entry) => entry.precipitationSum > 1,
    ).length;
    const intenseHeatDays = entries.filter(
      (entry) => entry.temperatureMax >= 35,
    ).length;
    const strongGustDays = entries.filter(
      (entry) => entry.windGusts >= 40,
    ).length;
    const adverseWeatherDays = entries.filter((entry) => {
      const weatherCode = entry.weatherCode;
      return [
        45, 48, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85,
        86, 95, 96, 99,
      ].includes(weatherCode);
    }).length;

    const precipitationAverageMm =
      entries.reduce((sum, entry) => sum + entry.precipitationSum, 0) /
      (entries.length || 1);
    const averageTemperatureC =
      entries.reduce((sum, entry) => sum + entry.temperatureMean, 0) /
      (entries.length || 1);
    const averageHumidityPercent =
      entries.reduce((sum, entry) => sum + entry.humidityMean, 0) /
      (entries.length || 1);
    const maxWindKmh = Math.max(...entries.map((entry) => entry.windMax), 0);

    const context: HistoricalClimateContext = {
      location,
      source: "Open-Meteo Historical Weather API (ERA5-Land)",
      period: {
        startDate: toIsoDate(historicalStart),
        endDate: toIsoDate(safeEndDate),
        daysAnalyzed: entries.length,
      },
      summary: {
        precipitationAverageMm: Number(precipitationAverageMm.toFixed(2)),
        rainyDays,
        averageTemperatureC: Number(averageTemperatureC.toFixed(2)),
        intenseHeatDays,
        averageHumidityPercent: Number(averageHumidityPercent.toFixed(2)),
        maxWindKmh: Number(maxWindKmh.toFixed(2)),
        strongGustDays,
        adverseWeatherDays,
      },
      notes:
        "Histórico climático consolidado por período e fonte Open-Meteo. Não representa previsão futura; os códigos meteorológicos ajudam a contextualizar condições adversas, mas não substituem análise isolada de tempestades.",
    };

    const weatherCodeLabels = entries
      .slice(0, 5)
      .map((entry) => WEATHER_LABELS[entry.weatherCode] ?? "Condição variável");

    context.notes += ` Exemplos de condições observadas: ${weatherCodeLabels.join(", ")}.`;

    return context;
  })();

  return cacheRequest(climateCache, cacheKey, request);
}
