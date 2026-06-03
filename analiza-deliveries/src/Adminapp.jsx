import { useState, useEffect } from "react";
import Select from "react-select";
import Modal from "./Modal";
import AdminTemperaturaTab from "./AdminTemperaturaTab";
import {
  getZonas,
  getMotoristasDeZona,
  getReportePaginado,
  getDataParaExcel,
} from "./api";
import { formatHoraHN } from "./utils";
import * as XLSX from "xlsx";

const ADMIN_SECTIONS = [
  { id: "reporte",     icon: "fa-solid fa-table-list",       label: "Reporte" },
  { id: "temperatura", icon: "fa-solid fa-thermometer-half", label: "Temperatura" },
];

export default function AdminApp({ user, onLogout }) {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });

  const [isMobile, setIsMobile]             = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [activeTab, setActiveTab]           = useState("reporte");
  const [zonas, setZonas]                   = useState([]);
  const [todosMotoristas, setTodosMotoristas] = useState([]);
  const [filtroZona, setFiltroZona]         = useState("");
  const [filtroMotorista, setFiltroMotorista] = useState("");
  const [fechaDesde, setFechaDesde]         = useState(hoy);
  const [fechaHasta, setFechaHasta]         = useState(hoy);
  const [registros, setRegistros]           = useState(null);
  const [total, setTotal]                   = useState(0);
  const [totalPaginas, setTotalPaginas]     = useState(1);
  const [pagina, setPagina]                 = useState(1);
  const [loading, setLoading]               = useState(false);
  const [loadingExcel, setLoadingExcel]     = useState(false);
  const [showLogout, setShowLogout]         = useState(false);

  const motoristasVisibles = filtroZona
    ? todosMotoristas.filter((m) => m.zona === filtroZona)
    : todosMotoristas;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    getZonas().then((r) => { if (r.success) setZonas(r.data); });
    getMotoristasDeZona("").then((r) => { if (r.success) setTodosMotoristas(r.data); });
    buscar(1);
  }, []);

  const onZonaChange = (zona) => { setFiltroZona(zona); setFiltroMotorista(""); };

  const buscar = async (pag = 1) => {
    setLoading(true);
    const r = await getReportePaginado({
      fechaDesde, fechaHasta,
      zona: filtroZona,
      motoristaId: filtroMotorista ? parseInt(filtroMotorista) : null,
      pagina: pag,
    });
    setLoading(false);
    if (r.success) {
      setRegistros(r.data);
      setTotal(r.total);
      setTotalPaginas(r.totalPaginas);
      setPagina(r.paginaActual);
    }
  };

  const irPagina = (n) => buscar(n);

  const toExcelTime = (min) => {
    if (min === "" || min === null || min === undefined || isNaN(min)) return "";
    const n = typeof min === "number" ? min : parseInt(min);
    return (isNaN(n) || n === 0) ? "" : n / 1440;
  };

  const descargarExcel = async () => {
    setLoadingExcel(true);
    const r = await getDataParaExcel({
      fechaDesde, fechaHasta,
      zona: filtroZona,
      motoristaId: filtroMotorista ? parseInt(filtroMotorista) : null,
    });
    setLoadingExcel(false);
    if (!r.success) { alert("Error: " + r.error); return; }

    const headers = ["Motorista","Zona","Tipo Actividad","Ubicación","Tipo Marcaje","Fecha","Hora","T. Sucursal","T. Ruta","T. Almuerzo","Espera"];
    const wsData = [
      headers,
      ...r.data.map((row) => [
        row.motorista, row.zona, row.tipo_actividad, row.ubicacion,
        row.tipo_marcaje, row.fecha, row.hora,
        toExcelTime(row.tiempo_sucursal), toExcelTime(row.tiempo_ruta),
        toExcelTime(row.tiempo_almuerzo), toExcelTime(row.espera),
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [25,15,15,30,12,12,10,12,10,12,10].map((w) => ({ wch: w }));
    ws["!autofilter"] = { ref: ws["!ref"] };

    const TIME_COLS = [7, 8, 9, 10];
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = 1; R <= range.e.r; R++) {
      const isEspera = ws[XLSX.utils.encode_cell({ r: R, c: 4 })]?.v === "Espera";
      for (let C = 0; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { t: "s", v: "" };
        const isTime = TIME_COLS.includes(C) && ws[addr].t === "n";
        if (isTime) ws[addr].z = "hh:mm:ss";
        if (isEspera) {
          ws[addr].s = {
            fill: { patternType: "solid", fgColor: { rgb: "FFCCCC" } },
            font: { color: { rgb: "CC0000" } },
            ...(isTime ? { numFmt: "hh:mm:ss" } : {}),
          };
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    const rango = fechaDesde === fechaHasta ? fechaDesde : `${fechaDesde}_${fechaHasta}`;
    XLSX.writeFile(wb, `reporte_deliveries_${rango}.xlsx`, { cellStyles: true });
  };

  const formatFecha = (iso) =>
    new Date(iso).toLocaleDateString("es-HN", {
      timeZone: "America/Tegucigalpa",
      day: "2-digit", month: "2-digit", year: "numeric",
    });

  /* ── Iniciales del usuario ── */
  const initials = user.nombre_completo
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const navTo = (id) => { setActiveTab(id); if (isMobile) setSidebarOpen(false); };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--gray-50)" }}>

      {/* Backdrop móvil */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300 }}
        />
      )}

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <nav
        className={isMobile ? `drawer${sidebarOpen ? " drawer-open" : ""}` : undefined}
        style={isMobile ? undefined : {
          width: 230, flexShrink: 0,
          background: "var(--primary-dark)",
          display: "flex", flexDirection: "column",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >

        {/* Brand */}
        <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(59,130,246,0.35)",
            }}>
              <i className="fa-solid fa-truck-fast" style={{ color: "white", fontSize: 15 }} />
            </div>
            <div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 15, lineHeight: 1.15, letterSpacing: "-0.3px" }}>
                Analiza
              </div>
              <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: 500, marginTop: 1 }}>
                Panel Admin
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase",
            color: "rgba(255,255,255,0.25)", padding: "8px 10px 6px",
          }}>
            Módulos
          </div>
          {ADMIN_SECTIONS.map(({ id, icon, label }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => navTo(id)}
                style={{
                  display: "flex", alignItems: "center", gap: 11,
                  padding: "10px 12px", border: "none", borderRadius: 9, width: "100%",
                  background: isActive ? "rgba(255,255,255,0.11)" : "transparent",
                  color: isActive ? "white" : "rgba(255,255,255,0.52)",
                  cursor: "pointer", fontSize: 13, fontWeight: isActive ? 650 : 500,
                  textAlign: "left", transition: "all 0.14s",
                  boxShadow: isActive ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: isActive ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  transition: "background 0.14s",
                }}>
                  <i className={icon} style={{ fontSize: 13 }} />
                </div>
                {label}
                {isActive && (
                  <div style={{
                    marginLeft: "auto", width: 5, height: 5,
                    borderRadius: "50%", background: "#60a5fa", flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* User + logout */}
        <div style={{ padding: "12px 10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", borderRadius: 9,
            background: "rgba(255,255,255,0.05)",
            marginBottom: 8,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg, #4f46e5, #2563eb)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px",
            }}>
              {initials}
            </div>
            <div style={{ overflow: "hidden", minWidth: 0 }}>
              <div style={{
                color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {user.nombre_completo}
              </div>
              <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 11 }}>Administrador</div>
            </div>
          </div>
          <button
            onClick={() => setShowLogout(true)}
            style={{
              width: "100%", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
              background: "transparent", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 8, color: "rgba(255,255,255,0.42)",
              cursor: "pointer", fontSize: 12, fontWeight: 500,
              transition: "all 0.14s",
            }}
          >
            <i className="fa-solid fa-right-from-bracket" style={{ fontSize: 11 }} />
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* ══════════════════ CONTENIDO ══════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar móvil */}
        {isMobile && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 16px",
            background: "var(--primary-dark)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
                width: 36, height: 36, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <i className="fa-solid fa-bars" style={{ color: "white", fontSize: 15 }} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 6px rgba(59,130,246,0.35)", flexShrink: 0,
              }}>
                <i className="fa-solid fa-truck-fast" style={{ color: "white", fontSize: 12 }} />
              </div>
              <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>Analiza</span>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>· Panel Admin</span>
            </div>
          </div>
        )}

        {/* ── Reporte ── */}
        {activeTab === "reporte" && (
          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* Filtros sticky */}
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

                <button onClick={() => buscar(1)} disabled={loading} style={btnStyle}>
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

            {/* Tabla */}
            <div style={{ padding: "24px 28px 48px" }}>

              {loading && (
                <div className="spinner-container">
                  <div className="spinner-large" />
                  <p className="spinner-text">Cargando reporte...</p>
                </div>
              )}

              {!loading && registros !== null && registros.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <i className="fa-regular fa-calendar-xmark" style={{ fontSize: 48, color: "var(--gray-300)" }} />
                  </div>
                  <p>No hay registros para el rango seleccionado</p>
                </div>
              )}

              {!loading && registros && registros.length > 0 && (
                <div style={{
                  background: "var(--white)", borderRadius: 12,
                  border: "1px solid var(--gray-200)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden",
                }}>
                  {/* Card header */}
                  <div style={{
                    padding: "14px 20px", borderBottom: "1px solid var(--gray-100)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-600)" }}>
                      <i className="fa-solid fa-list-ul" style={{ marginRight: 7, color: "var(--primary)", opacity: 0.7 }} />
                      {total} registro{total !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--gray-400)" }}>
                      Página {pagina} de {totalPaginas}
                    </span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table className="report-table" style={{ minWidth: 680 }}>
                      <thead>
                        <tr>
                          <th>Motorista</th>
                          <th>Zona</th>
                          <th>Actividad</th>
                          <th>Sucursal</th>
                          <th>Evento</th>
                          <th style={{ textAlign: "right" }}>Fecha</th>
                          <th style={{ textAlign: "right" }}>Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registros.map((m, i) => {
                          if (m.tipo_marcaje === "fin_jornada") {
                            return (
                              <tr key={i} className="fin_jornada">
                                <td style={{ fontWeight: 500, color: "var(--gray-700)" }}>{m.nombre_completo}</td>
                                <td style={{ color: "var(--gray-500)" }}>{m.zona}</td>
                                <td colSpan={3} style={{ color: "var(--gray-500)", fontSize: 13 }}>
                                  <i className="fa-solid fa-lock" style={{ marginRight: 6, fontSize: 10 }} />
                                  Fin de Jornada
                                </td>
                                <td style={{ textAlign: "right", color: "var(--gray-500)", fontSize: 13 }}>{formatFecha(m.fecha_hora)}</td>
                                <td style={{ textAlign: "right", color: "var(--gray-500)", fontSize: 13 }}>{formatHoraHN(m.fecha_hora)}</td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={i} className={m.tipo_marcaje}>
                              <td style={{ fontWeight: 500, color: "var(--gray-800)" }}>{m.nombre_completo}</td>
                              <td style={{ color: "var(--gray-600)" }}>{m.zona}</td>
                              <td>{m.tipo_actividad === "recoleccion" ? "Recolección" : m.tipo_actividad === "almuerzo" ? "Almuerzo" : "Envío"}</td>
                              <td>{m.ubicaciones?.nombre || "—"}</td>
                              <td>
                                <span className={`tipo-chip ${m.tipo_marcaje === "entrada" ? "chip-entrada" : "chip-salida"}`}>
                                  {m.tipo_marcaje === "entrada" ? "Inicio" : "Fin"}
                                </span>
                              </td>
                              <td style={{ textAlign: "right", color: "var(--gray-600)", fontSize: 13 }}>{formatFecha(m.fecha_hora)}</td>
                              <td style={{ textAlign: "right" }}>{formatHoraHN(m.fecha_hora)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Card footer: paginación */}
                  <div style={{
                    padding: "12px 20px", borderTop: "1px solid var(--gray-100)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                  }}>
                    <button className="btn-page" onClick={() => irPagina(pagina - 1)} disabled={pagina <= 1 || loading}>
                      <i className="fa-solid fa-chevron-left" style={{ fontSize: 10 }} /> Anterior
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                        const start = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
                        return start + i;
                      }).map((n) => (
                        <button key={n} onClick={() => irPagina(n)} disabled={loading} style={{
                          padding: "6px 11px", borderRadius: 8, border: "1.5px solid",
                          borderColor: n === pagina ? "var(--primary)" : "var(--gray-200)",
                          background: n === pagina ? "var(--primary)" : "var(--white)",
                          color: n === pagina ? "white" : "var(--gray-700)",
                          fontWeight: 600, fontSize: 13, cursor: "pointer", minWidth: 34,
                        }}>
                          {n}
                        </button>
                      ))}
                    </div>

                    <button className="btn-page" onClick={() => irPagina(pagina + 1)} disabled={pagina >= totalPaginas || loading}>
                      Siguiente <i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Temperatura ── */}
        {activeTab === "temperatura" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <AdminTemperaturaTab
              zonas={zonas}
              todosMotoristas={todosMotoristas}
              selectStyles={selectStyles}
            />
          </div>
        )}

      </div>

      {showLogout && (
        <Modal
          title="¿Cerrar sesión?"
          message="Se cerrará su sesión actual"
          onConfirm={onLogout}
          onCancel={() => setShowLogout(false)}
        />
      )}
    </div>
  );
}

// ── Estilos compartidos ────────────────────────────────────────────────────────
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

export const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: state.isFocused ? "var(--primary)" : "var(--gray-200)",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(30,58,138,0.1)" : "none",
    fontSize: 14, background: "var(--white)", cursor: "pointer",
    "&:hover": { borderColor: "var(--primary)" },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px", flexWrap: "nowrap" }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  dropdownIndicator: (base) => ({ ...base, padding: "4px 6px" }),
  clearIndicator: (base) => ({ ...base, padding: "4px 4px" }),
  singleValue: (base) => ({ ...base, fontSize: 14, color: "var(--gray-800)" }),
  placeholder: (base) => ({ ...base, fontSize: 14, color: "var(--gray-400)" }),
  option: (base, state) => ({
    ...base, fontSize: 14, padding: "8px 12px",
    backgroundColor: state.isSelected ? "var(--primary)" : state.isFocused ? "#eff6ff" : "white",
    color: state.isSelected ? "white" : "var(--gray-800)", cursor: "pointer",
  }),
  menu: (base) => ({
    ...base, borderRadius: 6,
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
    border: "1.5px solid var(--gray-200)", zIndex: 200,
  }),
  menuPortal: (base) => ({ ...base, zIndex: 200 }),
};
