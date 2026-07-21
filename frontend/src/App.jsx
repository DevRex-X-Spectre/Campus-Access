import { useEffect, useState } from "react";
import AdminPage from "./pages/AdminPage";
import GatePage from "./pages/GatePage";

/**
 * Lightweight routing without extra deps:
 *   /        → Gate (scan + grant/deny)
 *   /admin   → Admin (PIN-protected)
 */
export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Normalize trailing slashes for matching
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === "/admin") {
    return <AdminPage />;
  }
  return <GatePage />;
}
