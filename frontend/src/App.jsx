import { useEffect, useState } from "react";
import AdminPage from "./pages/AdminPage";
import GatePage from "./pages/GatePage";

/**
 * Routing that works on static hosts (Render) without server rewrites:
 *   /#/        → Gate
 *   /#/admin   → Admin
 *
 * Also accepts pathname /admin when the host rewrites to index.html.
 */
function readRoute() {
  const hash = (window.location.hash || "").replace(/^#/, "");
  const path = (window.location.pathname || "/").replace(/\/+$/, "") || "/";

  if (hash === "/admin" || hash === "admin" || hash.startsWith("/admin")) {
    return "admin";
  }
  if (path === "/admin") {
    return "admin";
  }
  return "gate";
}

export default function App() {
  const [route, setRoute] = useState(() => readRoute());

  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  if (route === "admin") {
    return <AdminPage />;
  }
  return <GatePage />;
}
