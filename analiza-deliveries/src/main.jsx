import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./index.css";
import App from "./App.jsx";

// Forzar actualización del service worker en cada carga.
// Esto resuelve el caso donde usuarios con el SW viejo (sin NetworkOnly para supabase.co)
// nunca recibieron el update porque el SW antiguo no tenía skipWaiting.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready
    .then((reg) => reg.update())
    .catch(() => {});
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
