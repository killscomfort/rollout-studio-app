import { useEffect, useState } from "react";
import {
  DEFAULT_SKY,
  loadWeatherSky,
  skyBottomColor,
  type WeatherSkyState,
} from "../lib/weather-sky";

export function useWeatherSky() {
  const [state, setState] = useState<WeatherSkyState>(DEFAULT_SKY);

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
    document.documentElement.style.setProperty(
      "--sky-bottom-color",
      skyBottomColor(state.variant)
    );
  }, [state.variant]);

  return state;
}
