import { useState } from "react";
import { registrarAlmuerzo } from "./api";
import { formatHoraHN } from "./utils";

export default function AlmuerzoTab({
  usuarioId,
  estadoAlmuerzo,
  jornadaFinalizada,
  hayViajeActivo,
  onAlmuerzoOk,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const almuerzoActivo = estadoAlmuerzo?.tipo_marcaje === "entrada";
  const almuerzoTerminado = estadoAlmuerzo?.tipo_marcaje === "salida";

  const handleIniciar = async () => {
    setError("");
    setLoading(true);
    const r = await registrarAlmuerzo(usuarioId, "entrada");
    setLoading(false);
    if (r.success) {
      onAlmuerzoOk();
    } else {
      setError(r.error);
    }
  };

  const handleFinalizar = async () => {
    setError("");
    setLoading(true);
    const r = await registrarAlmuerzo(usuarioId, "salida");
    setLoading(false);
    if (r.success) {
      onAlmuerzoOk();
    } else {
      setError(r.error);
    }
  };

  return (
    <div className="content-card">
      <div className="section-title">
        <i className="fa-solid fa-utensils" />
        Hora de Almuerzo
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <i className="fa-solid fa-triangle-exclamation" />
          {error}
        </div>
      )}

      {/* Estado: jornada finalizada */}
      {jornadaFinalizada && (
        <div className="alert" style={{ background: "var(--gray-100)", color: "var(--gray-600)", border: "1px solid var(--gray-200)" }}>
          <i className="fa-solid fa-lock" />
          La jornada de hoy ha finalizado.
        </div>
      )}

      {/* Estado: sin almuerzo aún */}
      {!jornadaFinalizada && !estadoAlmuerzo && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {hayViajeActivo ? (
            <div className="ubicacion-esperada-banner">
              <i className="fa-solid fa-route" style={{ marginTop: 2 }} />
              <span>Tienes un viaje activo. Finalízalo antes de iniciar el almuerzo.</span>
            </div>
          ) : (
            <div
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #bbf7d0",
                borderRadius: 10,
                padding: "14px 16px",
                fontSize: 14,
                color: "#166534",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <i className="fa-solid fa-circle-info" style={{ fontSize: 16 }} />
              Aún no has iniciado tu hora de almuerzo hoy.
            </div>
          )}
          <button
            className="btn btn-success"
            onClick={handleIniciar}
            disabled={loading || hayViajeActivo}
          >
            {loading ? (
              <span className="spinner-inline" />
            ) : (
              <i className="fa-solid fa-play" />
            )}
            Iniciar Almuerzo
          </button>
        </div>
      )}

      {/* Estado: almuerzo activo */}
      {!jornadaFinalizada && almuerzoActivo && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "#fffbeb",
              border: "2px solid #fde68a",
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <i
              className="fa-solid fa-utensils"
              style={{ fontSize: 22, color: "#d97706" }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#92400e" }}>
                Almuerzo en curso
              </div>
              <div style={{ fontSize: 13, color: "#92400e", marginTop: 2 }}>
                Inicio: {formatHoraHN(estadoAlmuerzo.fecha_hora)}
              </div>
            </div>
          </div>
          <button
            className="btn"
            style={{ background: "var(--warning)", color: "white" }}
            onClick={handleFinalizar}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-inline" />
            ) : (
              <i className="fa-solid fa-stop" />
            )}
            Finalizar Almuerzo
          </button>
        </div>
      )}

      {/* Estado: almuerzo completado */}
      {!jornadaFinalizada && almuerzoTerminado && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1.5px solid #bbf7d0",
            borderRadius: 10,
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <i
            className="fa-solid fa-circle-check"
            style={{ fontSize: 24, color: "var(--success)" }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#166534" }}>
              Almuerzo completado
            </div>
            <div style={{ fontSize: 13, color: "#166534", marginTop: 2 }}>
              Fin: {formatHoraHN(estadoAlmuerzo.fecha_hora)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
