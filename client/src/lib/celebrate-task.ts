function launchConfetti(origin: { x: number; y: number }) {
  void import("canvas-confetti").then(({ default: confetti }) => {
    const palette = ["#5b8cff", "#7ba7ff", "#3fa266", "#e8c030", "#c85898", "#aa98d8"];

    void confetti({
      particleCount: 70,
      spread: 58,
      startVelocity: 38,
      origin,
      colors: palette,
      ticks: 180,
      gravity: 1.05,
      scalar: 0.95,
      disableForReducedMotion: true,
    });

    window.setTimeout(() => {
      void confetti({
        particleCount: 36,
        spread: 92,
        startVelocity: 22,
        origin,
        colors: palette,
        ticks: 140,
        scalar: 0.8,
        disableForReducedMotion: true,
      });
    }, 110);
  });
}

function getOrigin(source?: Element | null) {
  if (!source) {
    return { x: 0.5, y: 0.55 };
  }

  const rect = source.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };
}

function playFanfare(quiet = false) {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const volume = quiet ? 0.04 : 0.12;

    FANFARE_NOTES.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);

      const start = context.currentTime + index * 0.07;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      oscillator.start(start);
      oscillator.stop(start + 0.24);
    });

    window.setTimeout(() => {
      void context.close();
    }, 900);
  } catch {
    // Audio can fail if the window has no user gesture yet.
  }
}

const FANFARE_NOTES = [523.25, 659.25, 783.99, 1046.5];

export function celebrateTaskComplete(source?: Element | null) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    playFanfare(true);
    return;
  }

  playFanfare();
  launchConfetti(getOrigin(source));
}

export function markTaskRowCelebrating(element: Element | null) {
  if (!element) return;

  const row = element.closest("tr, .widget-task-row");
  if (!row) return;

  row.classList.remove("task-complete-celebrate");
  void (row as HTMLElement).offsetWidth;
  row.classList.add("task-complete-celebrate");
}
