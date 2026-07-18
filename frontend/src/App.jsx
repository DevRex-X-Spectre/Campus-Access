import { useCallback, useRef, useState } from "react";
import CameraPanel from "./components/CameraPanel";
import ControlPanel from "./components/ControlPanel";
import { enrollFace, recognizeFace } from "./api/client";

/**
 * Layout:
 *  - Mobile: locked viewport. Camera (cream) stays fixed; void panel scrolls in remaining space.
 *  - Desktop: 50/50 side-by-side diptych.
 */
export default function App() {
  const cameraRef = useRef(null);
  const [mode, setMode] = useState("recognize");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleModeChange = useCallback((next) => {
    setMode(next);
    setStatus(null);
  }, []);

  const friendlyError = (raw) => {
    const msg = (raw || "").toLowerCase();
    if (msg.includes("failed to fetch") || msg.includes("could not reach") || msg.includes("network")) {
      return "We couldn’t connect right now. Please try again in a moment.";
    }
    if (msg.includes("not valid json") || msg.includes("unexpected token")) {
      return "Something went wrong on our side. Please refresh and try again.";
    }
    if (msg.includes("no face") || msg.includes("center your face")) {
      return "No face in view. Center your face in the frame and try again.";
    }
    if (msg.includes("permission") || msg.includes("camera")) {
      return raw;
    }
    return raw || "Something went wrong. Please try again.";
  };

  const handleSubmit = useCallback(async () => {
    setStatus(null);

    if (mode === "enroll" && !name.trim()) {
      setStatus({
        kind: "error",
        title: "Name needed",
        body: "Please enter your full name to register.",
      });
      return;
    }

    setLoading(true);
    try {
      if (!cameraRef.current) {
        throw new Error("Camera is not ready yet.");
      }

      const image = await cameraRef.current.captureFace();

      if (mode === "enroll") {
        const result = await enrollFace({ name: name.trim(), image });
        setStatus({
          kind: "success",
          title: result.is_new_personnel ? "Registration complete" : "Profile updated",
          body: result.is_new_personnel
            ? `${result.name} is now registered for campus entry.`
            : `Another photo was saved for ${result.name}.`,
        });
      } else {
        const result = await recognizeFace({ image });
        if (result.recognized) {
          setStatus({
            kind: "success",
            title: "Access granted",
            body: `Welcome, ${result.name}.`,
          });
        } else {
          setStatus({
            kind: "error",
            title: "Access denied",
            body:
              result.message?.toLowerCase().includes("no enrolled")
                ? "No one is registered yet. Switch to Register to add a person first."
                : "Face not recognized. You may need to register first.",
          });
        }
      }
    } catch (err) {
      setStatus({
        kind: "error",
        title: "Unable to continue",
        body: friendlyError(err?.message),
      });
    } finally {
      setLoading(false);
    }
  }, [mode, name]);

  return (
    <div
      className={[
        // Mobile: full viewport lock — page itself does not scroll
        "flex h-[100dvh] w-full flex-col overflow-hidden",
        // Desktop: side-by-side, each half fills the screen
        "md:h-screen md:flex-row",
      ].join(" ")}
    >
      {/* Camera — static on mobile (does not scroll away) */}
      <div className="w-full flex-shrink-0 md:h-full md:w-1/2 md:overflow-hidden">
        <CameraPanel ref={cameraRef} />
      </div>

      {/* Controls — only this region scrolls on mobile */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain md:h-full md:w-1/2 md:overflow-y-auto">
        <ControlPanel
          mode={mode}
          onModeChange={handleModeChange}
          name={name}
          onNameChange={setName}
          loading={loading}
          status={status}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
