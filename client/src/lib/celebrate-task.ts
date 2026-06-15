import confetti from "canvas-confetti";

const FANFARE_NOTES = [523.25, 659.25, 783.99, 1046.5];
const CONFETTI_PALETTE = ["#5b8cff", "#7ba7ff", "#3fa266", "#e8c030", "#c85898", "#aa98d8"];

let audioContext: AudioContext | null = null;

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

async function playFanfare(quiet = false) {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const context = audioContext;
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
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);

      oscillator.start(start);
      oscillator.stop(start + 0.24);
    });
  } catch {
    // Audio can fail if the window has no user gesture yet.
  }
}

function launchConfetti(origin: { x: number; y: number }) {
  const options = {
    particleCount: 70,
    spread: 58,
    startVelocity: 38,
    origin,
    colors: CONFETTI_PALETTE,
    ticks: 180,
    gravity: 1.05,
    scalar: 0.95,
    zIndex: 99999,
    disableForReducedMotion: true,
    useWorker: false,
  } as const;

  void confetti(options);

  window.setTimeout(() => {
    void confetti({
      ...options,
      particleCount: 36,
      spread: 92,
      startVelocity: 22,
      ticks: 140,
      scalar: 0.8,
    });
  }, 110);
}

export function celebrateTaskComplete(source?: Element | null) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const origin = getOrigin(source);

  if (reducedMotion) {
    void playFanfare(true);
    return;
  }

  void playFanfare();
  launchConfetti(origin);
}

export const TASK_CELEBRATION_MS = 600;
