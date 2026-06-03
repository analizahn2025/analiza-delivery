// MarcajeTab v3 - envíos = paradas dentro de una ruta de recolección
import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import { registrarMarcaje } from "./api";

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: state.isFocused ? "var(--primary)" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(30,58,138,0.1)" : "none",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    "&:hover": { borderColor: "var(--primary)" },
  }),
  option: (base, state) => ({
    ...base,
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: state.isSelected ? 600 : 400,
    backgroundColor: state.isSelected
      ? "var(--primary)"
      : state.isFocused
        ? "#eff6ff"
        : "white",
    color: state.isSelected ? "white" : "#334155",
    cursor: "pointer",
  }),
  group: (base) => ({
    ...base,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  groupHeading: (base) => ({
    ...base,
    fontSize: 11,
    fontWeight: 700,
    color: "var(--primary)",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    padding: "10px 16px 6px",
    marginBottom: 0,
    borderTop: "1.5px solid #e2e8f0",
    background: "#f8fafc",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    border: "1.5px solid #e2e8f0",
    zIndex: 9999,
  }),
  placeholder: (base) => ({ ...base, color: "#94a3b8", fontSize: 16 }),
  singleValue: (base) => ({ ...base, fontSize: 15, color: "#1e293b" }),
  input: (base) => ({ ...base, fontSize: 16 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

const alertaSelectStyles = {
  ...selectStyles,
  control: (base, state) => ({
    ...selectStyles.control(base, state),
    borderColor: "#dc2626",
    backgroundColor: "#fee2e2",
  }),
};

const motivosDemora = [
  { value: 'Muestras en centrifuga 10', label: 'Muestras en centrifuga 10' },
  { value: 'Muestras en centrifuga 15', label: 'Muestras en centrifuga 15' },
  { value: 'Muestras en centrifuga 20', label: 'Muestras en centrifuga 20' },
  { value: 'Esperando Muestra de Emergencia', label: 'Esperando Muestra de Emergencia' },
  { value: 'Esperando Muestra de Clinica Referidas', label: 'Esperando Muestra de Clinica Referidas' },
  { value: 'Solo un Tecnico en Sucursal', label: 'Solo un Tecnico en Sucursal' },
  { value: 'Esperando Documentacion en Sucursal', label: 'Esperando Documentacion en Sucursal' },
  { value: 'Esperando entrega de Envio', label: 'Esperando entrega de Envio' },
  { value: 'Esperando Muestras en CP de Ciudad Nueva', label: 'Esperando Muestras en CP de Ciudad Nueva' },
  { value: 'Esperando Envio para Sucursales CD', label: 'Esperando Envio para Sucursales CD' },
  { value: 'Esperando envio para Sucursales.', label: 'Esperando envio para Sucursales.' },
  { value: 'Esperando envio de Areas', label: 'Esperando envio de Areas' },
  { value: 'Realizando Envio de Area', label: 'Realizando Envio de Area' },
  { value: 'Esperando Envio Foraneo', label: 'Esperando Envio Foraneo' },
  { value: 'Entregando Documentacion en Sucursal', label: 'Entregando Documentacion en Sucursal' },
  { value: 'Entregando Muestras y Documentacion areas', label: 'Entregando Muestras y Documentacion areas' },
  { value: 'Realizando Domicilio de Zona', label: 'Realizando Domicilio de Zona' },
  { value: 'No tengo muestra en Ruta', label: 'No tengo muestra en Ruta' },
];

const okSelectStyles = {
  ...selectStyles,
  control: (base, state) => ({
    ...selectStyles.control(base, state),
    borderColor: "#059669",
  }),
};

export default function MarcajeTab({
  tipo,
  ubicaciones,
  estadoGlobal,
  estadoRecoleccion,
  estadoEnvio,
  recoleccionActiva,
  enviosActivo,
  onMarcajeOk,
  jornadaFinalizada,
  userId,
  almuerzoActivo,
}) {
  const [ubicacion, setUbicacion]       = useState(null); // selección principal
  const [subUbicacion, setSubUbicacion] = useState(null); // selección de hijo (clínica)
  const [alert, setAlert]               = useState(null);
  const [loadingEntrada, setLoadingEntrada] = useState(false);
  const [loadingSalida, setLoadingSalida]   = useState(false);
  const [motivoDemora, setMotivoDemora] = useState(null);

  const timerRef = useRef(null);

  const showAlert = (msg, type = "error", duration = 5000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAlert({ msg, type });
    if (duration > 0)
      timerRef.current = setTimeout(() => setAlert(null), duration);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Auto-seleccionar padre + hijo cuando hay una parada activa en un hijo (envío salida)
  // Así el motorista no tiene que buscar la clínica exacta para marcar salida.
  useEffect(() => {
    if (tipo !== "envios" || !estadoEnvio || estadoEnvio.tipo_marcaje !== "entrada") return;

    const hijoActivo = ubicaciones.find((u) => u.id === estadoEnvio.ubicacion_id);
    if (!hijoActivo?.grupo_id) return; // no es un hijo, nada que auto-seleccionar

    const padreUb = ubicaciones.find((u) => u.id === hijoActivo.grupo_id);
    if (!padreUb) return;

    setUbicacion({ value: String(padreUb.id), label: padreUb.nombre, tieneHijos: true });
    setSubUbicacion({ value: String(hijoActivo.id), label: hijoActivo.nombre });
  }, [estadoEnvio, ubicaciones, tipo]);

  const finJornada = jornadaFinalizada;

  const ultimaFechaMarcaje = estadoGlobal?.fecha_hora ? new Date(estadoGlobal.fecha_hora) : null;
  const minutosDesdeUltimoMarcaje = ultimaFechaMarcaje
    ? Math.floor((Date.now() - ultimaFechaMarcaje.getTime()) / 60000)
    : 0;
  const requiereMotivoDemora =
    tipo === "recoleccion" &&
    !finJornada &&
    !recoleccionActiva &&
    !enviosActivo &&
    !almuerzoActivo &&
    ["salida", "fin_jornada"].includes(estadoGlobal?.tipo_marcaje) &&
    minutosDesdeUltimoMarcaje >= 10;

  useEffect(() => {
    if (!requiereMotivoDemora) setMotivoDemora(null);
  }, [requiereMotivoDemora]);

  // ── ubicEsperada: restricción de próxima acción ──────────────────────────
  // Recolección: si el último marcaje fue "salida", la próxima entrada debe
  //              ser en esa misma ubicación (continuidad de ruta).
  // Envíos:      si hay una entrada activa, la salida debe ser en esa misma
  //              ubicación (confirmar que se sale del mismo lugar que se entró).
  const ubicEsperada = (() => {
    if (
      tipo === "recoleccion" &&
      estadoRecoleccion?.tipo_marcaje === "salida"
    ) {
      return {
        id: estadoRecoleccion.ubicacion_id,
        nombre: estadoRecoleccion.ubicaciones?.nombre || "ubicación anterior",
      };
    }
    if (tipo === "envios" && estadoEnvio?.tipo_marcaje === "entrada") {
      return {
        id: estadoEnvio.ubicacion_id,
        nombre: estadoEnvio.ubicaciones?.nombre || "ubicación activa",
      };
    }
    return null;
  })();

  // ── Lógica de habilitación ────────────────────────────────────────────────
  // Recolección — Inicio: no hay viaje activo y no hay parada de envío abierta
  // Recolección — Fin:    hay viaje activo y no hay parada de envío abierta
  // Envíos      — Entrada: hay viaje de recolección activo y no hay parada abierta
  // Envíos      — Salida:  hay parada de envío activa
  const puedeEntrada =
    tipo === "recoleccion"
      ? !finJornada && !recoleccionActiva && !enviosActivo
      : !finJornada && !enviosActivo && recoleccionActiva;

  const puedeSalida =
    tipo === "recoleccion"
      ? !finJornada && recoleccionActiva && !enviosActivo
      : !finJornada && enviosActivo;

  // ── Lógica de hijos (grupo_id) ───────────────────────────────────────────
  const hijosPorPadre = {};
  ubicaciones.filter((u) => u.grupo_id).forEach((u) => {
    if (!hijosPorPadre[u.grupo_id]) hijosPorPadre[u.grupo_id] = [];
    hijosPorPadre[u.grupo_id].push(u);
  });

  const padres = ubicaciones.filter((u) => !u.grupo_id);
  const padreSeleccionadoId = ubicacion ? parseInt(ubicacion.value) : null;
  const hijosDelPadre = padreSeleccionadoId ? (hijosPorPadre[padreSeleccionadoId] || []) : [];
  const tieneHijos = hijosDelPadre.length > 0;
  const subOptions = hijosDelPadre.map((u) => ({ value: String(u.id), label: u.nombre }));

  // El id final a registrar: hijo si tiene desglose, sino el padre directamente
  const ubicIdFinal = tieneHijos
    ? (subUbicacion ? parseInt(subUbicacion.value) : null)
    : padreSeleccionadoId;

  // ── Estilos del select ────────────────────────────────────────────────────
  const selectSeleccionado = ubicacion ? parseInt(ubicacion.value) : null;
  const esTipoIncorrecto =
    ubicEsperada &&
    ubicIdFinal &&
    ubicIdFinal !== ubicEsperada.id;

  const estilosSelect = () => {
    const base = esTipoIncorrecto
      ? alertaSelectStyles
      : ubicEsperada && selectSeleccionado === ubicEsperada.id
        ? okSelectStyles
        : selectStyles;
    return {
      ...base,
      option: (styles, state) => ({
        ...base.option(styles, state),
        ...(state.data.isRequerida && !state.isSelected
          ? {
              backgroundColor: state.isFocused ? "#fef3c7" : "#fffbeb",
              color: "#92400e",
              fontWeight: 700,
            }
          : {}),
      }),
    };
  };

  const options = padres.map((u) => ({
    value: String(u.id),
    label: ubicEsperada?.id === u.id ? `${u.nombre} (requerida)` : u.nombre,
    isRequerida: ubicEsperada?.id === u.id,
    tieneHijos: !!hijosPorPadre[u.id],
  })).sort((a, b) => (b.isRequerida ? 1 : 0) - (a.isRequerida ? 1 : 0));

  const handleSetUbicacion = (opt) => {
    setUbicacion(opt);
    setSubUbicacion(null); // reset hijo al cambiar padre
  };

  const handleRegistrar = async (tipoMarcaje) => {
    if (!ubicacion) {
      showAlert("Seleccione una ubicación", "warning");
      return;
    }
    if (tieneHijos && !subUbicacion) {
      showAlert("Seleccione una clínica específica", "warning");
      return;
    }
    const ubicId = ubicIdFinal;

    // Recolección entrada: debe iniciar en la ubicación esperada (continuidad de ruta)
    if (tipoMarcaje === "entrada" && tipo === "recoleccion") {
      if (ubicEsperada && ubicId !== ubicEsperada.id) {
        showAlert(
          `Solo puede iniciar desde "${ubicEsperada.nombre}"`,
          "error",
          0,
        );
        return;
      }
      if (requiereMotivoDemora && !motivoDemora) {
        showAlert(
          "Seleccione el motivo de demora antes de iniciar el viaje",
          "warning",
          0,
        );
        return;
      }
    }

    // Envíos salida: debe marcar salida en la misma ubicación donde entró
    if (tipoMarcaje === "salida" && tipo === "envios") {
      if (ubicEsperada && ubicId !== ubicEsperada.id) {
        showAlert(
          `Marque salida del envio de "${ubicEsperada.nombre}"`,
          "error",
          0,
        );
        return;
      }
    }

    const setter =
      tipoMarcaje === "entrada" ? setLoadingEntrada : setLoadingSalida;
    setter(true);

    try {
      const result = await registrarMarcaje({
        usuarioId: userId,
        ubicacionId: ubicId,
        tipoMarcaje,
        tipoActividad: tipo,
        motivoDemora: motivoDemora?.value || null,
      });

      setter(false);

      if (result.success) {
        const msg =
          tipo === "recoleccion"
            ? tipoMarcaje === "entrada"
              ? "Inicio de viaje registrado"
              : "Fin de viaje registrado"
            : tipoMarcaje === "entrada"
              ? "Entrada registrada"
              : "Salida registrada";
        showAlert(msg, "success");
        setUbicacion(null);
        setSubUbicacion(null);
        setMotivoDemora(null);
        onMarcajeOk();
      } else {
        showAlert(result.error, "error", 0);
      }
    } catch {
      setter(false);
      showAlert("Error de conexión. Intenta de nuevo.", "error", 0);
    }
  };

  const esEnviosDeshabilitado = tipo === "envios" && ubicaciones.length === 0;

  const selectDeshabilitado =
    finJornada || esEnviosDeshabilitado || (!puedeEntrada && !puedeSalida);

  return (
    <div className="content-card">
      {alert && (
        <div className={`alert alert-${alert.type}`}>
          <i
            className={
              alert.type === "success"
                ? "fa-solid fa-circle-check"
                : alert.type === "warning"
                  ? "fa-solid fa-triangle-exclamation"
                  : "fa-solid fa-circle-xmark"
            }
          />
          <span>{alert.msg}</span>
        </div>
      )}

      <div className="input-group">
        <label className="section-title">
          <i className="fa-solid fa-map-marker-alt" />
          {tipo === "recoleccion"
            ? "Ubicación de recolección"
            : "Destino de envío"}
        </label>
        <Select
          options={options}
          value={ubicacion}
          onChange={handleSetUbicacion}
          placeholder={
            esEnviosDeshabilitado
              ? "No disponible en su zona"
              : "Buscar ubicación..."
          }
          isDisabled={selectDeshabilitado}
          styles={{
            ...estilosSelect(),
            option: (base, state) => ({
              ...estilosSelect().option(base, state),
              ...(state.data.tieneHijos ? {
                display: "flex", alignItems: "center", justifyContent: "space-between",
              } : {}),
            }),
          }}
          formatOptionLabel={(opt) => (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{opt.label}</span>
              {opt.tieneHijos && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.4px",
                  background: "#eff6ff", color: "var(--primary)",
                  border: "1px solid #bfdbfe", borderRadius: 4,
                  padding: "2px 6px", marginLeft: 8, flexShrink: 0,
                }}>
                  DESGLOSE
                </span>
              )}
            </div>
          )}
          noOptionsMessage={() => "No se encontró"}
          menuPortalTarget={document.body}
          menuPosition="fixed"
        />

        {/* Segundo selector: aparece si el padre tiene hijos */}
        {tieneHijos && (
          <div style={{ marginTop: 12 }}>
            {/* Breadcrumb */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              marginBottom: 8, fontSize: 12, color: "var(--gray-500)",
            }}>
              <i className="fa-solid fa-location-dot" style={{ color: "var(--primary)", fontSize: 11 }} />
              <span style={{ fontWeight: 600, color: "var(--primary)" }}>{ubicacion.label}</span>
              <i className="fa-solid fa-chevron-right" style={{ fontSize: 9 }} />
              <span>{subUbicacion ? subUbicacion.label : "Selecciona clínica"}</span>
            </div>
            <Select
              options={subOptions}
              value={subUbicacion}
              onChange={setSubUbicacion}
              placeholder="Selecciona una clínica..."
              isDisabled={selectDeshabilitado}
              styles={selectStyles}
              noOptionsMessage={() => "No se encontró"}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>
        )}

        {/* Recolección: próxima entrada restringida a una ubicación */}
        {tipo === "recoleccion" && ubicEsperada && (
          <div className="ubicacion-esperada-banner">
            <i className="fa-solid fa-lock" style={{ marginTop: 2 }} />
            <span>
              Solo puede iniciar desde <strong>{ubicEsperada.nombre}</strong>
            </span>
          </div>
        )}

        {/* Recolección: parada de envío abierta, no puede cerrar el viaje todavía */}
        {tipo === "recoleccion" && enviosActivo && (
          <div className="ubicacion-esperada-banner">
            <i className="fa-solid fa-circle-info" style={{ marginTop: 2 }} />
            <span>
              Registre la salida de la parada antes de continuar con la ruta
            </span>
          </div>
        )}

        {/* Envíos: salida debe ser en la ubicación de la entrada activa */}
        {tipo === "envios" && ubicEsperada && (
          <div className="ubicacion-esperada-banner">
            <i className="fa-solid fa-lock" style={{ marginTop: 2 }} />
            <span>
              Marque salida en <strong>{ubicEsperada.nombre}</strong>
            </span>
          </div>
        )}

        {/* Envíos: no hay viaje de recolección activo */}
        {tipo === "envios" &&
          !recoleccionActiva &&
          !enviosActivo &&
          !finJornada &&
          ubicaciones.length > 0 && (
            <div className="ubicacion-esperada-banner">
              <i className="fa-solid fa-circle-info" style={{ marginTop: 2 }} />
              <span>Inicie un viaje de recolección para registrar paradas</span>
            </div>
          )}

        {almuerzoActivo && !finJornada && (
          <div className="ubicacion-esperada-banner">
            <i className="fa-solid fa-utensils" style={{ marginTop: 2 }} />
            <span>Tienes hora de almuerzo activa. Finalízala primero.</span>
          </div>
        )}

        {finJornada && (
          <div className="ubicacion-esperada-banner">
            <i className="fa-solid fa-lock" style={{ marginTop: 2 }} />
            <span>Jornada finalizada. No puede registrar más viajes.</span>
          </div>
        )}

        {esEnviosDeshabilitado && !finJornada && (
          <div className="ubicacion-esperada-banner">
            <i className="fa-solid fa-circle-info" style={{ marginTop: 2 }} />
            <span>No hay destinos de envío configurados para su zona</span>
          </div>
        )}

        {requiereMotivoDemora && (
          <div style={{ marginTop: 16 }}>
            <label className="section-title">
              <i className="fa-solid fa-clock" />
              Motivo de demora
            </label>
            <div style={{ marginTop: 8 }}>
              <Select
                options={motivosDemora}
                value={motivoDemora}
                onChange={setMotivoDemora}
                placeholder="Seleccione el motivo de demora"
                isClearable={false}
                isDisabled={selectDeshabilitado}
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--gray-600)" }}>
                Han pasado {minutosDesdeUltimoMarcaje} minutos desde el último cierre.
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        className="btn btn-success"
        onClick={() => handleRegistrar("entrada")}
        disabled={!puedeEntrada || loadingEntrada || !ubicIdFinal || almuerzoActivo}
      >
        {loadingEntrada ? (
          <span className="spinner-inline" />
        ) : (
          <i
            className={
              tipo === "recoleccion"
                ? "fa-solid fa-play"
                : "fa-solid fa-arrow-right-to-bracket"
            }
          />
        )}
        {tipo === "recoleccion" ? "Inicio de viaje" : "Entrada"}
      </button>

      <button
        className="btn btn-danger"
        onClick={() => handleRegistrar("salida")}
        disabled={!puedeSalida || loadingSalida || !ubicIdFinal || almuerzoActivo}
      >
        {loadingSalida ? (
          <span className="spinner-inline" />
        ) : (
          <i
            className={
              tipo === "recoleccion"
                ? "fa-solid fa-stop"
                : "fa-solid fa-arrow-right-from-bracket"
            }
          />
        )}
        {tipo === "recoleccion" ? "Fin de viaje" : "Salida"}
      </button>
    </div>
  );
}
