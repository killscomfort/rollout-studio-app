export type SkyVariant =
  | "clear-day"
  | "clear-night"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "thunderstorm";

export type LocationSource = "geolocation" | "timezone" | "cached";

export interface WeatherSkyState {
  variant: SkyVariant;
  locationSource: LocationSource | null;
  isLive: boolean;
}

const CACHE_KEY = "rollout-weather-sky-v1";
const COORDS_KEY = "rollout-weather-coords-v1";
const CACHE_TTL_MS = 15 * 60 * 1000;

const DEFAULT_COORDS = { lat: 40.7128, lon: -74.006 };

const TIMEZONE_COORDS: Record<string, { lat: number; lon: number }> = {
  "America/New_York": { lat: 40.71, lon: -74.01 },
  "America/Chicago": { lat: 41.88, lon: -87.63 },
  "America/Denver": { lat: 39.74, lon: -104.99 },
  "America/Los_Angeles": { lat: 34.05, lon: -118.24 },
  "America/Phoenix": { lat: 33.45, lon: -112.07 },
  "America/Toronto": { lat: 43.65, lon: -79.38 },
  "America/Vancouver": { lat: 49.28, lon: -123.12 },
  "Europe/London": { lat: 51.51, lon: -0.13 },
  "Europe/Paris": { lat: 48.86, lon: 2.35 },
  "Europe/Berlin": { lat: 52.52, lon: 13.41 },
  "Europe/Amsterdam": { lat: 52.37, lon: 4.9 },
  "Asia/Tokyo": { lat: 35.68, lon: 139.69 },
  "Asia/Shanghai": { lat: 31.23, lon: 121.47 },
  "Asia/Singapore": { lat: 1.35, lon: 103.82 },
  "Asia/Kolkata": { lat: 28.61, lon: 77.21 },
  "Australia/Sydney": { lat: -33.87, lon: 151.21 },
  "Pacific/Auckland": { lat: -36.85, lon: 174.76 },
};

export const DEFAULT_SKY: WeatherSkyState = {
  variant: "clear-day",
  locationSource: null,
  isLive: false,
};

interface CachedWeather {
  variant: SkyVariant;
  locationSource: LocationSource;
  fetchedAt: number;
}

interface StoredCoords {
  lat: number;
  lon: number;
  source: LocationSource;
}

let coordsPromise: Promise<StoredCoords> | null = null;

export function mapWeatherCodeToSky(
  weatherCode: number,
  isDay: boolean
): SkyVariant {
  if (weatherCode === 0) {
    return isDay ? "clear-day" : "clear-night";
  }
  if (weatherCode === 1 || weatherCode === 2) {
    return isDay ? "partly-cloudy" : "clear-night";
  }
  if (weatherCode === 3) {
    return "cloudy";
  }
  if (weatherCode === 45 || weatherCode === 48) {
    return "fog";
  }
  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return "rain";
  }
  if (
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 85 && weatherCode <= 86)
  ) {
    return "snow";
  }
  if (weatherCode >= 95) {
    return "thunderstorm";
  }
  return isDay ? "partly-cloudy" : "clear-night";
}

function readCache(): CachedWeather | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeather;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(entry: CachedWeather) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore quota errors.
  }
}

function readStoredCoords(): StoredCoords | null {
  try {
    const raw = sessionStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCoords;
  } catch {
    return null;
  }
}

function writeStoredCoords(coords: StoredCoords) {
  try {
    sessionStorage.setItem(COORDS_KEY, JSON.stringify(coords));
  } catch {
    // Ignore quota errors.
  }
}

function timezoneFallbackCoords(): StoredCoords {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const coords = TIMEZONE_COORDS[timezone] ?? DEFAULT_COORDS;
  return { ...coords, source: "timezone" };
}

function requestGeolocation(): Promise<StoredCoords | null> {
  if (!("geolocation" in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          source: "geolocation",
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  });
}

export function resolveCoords(): Promise<StoredCoords> {
  if (coordsPromise) return coordsPromise;

  coordsPromise = (async () => {
    const stored = readStoredCoords();
    if (stored) return stored;

    const fromGeo = await requestGeolocation();
    const coords = fromGeo ?? timezoneFallbackCoords();
    writeStoredCoords(coords);
    return coords;
  })();

  return coordsPromise;
}

interface OpenMeteoCurrent {
  weather_code: number;
  is_day: number;
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
}

export async function fetchWeatherSky(
  lat: number,
  lon: number,
  locationSource: LocationSource
): Promise<WeatherSkyState> {
  const cached = readCache();
  if (cached) {
    return {
      variant: cached.variant,
      locationSource: cached.locationSource,
      isLive: true,
    };
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "weather_code,is_day");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed (${response.status})`);
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const current = data.current;
  if (!current) {
    throw new Error("Weather response missing current conditions");
  }

  const variant = mapWeatherCodeToSky(current.weather_code, current.is_day === 1);
  writeCache({
    variant,
    locationSource,
    fetchedAt: Date.now(),
  });

  return { variant, locationSource, isLive: true };
}

export async function loadWeatherSky(): Promise<WeatherSkyState> {
  try {
    const coords = await resolveCoords();
    return await fetchWeatherSky(coords.lat, coords.lon, coords.source);
  } catch {
    return DEFAULT_SKY;
  }
}

export function skyBottomColor(variant: SkyVariant): string {
  switch (variant) {
    case "clear-night":
      return "#1a2744";
    case "partly-cloudy":
      return "#b8daf5";
    case "cloudy":
      return "#9eb8d4";
    case "fog":
      return "#c5d0dc";
    case "rain":
      return "#7a9cb8";
    case "snow":
      return "#d8e8f4";
    case "thunderstorm":
      return "#4a5a72";
    default:
      return "#cce9fb";
  }
}
