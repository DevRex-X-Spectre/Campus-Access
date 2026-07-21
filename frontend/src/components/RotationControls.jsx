/**
 * Rotate Camera IP preview (and detection) when the phone feed is sideways.
 */
export default function RotationControls({ rotation, onRotate, disabled = false }) {
  return (
    <div className="rotation-controls">
      <button
        type="button"
        className="rotation-btn"
        onClick={onRotate}
        disabled={disabled}
        title="Rotate image upright"
      >
        Rotate ({rotation}°)
      </button>
      <span className="rotation-hint">If the picture is sideways, tap Rotate until the face is upright.</span>
    </div>
  );
}
