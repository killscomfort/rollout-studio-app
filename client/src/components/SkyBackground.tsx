import { useWeatherSky } from "../hooks/useWeatherSky";
import type { SkyVariant } from "../lib/weather-sky";

interface SkyBackgroundProps {
  /** Fixed to the viewport (main app) or contained in a parent (widget). */
  layout?: "fixed" | "local";
}

function cloudCountForVariant(variant: SkyVariant): number {
  switch (variant) {
    case "clear-day":
    case "clear-night":
      return 2;
    case "partly-cloudy":
      return 4;
    case "cloudy":
    case "fog":
      return 5;
    case "rain":
    case "snow":
      return 4;
    case "thunderstorm":
      return 5;
    default:
      return 3;
  }
}

function showSun(variant: SkyVariant) {
  return variant === "clear-day" || variant === "partly-cloudy";
}

function showMoon(variant: SkyVariant) {
  return variant === "clear-night";
}

function showRain(variant: SkyVariant) {
  return variant === "rain" || variant === "thunderstorm";
}

function showSnow(variant: SkyVariant) {
  return variant === "snow";
}

export function SkyBackground({ layout = "local" }: SkyBackgroundProps) {
  const { variant } = useWeatherSky();
  const cloudCount = cloudCountForVariant(variant);

  return (
    <div
      className={`sky-background sky-background--${layout}`}
      data-sky={variant}
      aria-hidden="true"
    >
      <div className="sky-gradient" />
      {showSun(variant) ? <div className="sky-sun" /> : null}
      {showMoon(variant) ? <div className="sky-moon" /> : null}
      {Array.from({ length: cloudCount }, (_, index) => (
        <div
          key={index}
          className={`sky-cloud sky-cloud-${index + 1}`}
        />
      ))}
      {showRain(variant) ? (
        <div className="sky-rain">
          {Array.from({ length: 24 }, (_, index) => (
            <span key={index} className="sky-rain-drop" />
          ))}
        </div>
      ) : null}
      {showSnow(variant) ? (
        <div className="sky-snow">
          {Array.from({ length: 18 }, (_, index) => (
            <span key={index} className="sky-snow-flake" />
          ))}
        </div>
      ) : null}
      {variant === "thunderstorm" ? <div className="sky-lightning" /> : null}
    </div>
  );
}

/** @deprecated Use SkyBackground */
export const WidgetSkyBackground = SkyBackground;
