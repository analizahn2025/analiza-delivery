import { useState, useEffect, useCallback } from "react";
import MarcajeTab from "./Marcajetab";
import HistorialTab from "./Historiatab";
import AlmuerzoTab from "./AlmuerzoTab";
import TemperaturaTab from "./TemperaturaTab";
import Modal from "./Modal";
import {
  getEstadoActual,
  getUbicaciones,
  finalizarJornada,
} from "./api";

// Secciones del drawer
const SECTIONS = ["viajes", "almuerzo", "temperatura", "historial"];
const SECTION_LABELS = { viajes: "Viajes", almuerzo: "Almuerzo", temperatura: "Temperatura", historial: "Historial" };
const SECTION_ICONS  = { viajes: "fa-solid fa-route", almuerzo: "fa-solid fa-utensils", temperatura: "fa-solid fa-thermometer-half", historial: "fa-solid fa-list-ul" };

// Sub-tabs dentro de Viajes
const VIAJE_TABS   = ["recoleccion", "envios"];
const VIAJE_LABELS = { recoleccion: "Recolección", envios: "Envíos" };
const VIAJE_ICONS  = { recoleccion: "fa-solid fa-box-open", envios: "fa-solid fa-truck" };

export default function MotoristaApp({ user, onLogout }) {
  const [activeSection, setActiveSection] = useState("viajes");
  const [activeTab,     setActiveTab]     = useState("recoleccion");
  const [drawerOpen,    setDrawerOpen]    = useState(false);

  const [estadoGlobal,      setEstadoGlobal]      = useState(null);
  const [estadoRecoleccion, setEstadoRecoleccion] = useState(null);
  const [estadoEnvio,       setEstadoEnvio]       = useState(null);
  const [estadoAlmuerzo,    setEstadoAlmuerzo]    = useState(null);
  const [recoleccionActiva, setRecoleccionActiva] = useState(false);
  const [enviosActivo,      setEnviosActivo]      = useState(false);
  const [almuerzoActivo,    setAlmuerzoActivo]    = useState(false);

  const [ubicRecoleccion, setUbicRecoleccion] = useState([]);
  const [ubicEnvios,      setUbicEnvios]      = useState([]);
  const [loadingState,    setLoadingState]    = useState(false);

  const [showLogoutModal,  setShowLogoutModal]  = useState(false);
  const [showJornadaModal, setShowJornadaModal] = useState(false);
  const [loadingJornada,   setLoadingJornada]   = useState(false);
  const [loadingLogout,    setLoadingLogout]    = useState(false);
  const [jornadaError,     setJornadaError]     = useState("");
  const [historialKey,     setHistorialKey]     = useState(0);

  useEffect(() => {
    getUbicaciones(user.zona, "recoleccion").then((r) => {
      if (r.success) setUbicRecoleccion(r.data);
    });
    getUbicaciones(user.zona, "envio").then((r) => {
      if (r.success) setUbicEnvios(r.data);
    });
    verificarEstado();
  }, []);

  const verificarEstado = useCallback(async () => {
    if (loadingState) return;
    setLoadingState(true);
    const r = await getEstadoActual(user.id);
    setLoadingState(false);
    if (r.success) {
      setEstadoGlobal(r.global);
      setEstadoRecoleccion(r.recoleccion);
      setEstadoEnvio(r.envios);
      setEstadoAlmuerzo(r.almuerzo);
      setRecoleccionActiva(r.recoleccion?.tipo_marcaje === "entrada");
      setEnviosActivo(r.envios?.tipo_marcaje === "entrada");
      setAlmuerzoActivo(r.almuerzo?.tipo_marcaje === "entrada");
    }
  }, [user.id]);

  const handleMarcajeOk = () => {
    verificarEstado();
    setHistorialKey((k) => k + 1);
  };

  const handleFinJornada = async () => {
    setShowJornadaModal(false);
    setLoadingJornada(true);
    setJornadaError("");
    const r = await finalizarJornada(user.id);
    setLoadingJornada(false);
    if (r.success) {
      verificarEstado();
      setHistorialKey((k) => k + 1);
    } else {
      setJornadaError(r.error);
    }
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false);
    setLoadingLogout(true);
    await onLogout();
  };

  const navigateTo = (section) => {
    setActiveSection(section);
    setDrawerOpen(false);
  };

  const finJornada      = estadoGlobal?.tipo_marcaje === "fin_jornada";
  const hayViajeActivo  = recoleccionActiva || enviosActivo;
  const jornadaBloqueada = finJornada || hayViajeActivo || almuerzoActivo || loadingJornada;

  const tabProps = (tipo) => ({
    tipo,
    ubicaciones: tipo === "recoleccion" ? ubicRecoleccion : ubicEnvios,
    estadoGlobal,
    estadoRecoleccion,
    estadoEnvio,
    recoleccionActiva,
    enviosActivo,
    jornadaFinalizada: finJornada,
    onMarcajeOk: handleMarcajeOk,
    userId: user.id,
    almuerzoActivo,
  });

  return (
    <div style={{ background: "var(--gray-50)", minHeight: "100vh" }}>

      {/* ── Drawer overlay ─────────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 300,
            animation: "fadeIn 0.2s ease",
          }}
        />
      )}

      {/* ── Sidebar drawer ─────────────────────────────────────────────── */}
      <div className={`drawer${drawerOpen ? " drawer-open" : ""}`}>
        {/* Perfil */}
        <div className="drawer-profile">
          <div style={{ fontWeight: 700, fontSize: 15, color: "white" }}>
            {user.nombre_completo}
          </div>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(30,58,138,0.08)", padding: "3px 10px",
              borderRadius: 6, fontSize: 12, fontWeight: 600,
              color: "var(--primary)", marginTop: 4,
            }}
          >
            <i className="fa-solid fa-location-dot" style={{ fontSize: 11 }} />
            {user.zona}
          </div>
        </div>

        {/* Nav */}
        <nav className="drawer-nav">
          {SECTIONS.map((s) => (
            <button
              key={s}
              className={`drawer-item${activeSection === s ? " active" : ""}`}
              onClick={() => navigateTo(s)}
            >
              <i className={SECTION_ICONS[s]} />
              {SECTION_LABELS[s]}
            </button>
          ))}
        </nav>

        {/* Acciones */}
        <div className="drawer-actions">
          <button
            className={`drawer-item drawer-jornada${jornadaBloqueada ? " disabled" : ""}`}
            onClick={() => { if (!jornadaBloqueada) { setDrawerOpen(false); setShowJornadaModal(true); } }}
            disabled={jornadaBloqueada}
          >
            {loadingJornada
              ? <span className="spinner-inline" style={{ width: 15, height: 15 }} />
              : <i className="fa-solid fa-flag-checkered" />
            }
            Finalizar Jornada
          </button>
          {jornadaError && (
            <div style={{ fontSize: 12, color: "var(--danger)", padding: "4px 16px" }}>
              {jornadaError}
            </div>
          )}
          <button
            className="drawer-item drawer-logout"
            onClick={() => { setDrawerOpen(false); setShowLogoutModal(true); }}
          >
            <i className="fa-solid fa-right-from-bracket" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 200,
          background: "var(--primary-dark)",
          display: "flex", alignItems: "center",
          padding: "0 16px", height: 56,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1.5px solid rgba(255,255,255,0.25)",
            color: "white", borderRadius: 8,
            width: 38, height: 38,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 16, flexShrink: 0,
          }}
        >
          <i className="fa-solid fa-bars" />
        </button>

        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
            {SECTION_LABELS[activeSection]}
          </span>
        </div>

        {/* Indicador de estado compacto */}
        <StatusDot
          finJornada={finJornada}
          almuerzoActivo={almuerzoActivo}
          hayViajeActivo={hayViajeActivo}
        />
      </div>

      {/* ── StatusCard ─────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 14px 0" }}>
        <StatusCard
          finJornada={finJornada}
          recoleccionActiva={recoleccionActiva}
          enviosActivo={enviosActivo}
          almuerzoActivo={almuerzoActivo}
          estadoRecoleccion={estadoRecoleccion}
          estadoEnvio={estadoEnvio}
          estadoAlmuerzo={estadoAlmuerzo}
        />
      </div>

      {/* ── Sub-tabs de Viajes ──────────────────────────────────────────── */}
      {activeSection === "viajes" && (
        <div
          style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 8, padding: "12px 14px 0",
          }}
        >
          {VIAJE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "11px 8px",
                background: activeTab === tab ? "var(--primary)" : "var(--white)",
                border: `1.5px solid ${activeTab === tab ? "var(--primary)" : "var(--gray-200)"}`,
                borderRadius: 8, cursor: "pointer",
                fontWeight: 600, fontSize: 13,
                color: activeTab === tab ? "white" : "var(--gray-600)",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 7, transition: "all 0.15s",
              }}
            >
              <i className={VIAJE_ICONS[tab]} style={{ fontSize: 15 }} />
              {VIAJE_LABELS[tab]}
            </button>
          ))}
        </div>
      )}

      {/* ── Contenido ──────────────────────────────────────────────────── */}
      <div style={{ paddingBottom: 32 }}>
        {activeSection === "viajes" && (
          <>
            <div style={{ display: activeTab === "recoleccion" ? "block" : "none" }}>
              <MarcajeTab {...tabProps("recoleccion")} />
            </div>
            <div style={{ display: activeTab === "envios" ? "block" : "none" }}>
              <MarcajeTab {...tabProps("envios")} />
            </div>
          </>
        )}
        {activeSection === "almuerzo" && (
          <AlmuerzoTab
            usuarioId={user.id}
            estadoAlmuerzo={estadoAlmuerzo}
            jornadaFinalizada={finJornada}
            hayViajeActivo={hayViajeActivo}
            onAlmuerzoOk={handleMarcajeOk}
          />
        )}
        {activeSection === "temperatura" && (
          <TemperaturaTab usuarioId={user.id} />
        )}
        {activeSection === "historial" && (
          <HistorialTab
            usuarioId={user.id}
            visible={activeSection === "historial"}
            refreshKey={historialKey}
            ubicaciones={[...ubicRecoleccion, ...ubicEnvios]}
          />
        )}
      </div>

      {showLogoutModal && (
        <Modal
          title="¿Cerrar sesión?"
          message="Se cerrará tu sesión actual"
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      {/* Overlay de carga para logout / fin jornada */}
      {(loadingLogout || loadingJornada) && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 9999,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 14,
        }}>
          <div className="spinner-large" style={{ borderTopColor: "white" }} />
          <p style={{ color: "white", fontSize: 14, fontWeight: 600 }}>
            {loadingLogout ? "Cerrando sesión..." : "Finalizando jornada..."}
          </p>
        </div>
      )}
      {showJornadaModal && (
        <Modal
          title="¿Finalizar jornada?"
          message="No podrás registrar más viajes hasta mañana"
          onConfirm={handleFinJornada}
          onCancel={() => setShowJornadaModal(false)}
        />
      )}
    </div>
  );
}

