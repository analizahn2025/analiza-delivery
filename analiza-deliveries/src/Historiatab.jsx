import { useEffect, useRef, useState } from "react";
import { getHistorialDia } from "./api";
import { formatMinutos, formatHoraHN } from "./utils";

const HISTORIAL_TTL_MS = 30 * 1000; // no refetch si fue hace menos de 30 s

export default function HistorialTab({ usuarioId, visible, refreshKey, ubicaciones = [] }) {
  // Mapa id → ubicacion para resolver padre → hijo
  const ubicMap = Object.fromEntries(ubicaciones.map((u) => [u.id, u]));
  const [marcajes, setMarcajes] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef(0);

  // refreshKey cambia cada vez que se registra un marcaje → invalida el cache
  useEffect(() => {
    lastFetchRef.current = 0;
  }, [refreshKey]);

  useEffect(() => {
    if (!visible) return;
    const ahora = Date.now();
    if (ahora - lastFetchRef.current < HISTORIAL_TTL_MS) return; // usa cache
    cargar();
  }, [visible, refreshKey]);

  const cargar = async () => {
    setLoading(true);
    const r = await getHistorialDia(usuarioId);
    setLoading(false);
    if (r.success) {
      setMarcajes(r.data);
      lastFetchRef.current = Date.now();
    }
  };

  if (loading) {
    return (
      <div className="content-card">
        <div className="spinner-container">
          <div className="spinner-large" />
          <p className="spinner-text">Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (!marcajes || marcajes.length === 0) {
    return (
      <div className="content-card">
        <div className="empty-state">
          <div className="empty-icon">
            <i
              className="fa-regular fa-folder-open"
              style={{ fontSize: 48, color: "var(--gray-300)" }}
            />
          </div>
          <p>No hay viajes registrados hoy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card">
      <div
        style={{
          maxHeight: "calc(100vh - 460px)",
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {marcajes.map((item, i) => {
          const hora = formatHoraHN(item.fecha_hora);

          if (item.tipo_marcaje === "fin_jornada") {
            return (
              <div key={i} className="historial-item fin_jornada">
                <div className="location">
                  <i className="fa-solid fa-lock" style={{ fontSize: 14 }} />
                  Fin de Jornada
                </div>
                <div className="time">
                  <i className="fa-regular fa-clock" style={{ fontSize: 12 }} />
                  {hora}
                </div>
              </div>
            );
          }

          if (item.tipo_actividad === "almuerzo") {
            return (
              <div key={i} className={`historial-item ${item.tipo_marcaje}`}>
                <div className="location">
                  <i className="fa-solid fa-utensils" style={{ fontSize: 14 }} />
                  Hora de Almuerzo
                </div>
                <div className="details">
                  <i
                    className={item.tipo_marcaje === "entrada" ? "fa-solid fa-play" : "fa-solid fa-stop"}
                    style={{ fontSize: 11 }}
                  />
                  {item.tipo_marcaje === "entrada" ? "Inicio de almuerzo" : "Fin de almuerzo"}
                </div>
                <div className="time">
                  <i className="fa-regular fa-clock" style={{ fontSize: 12 }} />
                  {hora}
                </div>
              </div>
            );
          }

          const isRec = item.tipo_actividad === "recoleccion";
          const tipoTexto = isRec ? "Recolección" : "Envío";
          const marcajeTexto = isRec
            ? item.tipo_marcaje === "entrada"
              ? "Inicio de viaje"
              : "Fin de viaje"
            : item.tipo_marcaje === "entrada"
              ? "Entrada"
              : "Salida";

          return (
            <div key={i} className={`historial-item ${item.tipo_marcaje}`}>
              <div className="location">
                <i
                  className={
                    isRec ? "fa-solid fa-box-open" : "fa-solid fa-map-marker-alt"
                  }
                  style={{ fontSize: 14 }}
                />
                {(() => {
                  const ub = ubicMap[item.ubicacion_id];
                  if (ub?.grupo_id && ubicMap[ub.grupo_id]) {
                    return (
                      <span>
                        <span style={{ color: "var(--gray-500)" }}>{ubicMap[ub.grupo_id].nombre}</span>
                        <i className="fa-solid fa-chevron-right" style={{ fontSize: 9, margin: "0 5px", color: "var(--gray-400)" }} />
                        {ub.nombre}
                      </span>
                    );
                  }
                  return item.ubicaciones?.nombre || "-";
                })()}
              </div>
              <div className="details">
                <i
                  className={
                    item.tipo_marcaje === "entrada"
                      ? isRec ? "fa-solid fa-play" : "fa-solid fa-arrow-right-to-bracket"
                      : isRec ? "fa-solid fa-stop" : "fa-solid fa-arrow-right-from-bracket"
                  }
                  style={{ fontSize: 11 }}
                />
                {tipoTexto} · {marcajeTexto}
              </div>
              <div className="badges">
                {item.tipo_marcaje === "salida" &&
                  item.tiempo_en_ruta != null && (
                    <span className="badge badge-ruta">
                      <i
                        className={isRec ? "fa-solid fa-road" : "fa-solid fa-clock"}
                        style={{ fontSize: 10 }}
                      />
                      {isRec
                        ? `En ruta: ${formatMinutos(item.tiempo_en_ruta)}`
                        : `En parada: ${formatMinutos(item.tiempo_en_ruta)}`}
                    </span>
                  )}
                {item.tipo_marcaje === "entrada" &&
                  item.tiempo_en_sucursal != null && (
                    <span
                      className={`badge ${item.tiempo_en_sucursal > 15 ? "badge-alerta" : "badge-sucursal"}`}
                    >
                      <i
                        className="fa-solid fa-building"
                        style={{ fontSize: 10 }}
                      />
                      En sucursal: {formatMinutos(item.tiempo_en_sucursal)}
                    </span>
                  )}
              </div>
              <div className="time">
                <i className="fa-regular fa-clock" style={{ fontSize: 12 }} />
                {hora}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
