/**
 * Void panel — on mobile this lives in a scrollable region under the fixed camera.
 * Content is top-aligned in the scroll area (not forced to fill viewport height).
 */

const MODES = [
  { id: "recognize", label: "Check in" },
  { id: "enroll", label: "Register" },
];

export default function ControlPanel({
  mode,
  onModeChange,
  name,
  onNameChange,
  loading,
  status,
  onSubmit,
}) {
  const isEnroll = mode === "enroll";

  return (
    <section
      className={[
        "w-full bg-void-black text-polished-white",
        // Mobile: grow to fill remaining viewport; content can extend → parent scrolls
        "flex min-h-full flex-col px-20 py-32",
        // Desktop: full half, content centered
        "md:h-full md:items-center md:justify-center md:px-40 md:py-56",
      ].join(" ")}
    >
      <div className="mx-auto flex w-full max-w-[380px] flex-col md:mx-0">
        <header className="mb-28 animate-fade-up md:mb-36">
          <h2 className="display-headline">Welcome</h2>
          <p className="mt-16 font-telka text-body font-light leading-relaxed text-muted-ash">
            {isEnroll
              ? "Register your face to use campus entry."
              : "Verify your identity to continue."}
          </p>
        </header>

        <div
          className="mode-segment animate-fade-up animate-delay-1"
          role="tablist"
          aria-label="Action"
        >
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              data-active={mode === item.id}
              onClick={() => onModeChange(item.id)}
              disabled={loading}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-28 flex flex-col gap-16 animate-fade-up animate-delay-2">
          {isEnroll && (
            <label className="block animate-fade-in">
              <span className="mb-8 block font-telka text-caption font-light text-muted-ash">
                Your name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Enter your full name"
                disabled={loading}
                autoComplete="name"
                className="field-input"
              />
            </label>
          )}

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <span>{isEnroll ? "Registering…" : "Checking…"}</span>
              </>
            ) : (
              <span>{isEnroll ? "Register face" : "Verify face"}</span>
            )}
          </button>
        </div>

        <StatusCard status={status} />

        <p className="mt-32 pb-8 text-center font-telka text-caption font-light text-muted-ash/80 animate-fade-up animate-delay-3 md:mt-40">
          Secure campus entry
        </p>
      </div>
    </section>
  );
}

function StatusCard({ status }) {
  if (!status) return null;

  const isSuccess = status.kind === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-status-in mt-28 rounded-card border border-hairline-gray/20 px-16 py-16"
    >
      <div className="flex items-start gap-12">
        <span
          className={[
            "status-dot mt-6",
            isSuccess ? "bg-polished-white" : "bg-muted-ash",
          ].join(" ")}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-telka text-body-sm font-medium text-polished-white">
            {status.title}
          </p>
          {status.body && (
            <p className="mt-6 font-telka text-caption font-light leading-relaxed text-muted-ash">
              {status.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