// ── StatusDot — indicador compacto en la navbar ───────────────────────────────
function StatusDot({ finJornada, almuerzoActivo, hayViajeActivo }) {
  let color = "#34d399"; // verde
  let icon  = "fa-solid fa-circle-check";
  if (finJornada)     { color = "#94a3b8"; icon = "fa-solid fa-lock"; }
  else if (almuerzoActivo) { color = "#fbbf24"; icon = "fa-solid fa-utensils"; }
  else if (hayViajeActivo) { color = "#fbbf24"; icon = "fa-solid fa-truck"; }
  return (
    <i className={icon} style={{ fontSize: 18, color, flexShrink: 0 }} />
  );
}

// ── StatusCard ────────────────────────────────────────────────────────────────
function StatusCard({
  finJornada, recoleccionActiva, enviosActivo,
  almuerzoActivo, estadoRecoleccion, estadoEnvio, estadoAlmuerzo,
}) {
  let borderColor = "var(--success)";
  let icon        = "fa-solid fa-circle-check";
  let iconColor   = "var(--success)";
  let title       = "Disponible";
  let subtitle    = "Puede iniciar un viaje";
  let pill        = null;

  if (finJornada) {
    borderColor = "var(--gray-400)"; icon = "fa-solid fa-lock";
    iconColor   = "var(--gray-400)"; title = "Jornada Finalizada";
    subtitle    = "Su jornada de hoy ha concluido";
  } else if (almuerzoActivo) {
    borderColor = "#f59e0b"; icon = "fa-solid fa-utensils";
    iconColor   = "#f59e0b"; title = "En Almuerzo";
    pill = estadoAlmuerzo?.fecha_hora
      ? `Desde las ${new Date(estadoAlmuerzo.fecha_hora).toLocaleTimeString("es-HN", { timeZone: "America/Tegucigalpa", hour: "2-digit", minute: "2-digit" })}`
      : "Almuerzo en curso";
  } else if (enviosActivo) {
    borderColor = "var(--warning)"; icon = "fa-solid fa-map-marker-alt";
    iconColor   = "var(--warning)"; title = "Parada Activa";
    const nombre = estadoEnvio?.ubicaciones?.nombre;
    pill = nombre ? `Parada — ${nombre}` : "Parada en curso";
  } else if (recoleccionActiva) {
    borderColor = "var(--warning)"; icon = "fa-solid fa-truck";
    iconColor   = "var(--warning)"; title = "Viaje en Curso";
    const nombre = estadoRecoleccion?.ubicaciones?.nombre;
    pill = nombre ? `En ruta desde ${nombre}` : "Recolección en ruta";
  }

  return (
    <div
      style={{
        background: "white", padding: "12px 16px", borderRadius: 10,
        display: "flex", alignItems: "center", gap: 14,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      <i className={icon} style={{ fontSize: 22, color: iconColor }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--gray-800)" }}>
          {title}
        </div>
        {pill ? (
          <div style={{ marginTop: 3 }}>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: "rgba(217,119,6,0.1)", color: "#92400e",
                border: "1px solid rgba(217,119,6,0.2)",
              }}
            >
              <i className="fa-solid fa-route" style={{ fontSize: 10 }} />
              {pill}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--gray-500)", marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
