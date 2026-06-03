import { useState, useEffect } from "react";
import Select from "react-select";
import * as XLSX from "xlsx";
import { getTemperaturasAdmin } from "./api";

const TURNO_LABEL = { manana: "Turno Mañana", tarde: "Turno Tarde" };

export default function AdminTemperaturaTab({ zonas, todosMotoristas, selectStyles }) {
  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Tegucigalpa",
  });

  const [fechaDesde, setFechaDesde]         = useState(hoy);
  const [fechaHasta, setFechaHasta]         = useState(hoy);
  const [filtroZona, setFiltroZona]         = useState("");
  const [filtroMotorista, setFiltroMotorista] = useState("");
  const [registros, setRegistros]           = useState(null);
  const [loading, setLoading]               = useState(false);
  const [loadingExcel, setLoadingExcel]     = useState(false);

  const motoristasVisibles = filtroZona
    ? todosMotoristas.filter((m) => m.zona === filtroZona)
    : todosMotoristas;

  useEffect(() => { buscar(); }, []);

  const onZonaChange = (zona) => {
    setFiltroZona(zona);
    setFiltroMotorista("");
  };

  const buscar = async () => {
    setLoading(true);
    const r = await getTemperaturasAdmin({
      fechaDesde,
      fechaHasta,
      zona: filtroZona,
      motoristaId: filtroMotorista ? parseInt(filtroMotorista) : null,
    });
    setLoading(false);
    if (r.success) setRegistros(r.data);
  };

  const descargarExcel = async () => {
    setLoadingExcel(true);
    const r = await getTemperaturasAdmin({
      fechaDesde,
      fechaHasta,
      zona: filtroZona,
      motoristaId: filtroMotorista ? parseInt(filtroMotorista) : null,
    });
    setLoadingExcel(false);
    if (!r.success || !r.data.length) { alert("No hay datos para exportar"); return; }

    const headers = ["Motorista", "Zona", "Fecha", "Turno", "Temperatura (°C)", "Hora"];
    const wsData = [
      headers,
      ...r.data.map((row) => {
        const dt = new Date(row.fecha_hora);
        const fecha = dt.toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });
        const hora  = dt.toLocaleTimeString("es-HN", { timeZone: "America/Tegucigalpa", hour: "2-digit", minute: "2-digit" });
        return [
          row.nombre_completo,
          row.zona,
          fecha,
          TURNO_LABEL[row.turno] || row.turno,
          row.temperatura,
          hora,
        ];
      }),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [28, 15, 12, 15, 18, 10].map((w) => ({ wch: w }));
    ws["!autofilter"] = { ref: ws["!ref"] };
    XLSX.utils.book_append_sheet(wb, ws, "Temperaturas");
    const rango = fechaDesde === fechaHasta ? fechaDesde : `${fechaDesde}_${fechaHasta}`;
    XLSX.writeFile(wb, `temperaturas_${rango}.xlsx`);
  };

  const formatFechaHora = (iso) => {
    const dt = new Date(iso);
    return {
      fecha: dt.toLocaleDateString("es-HN", { timeZone: "America/Tegucigalpa", day: "2-digit", month: "2-digit", year: "numeric" }),
      hora:  dt.toLocaleTimeString("es-HN", { timeZone: "America/Tegucigalpa", hour: "2-digit", minute: "2-digit" }),
    };
  };

  return (
    <div style={{ background: "var(--gray-50)", minHeight: "100%" }}>

      {/* Filtros */}
      <div style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--gray-200)",
        padding: "14px 28px",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>

          <div style={{ flex: "1 1 130px" }}>
            <label style={lblStyle}>Zona</label>
            <Select
              options={zonas.map((z) => ({ value: z, label: z }))}
              value={filtroZona ? { value: filtroZona, label: filtroZona } : null}
              onChange={(opt) => onZonaChange(opt?.value || "")}
              styles={selectStyles}
              placeholder="Todas las zonas"
              noOptionsMessage={() => "Sin resultados"}
              isClearable isSearchable
            />
          </div>

          <div style={{ flex: "2 1 180px" }}>
            <label style={lblStyle}>Motorista</label>
            <Select
              options={motoristasVisibles.map((m) => ({ value: String(m.id), label: m.nombre_completo }))}
              value={filtroMotorista
                ? { value: filtroMotorista, label: motoristasVisibles.find((m) => String(m.id) === filtroMotorista)?.nombre_completo || "" }
                : null}
              onChange={(opt) => setFiltroMotorista(opt?.value || "")}
              styles={selectStyles}
              placeholder="Todos los motoristas"
              noOptionsMessage={() => "Sin resultados"}
              isClearable isSearchable
            />
          </div>

          <div style={{ flex: "0 1 148px" }}>
            <label style={lblStyle}>Desde</label>
            <input type="date" value={fechaDesde} max={fechaHasta}
              onChange={(e) => setFechaDesde(e.target.value)} style={selStyle} />
          </div>

          <div style={{ flex: "0 1 148px" }}>
            <label style={lblStyle}>Hasta</label>
            <input type="date" value={fechaHasta} min={fechaDesde}
              onChange={(e) => setFechaHasta(e.target.value)} style={selStyle} />
          </div>

          <button onClick={buscar} disabled={loading} style={btnStyle}>
            {loading
              ? <span className="spinner-inline" style={{ width: 13, height: 13 }} />
              : <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 12 }} />}
            Buscar
          </button>

          <button onClick={descargarExcel} disabled={loadingExcel} style={{ ...btnStyle, background: "#059669" }}>
            {loadingExcel
              ? <span className="spinner-inline" style={{ width: 13, height: 13 }} />
              : <i className="fa-solid fa-file-excel" style={{ fontSize: 12 }} />}
            Excel
          </button>

        </div>
      </div>

      {/* Contenido */}
      <div style={{ padding: "24px 28px 48px" }}>

        {loading && (
          <div className="spinner-container">
            <div className="spinner-large" />
            <p className="spinner-text">Cargando temperaturas...</p>
          </div>
        )}

        {!loading && registros !== null && registros.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="fa-solid fa-temperature-list" style={{ fontSize: 48, color: "var(--gray-300)" }} />
            </div>
            <p>No hay registros de temperatura para el filtro seleccionado</p>
          </div>
        )}

        {!loading && registros && registros.length > 0 && (
          <div style={{
            background: "var(--white)",
            borderRadius: 12,
            border: "1px solid var(--gray-200)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}>
            {/* Card header */}
            <div style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--gray-100)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-600)" }}>
                <i className="fa-solid fa-thermometer-half" style={{ marginRight: 7, color: "var(--primary)", opacity: 0.7 }} />
                {registros.length} registro{registros.length !== 1 ? "s" : ""}
              </span>
              <span style={{ fontSize: 12, color: "var(--gray-400)" }}>
                {fechaDesde === fechaHasta ? fechaDesde : `${fechaDesde} → ${fechaHasta}`}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="report-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Motorista</th>
                    <th>Zona</th>
                    <th>Turno</th>
                    <th style={{ textAlign: "right" }}>Temperatura</th>
                    <th style={{ textAlign: "right" }}>Fecha</th>
                    <th style={{ textAlign: "right" }}>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r, i) => {
                    const { fecha, hora } = formatFechaHora(r.fecha_hora);
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, color: "var(--gray-800)" }}>{r.nombre_completo}</td>
                        <td style={{ color: "var(--gray-600)" }}>{r.zona}</td>
                        <td>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 12, fontWeight: 600,
                            color: r.turno === "manana" ? "#b45309" : "#1d4ed8",
                            background: r.turno === "manana" ? "#fef3c7" : "#dbeafe",
                            padding: "3px 9px", borderRadius: 6,
                          }}>
                            <i className={r.turno === "manana" ? "fa-solid fa-sun" : "fa-solid fa-cloud-sun"} style={{ fontSize: 10 }} />
                            {TURNO_LABEL[r.turno] || r.turno}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: "var(--gray-800)" }}>
                          {r.temperatura}°C
                        </td>
                        <td style={{ textAlign: "right", color: "var(--gray-500)", fontSize: 13 }}>{fecha}</td>
                        <td style={{ textAlign: "right", color: "var(--gray-500)", fontSize: 13 }}>{hora}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const lblStyle = {
  display: "block", fontSize: 11, fontWeight: 600,
  color: "var(--gray-500)", textTransform: "uppercase",
  letterSpacing: "0.4px", marginBottom: 5,
};
const selStyle = {
  width: "100%", height: "38px", padding: "0 10px",
  borderRadius: 6, border: "1.5px solid var(--gray-200)",
  background: "var(--white)", color: "var(--gray-800)", fontSize: 14,
};
const btnStyle = {
  height: "36px", padding: "0 16px", borderRadius: 8,
  background: "var(--primary)", border: "none", color: "white",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
};
