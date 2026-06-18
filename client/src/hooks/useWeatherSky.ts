import { useEffect, useState } from "react";
import {
  DEFAULT_SKY,
  applySkyTheme,
  loadWeatherSky,
  type WeatherSkyState,
} from "../lib/weather-sky";

export function useWeatherSky() {
  const [state, setState] = useState<WeatherSkyState>(DEFAULT_SKY);

  useEffect(() => {
    applySkyTheme(DEFAULT_SKY.variant);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadWeatherSky().then((next) => {
      if (!cancelled) {
        setState(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applySkyTheme(state.variant);
  }, [state.variant]);

  return state;
}
