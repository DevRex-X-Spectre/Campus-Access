/**
 * Biometric-style face lock: corner brackets only — no scores or tech labels.
 */

export default function FaceOverlay({ box }) {
  if (!box) return null;

  const { x, y, width, height } = box;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className="absolute"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <span className="face-bracket tl" />
        <span className="face-bracket tr" />
        <span className="face-bracket bl" />
        <span className="face-bracket br" />
      </div>
    </div>
  );
}
