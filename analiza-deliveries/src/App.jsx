import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import MotoristaApp from "./Motoristaapp";
import AdminApp from "./Adminapp";
import { getSesionActual, logout, invalidarCacheFecha } from "./api";

export default function App() {
  const [user, setUser] = useState(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    // Restaurar sesión activa al montar (el SDK guarda el JWT automáticamente)
    getSesionActual()
      .then((r) => { if (r.success) setUser(r.user); })
      .catch(() => {})
      .finally(() => setVerificando(false));

    // Reaccionar a cambios de auth: logout en otra pestaña, token expirado, etc.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        invalidarCacheFecha();
      }
    });

    // Re-verificar sesión cuando el usuario regresa a la pestaña (evita pantalla azul
    // cuando el token expiró mientras la pestaña estaba inactiva en segundo plano)
    const handleVisibility = () => {
      if (!document.hidden) {
        getSesionActual().then((r) => {
          // Solo cerrar sesión si el servidor confirmó que no hay sesión válida.
          // Si fue timeout de red (PWA/sin señal), conservar el usuario actual.
          if (!r.success && !r.timeout) {
            setUser(null);
            invalidarCacheFecha();
          }
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const handleLoginSuccess = (u) => setUser(u);

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  if (verificando) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--gray-50)",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div className="spinner-large" />
        <p style={{ color: "var(--gray-500)", fontSize: 14 }}>
          Verificando sesión...
        </p>
      </div>
    );
  }

  if (!user) return <Login onLoginSuccess={handleLoginSuccess} />;
  if (user.rol === "admin") return <AdminApp user={user} onLogout={handleLogout} />;
  return <MotoristaApp user={user} onLogout={handleLogout} />;
}
