import { useState, useEffect, useRef } from "react";
import { getTemperaturasHoy, registrarTemperatura } from "./api";

const SLOTS = [
  {
    turno: "manana",
    label: "Turno Mañana",
    rango: "7:00 – 11:59 a.m.",
    icon: "fa-solid fa-sun",
    horaDesde: 7,
    horaHasta: 12,
  },
  {
    turno: "tarde",
    label: "Turno Tarde",
    rango: "12:00 – 6:59 p.m.",
    icon: "fa-solid fa-cloud-sun",
    horaDesde: 12,
    horaHasta: 19,
  },
];

export default function TemperaturaTab({ usuarioId }) {
  const [temperaturas, setTemperaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [valor, setValor]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [alert, setAlert]     = useState(null);
  const timerRef = useRef(null);

  const showAlert = (msg, type = "error", dur = 5000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAlert({ msg, type });
    if (dur > 0) timerRef.current = setTimeout(() => setAlert(null), dur);
  };

  useEffect(() => {
    cargar();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const cargar = async () => {
    setLoading(true);
    const r = await getTemperaturasHoy(usuarioId);
    setLoading(false);
    if (r.success) setTemperaturas(r.data);
  };

  const getTurnoActual = () => {
    const h = parseInt(
      new Date().toLocaleTimeString("en-CA", {
        timeZone: "America/Tegucigalpa",
        hour: "2-digit",
        hour12: false,
      })
    );
    if (h >= 7 && h < 12) return "manana";
    if (h >= 12 && h < 19) return "tarde";
    return null;
  };

  const turnoActual = getTurnoActual();

  const handleRegistrar = async () => {
    const num = parseFloat(valor);
    if (isNaN(num)) {
      showAlert("Ingresa un valor numérico válido", "warning");
      return;
    }
    setSaving(true);
    const r = await registrarTemperatura(usuarioId, num);
    setSaving(false);
    if (r.success) {
      showAlert("Temperatura registrada correctamente", "success");
      setValor("");
      cargar();
    } else {
      showAlert(r.error, "error", 0);
    }
  };

  const tempPorTurno = Object.fromEntries(temperaturas.map((t) => [t.turno, t]));

  return (
    <div style={{ padding: "14px" }}>
      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: 12 }}>
          <i className={
            alert.type === "success" ? "fa-solid fa-circle-check" :
            alert.type === "warning" ? "fa-solid fa-triangle-exclamation" :
            "fa-solid fa-circle-xmark"
          } />
          <span>{alert.msg}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <span className="spinner-inline" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {SLOTS.map(({ turno, label, rango, icon }) => {
            const registrado = tempPorTurno[turno];
            const esActivo   = turnoActual === turno;
            const esFuturo   = turnoActual === "manana" && turno === "tarde";

            return (
              <div
                key={turno}
                className="content-card"
                style={{
                  borderLeft: `4px solid ${
                    registrado ? "var(--success)" :
                    esActivo   ? "var(--primary)"  :
                    "#e2e8f0"
                  }`,
                  opacity: esFuturo ? 0.6 : 1,
                }}
              >
                {/* Encabezado del slot */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <i className={icon} style={{
                    fontSize: 20,
                    color: registrado ? "var(--success)" : esActivo ? "var(--primary)" : "var(--gray-400)",
                  }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--gray-800)" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--gray-500)" }}>{rango}</div>
                    <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 3 }}>
                      Una sola marcación en cualquier hora del rango
                    </div>
                  </div>
                </div>

                {/* Estado del slot */}
                {registrado ? (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: "#f0fdf4", borderRadius: 8, padding: "12px 16px",
                    border: "1px solid #bbf7d0",
                  }}>
                    <i className="fa-solid fa-circle-check" style={{ color: "var(--success)", fontSize: 20 }} />
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--success)", lineHeight: 1 }}>
                        {registrado.temperatura}°C
                      </div>
                      <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 3 }}>
                        Registrado a las{" "}
                        {new Date(registrado.fecha_hora).toLocaleTimeString("es-HN", {
                          timeZone: "America/Tegucigalpa",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ) : esActivo ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number"
                      step="0.1"
                      min="30"
                      max="45"
                      placeholder="36.5"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRegistrar()}
                      style={{
                        width: 110, height: 46, padding: "0 12px", borderRadius: 8,
                        border: "2px solid #e2e8f0", fontSize: 20, fontWeight: 700,
                        outline: "none", color: "var(--gray-800)",
                        textAlign: "center", letterSpacing: "0.5px",
                      }}
                    />
                    <button
                      onClick={handleRegistrar}
                      disabled={saving || !valor}
                      style={{
                        height: 46, width: 52, flexShrink: 0,
                        background: saving || !valor ? "#6ee7b7" : "var(--success)",
                        border: "none", borderRadius: 8, color: "white",
                        cursor: saving || !valor ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, transition: "background 0.15s",
                      }}
                    >
                      {saving
                        ? <span className="spinner-inline" style={{ width: 16, height: 16 }} />
                        : <i className="fa-solid fa-check" />
                      }
                    </button>
                  </div>
                ) : esFuturo ? (
                  <div style={{ fontSize: 13, color: "var(--gray-400)", paddingTop: 2 }}>
                    <i className="fa-solid fa-clock" style={{ marginRight: 6 }} />
                    Disponible de 12:00 p.m. a 6:59 p.m.
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--gray-400)", paddingTop: 2 }}>
                    <i className="fa-solid fa-moon" style={{ marginRight: 6 }} />
                    Fuera del horario de registro
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
