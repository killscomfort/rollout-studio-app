interface OpenWidgetButtonProps {
  className?: string;
}

export function OpenWidgetButton({ className = "button" }: OpenWidgetButtonProps) {
  if (!window.rolloutStudio?.openWidget) {
    return null;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void window.rolloutStudio?.openWidget?.()}
    >
      Open widget
    </button>
  );
}
