import { supabase } from "./supabase";
import { calcularTiempos, getRangoDia, getFechaHoyHonduras } from "./utils";

// ─── AUTH ────────────────────────────────────────────────────────────────────
// Login con Supabase Auth: las contraseñas las maneja Supabase (bcrypt).
// El email interno es {dni}@motoristas.local — el usuario solo escribe su DNI.

/**
 * Wrapper de timeout para promesas de auth.
 * En PWA el SDK puede quedar colgado si un autoRefresh previo no se resolvió;
 * este wrapper garantiza que la operación siempre termine en < ms milisegundos.
 */
function conTimeout(promesa, ms = 10000) {
  return Promise.race([
    promesa,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("auth_timeout")), ms),
    ),
  ]);
}

export async function login(dni, password) {
  const email = `${dni}@motoristas.local`;

  let authData, authError;
  try {
    ({ data: authData, error: authError } = await conTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      20000,
    ));
  } catch {
    return {
      success: false,
      error: "Error de conexión. Verifica tu red e intenta de nuevo.",
    };
  }

  if (authError || !authData.user) {
    return { success: false, error: "Credenciales inválidas" };
  }

  // Perfil interno (rol, zona, nombre) ligado al auth_user_id
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, dni, nombre_completo, zona, rol, activo")
    .eq("auth_user_id", authData.user.id)
    .single();

  if (error || !data) {
    await supabase.auth.signOut();
    return { success: false, error: "Usuario no encontrado en el sistema" };
  }
  if (!data.activo) {
    await supabase.auth.signOut();
    return { success: false, error: "Usuario inactivo" };
  }

  return {
    success: true,
    user: {
      id: data.id,
      dni: data.dni,
      nombre_completo: data.nombre_completo,
      zona: data.zona,
      rol: data.rol,
    },
  };
}

/**
 * Restaura la sesión activa de Supabase Auth y devuelve el perfil interno.
 * El SDK guarda el JWT en localStorage automáticamente y lo refresca solo.
 */
export async function getSesionActual() {
  try {
    const { data, error } = await conTimeout(supabase.auth.getSession(), 6000);
    if (error || !data?.session) return { success: false };

    const session = data.session;
    const { data: perfil, error: perfilError } = await supabase
      .from("usuarios")
      .select("id, dni, nombre_completo, zona, rol, activo")
      .eq("auth_user_id", session.user.id)
      .single();

    if (perfilError || !perfil || !perfil.activo) return { success: false };

    return {
      success: true,
      user: {
        id: perfil.id,
        dni: perfil.dni,
        nombre_completo: perfil.nombre_completo,
        zona: perfil.zona,
        rol: perfil.rol,
      },
    };
  } catch (e) {
    const esTimeout = e?.message === "auth_timeout";
    return { success: false, timeout: esTimeout };
  }
}

export async function logout() {
  invalidarCacheFecha();
  await supabase.auth.signOut();
}

// ─── FECHA SERVIDOR ───────────────────────────────────────────────────────────
// Requiere la función SQL actualizada en Supabase (jornada inicia 5:00 AM HN):
//
//   CREATE OR REPLACE FUNCTION get_server_date()
//   RETURNS TEXT AS $$
//     SELECT TO_CHAR(
//       CASE
//         WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Tegucigalpa') < 5
//         THEN (NOW() AT TIME ZONE 'America/Tegucigalpa')::DATE - 1
//         ELSE (NOW() AT TIME ZONE 'America/Tegucigalpa')::DATE
//       END,
//       'YYYY-MM-DD'
//     );
//   $$ LANGUAGE sql STABLE;
//
// ─── AUTO FINALIZAR JORNADA (pg_cron) ────────────────────────────────────────
// Ejecutar en el SQL Editor de Supabase para programar el cierre automático
// de viajes abiertos a las 5:00 AM HN (= 11:00 AM UTC):
//
//   SELECT cron.schedule(
//     'auto-fin-jornada',
//     '0 11 * * *',
//     $$
//       INSERT INTO marcajes (usuario_id, tipo_marcaje, tipo_actividad)
//       SELECT DISTINCT m.usuario_id, 'fin_jornada', 'jornada'
//       FROM marcajes m
//       WHERE m.tipo_marcaje = 'entrada'
//         AND m.fecha_hora < NOW() - INTERVAL '5 hours'
//         AND NOT EXISTS (
//           SELECT 1 FROM marcajes m2
//           WHERE m2.usuario_id = m.usuario_id
//             AND m2.tipo_marcaje = 'fin_jornada'
//             AND m2.fecha_hora > m.fecha_hora
//             AND m2.fecha_hora > NOW() - INTERVAL '24 hours'
//         );
//     $$
//   );
// Cache de la fecha del servidor: evita RPC repetidos dentro de la misma sesión.
// TTL de 5 minutos es suficiente — la fecha solo cambia a las 5:00 AM HN.
let _serverDateCache = null;
let _serverDateCachedAt = 0;
const SERVER_DATE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getFechaServidor() {
  const now = Date.now();
  if (_serverDateCache && now - _serverDateCachedAt < SERVER_DATE_TTL_MS) {
    return _serverDateCache;
  }
  const { data } = await supabase.rpc("get_server_date");
  if (data) {
    _serverDateCache = data;
    _serverDateCachedAt = now;
  }
  return data || null;
}

/** Invalida el cache (llamar al hacer logout) */
export function invalidarCacheFecha() {
  _serverDateCache = null;
  _serverDateCachedAt = 0;
}

// ─── UBICACIONES ─────────────────────────────────────────────────────────────

export async function getUbicaciones(zona, tipo) {
  const { data, error } = await supabase
    .from("ubicaciones")
    .select("id, nombre, zona, tipo, orden, grupo_id")
    .eq("zona", zona)
    .eq("tipo", tipo)
    .order("orden", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
}

// ─── ESTADO ACTUAL ────────────────────────────────────────────────────────────

export async function getEstadoActual(usuarioId) {
  const fechaHoy = (await getFechaServidor()) ?? getFechaHoyHonduras();
  const { inicio, fin } = getRangoDia(fechaHoy);

  // Una sola query trae los últimos marcajes de hoy; filtramos client-side.
  // Esto reemplaza las 3 queries paralelas anteriores → 1 request total.
  const { data, error } = await supabase
    .from("marcajes")
    .select("*, ubicaciones(id, nombre)")
    .eq("usuario_id", usuarioId)
    .gte("fecha_hora", inicio)
    .lte("fecha_hora", fin)
    .order("fecha_hora", { ascending: false })
    .limit(20); // suficiente para cubrir una jornada normal

  if (error) return { success: false, error: error.message };

  const rows = data || [];
  const rGlobal = rows[0] || null;
  let rRec = rows.find((m) => m.tipo_actividad === "recoleccion") || null;
  const rEnv = rows.find((m) => m.tipo_actividad === "envios") || null;
  const rAlm = rows.find((m) => m.tipo_actividad === "almuerzo") || null;

  // Si el almuerzo terminó DESPUÉS del último marcaje de recolección,
  // anulamos rRec para que no aplique la restricción de continuidad de ruta.
  if (
    rAlm?.tipo_marcaje === "salida" &&
    rRec &&
    new Date(rAlm.fecha_hora) > new Date(rRec.fecha_hora)
  ) {
    rRec = null;
  }

  return {
    success: true,
    global: rGlobal,
    recoleccion: rRec,
    envios: rEnv,
    almuerzo: rAlm,
  };
}

// ─── VERIFICACIONES ───────────────────────────────────────────────────────────

export async function verificarRetornoBase(usuarioId) {
  const { data } = await supabase
    .from("marcajes")
    .select("*")
    .eq("usuario_id", usuarioId)
    .eq("tipo_actividad", "envios")
    .order("fecha_hora", { ascending: false })
    .limit(2);

  if (!data || data.length < 2)
    return { success: true, permitirRetornoBase: false };

  // Patrón de retorno: el último envío es una entrada al mismo lugar
  // donde terminó el envío anterior (salida→entrada en el mismo destino)
  const permitir =
    data[0].tipo_marcaje === "entrada" &&
    data[1].tipo_marcaje === "salida" &&
    data[0].ubicacion_id === data[1].ubicacion_id;

  return { success: true, permitirRetornoBase: permitir };
}

export async function esPrimeraMarcacionEnvio(usuarioId) {
  const { data } = await supabase
    .from("marcajes")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("fecha_hora", { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return { success: true, esPrimera: false };

  if (
    data[0].tipo_marcaje === "entrada" &&
    data[0].tipo_actividad === "envios"
  ) {
    for (let i = 1; i < data.length; i++) {
      if (
        data[i].tipo_actividad === "envios" &&
        data[i].tipo_marcaje === "salida"
      ) {
        return { success: true, esPrimera: false };
      }
      if (data[i].tipo_actividad === "recoleccion") {
        return { success: true, esPrimera: true };
      }
    }
    return { success: true, esPrimera: true };
  }

  return { success: true, esPrimera: false };
}

// ─── REGISTRAR MARCAJE ────────────────────────────────────────────────────────
// CLAVE: NO enviamos fecha_hora → Supabase usa DEFAULT now() del servidor.
// Esto reemplaza la lógica de horaServidor del GAS.

export async function registrarMarcaje(data) {
  // Timeout global de 15s — si el SW intercepta una query y la deja colgada,
  // el botón no queda en spinner infinito.
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("marcaje_timeout")), 15000),
  );
  try {
    return await Promise.race([_registrarMarcajeInterno(data), timeoutPromise]);
  } catch (e) {
    if (e.message === "marcaje_timeout")
      return {
        success: false,
        error:
          "Tiempo de espera agotado. Verifica tu conexión e intenta de nuevo.",
      };
    return { success: false, error: e.message || "Error inesperado" };
  }
}

async function _registrarMarcajeInterno(data) {
  const {
    usuarioId,
    ubicacionId,
    tipoMarcaje,
    tipoActividad,
    latitud,
    longitud,
  } = data;

  // ── Validar fecha del dispositivo contra el servidor ──────────────────────
  const fechaServidor = await getFechaServidor();
  if (!fechaServidor) {
    return {
      success: false,
      error: "No se pudo verificar la fecha del servidor. Intenta de nuevo.",
    };
  }
  const fechaCliente = getFechaHoyHonduras();
  if (fechaCliente !== fechaServidor) {
    return {
      success: false,
      error:
        "La fecha/hora de tu dispositivo no coincide con la del servidor. Sincroniza el reloj e intenta de nuevo.",
    };
  }

  // ── Validar almuerzo activo ───────────────────────────────────────────────
  const estadoActual = await getEstadoActual(usuarioId);
  if (
    estadoActual.success &&
    estadoActual.almuerzo?.tipo_marcaje === "entrada"
  ) {
    return {
      success: false,
      error: "Tienes hora de almuerzo activa. Finalízala primero.",
    };
  }

  // ── Validar viaje abierto de un día anterior ──────────────────────────────
  // Solo bloqueamos si el último marcaje histórico es una "entrada" sin cerrar
  // de un día distinto al de hoy. Una salida o fin_jornada de ayer es normal.
  const { data: ultimoArr } = await supabase
    .from("marcajes")
    .select("fecha_hora, tipo_marcaje")
    .eq("usuario_id", usuarioId)
    .order("fecha_hora", { ascending: false })
    .limit(1);

  if (ultimoArr && ultimoArr.length > 0) {
    const ultimo = ultimoArr[0];
    const fechaUltimoHN = new Date(ultimo.fecha_hora).toLocaleDateString(
      "en-CA",
      { timeZone: "America/Tegucigalpa" },
    );

    if (fechaUltimoHN !== fechaServidor && ultimo.tipo_marcaje === "entrada") {
      return {
        success: false,
        error: `Tienes un viaje abierto sin cerrar del ${fechaUltimoHN}. Contacta al administrador.`,
      };
    }
  }

  const payload = {
    usuario_id: usuarioId,
    ubicacion_id: ubicacionId,
    tipo_marcaje: tipoMarcaje,
    tipo_actividad: tipoActividad,
    latitud: latitud || null,
    longitud: longitud || null,
    motivo_demora: data.motivoDemora || null,
    // fecha_hora: omitida → DEFAULT now() en Supabase (hora del servidor)
  };

  const { data: inserted, error } = await supabase
    .from("marcajes")
    .insert(payload)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: inserted };
}

export async function registrarAlmuerzo(usuarioId, tipoMarcaje) {
  const { error } = await supabase.from("marcajes").insert({
    usuario_id: usuarioId,
    ubicacion_id: null,
    tipo_marcaje: tipoMarcaje,
    tipo_actividad: "almuerzo",
    // fecha_hora omitida → servidor
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function finalizarJornada(usuarioId) {
  // Verificar que no haya viaje activo ni almuerzo activo
  const estado = await getEstadoActual(usuarioId);
  if (estado.success && estado.almuerzo?.tipo_marcaje === "entrada") {
    return {
      success: false,
      error: "Tienes hora de almuerzo activa. Finalízala primero.",
    };
  }
  if (estado.success && estado.global?.tipo_marcaje === "entrada") {
    const tipo =
      estado.global.tipo_actividad === "recoleccion" ? "recolección" : "envío";
    return {
      success: false,
      error: `Tienes un viaje de ${tipo} activo. Finalízalo primero.`,
    };
  }

  const { error } = await supabase.from("marcajes").insert({
    usuario_id: usuarioId,
    ubicacion_id: null,
    tipo_marcaje: "fin_jornada",
    tipo_actividad: "jornada",
    // fecha_hora omitida → servidor
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── HISTORIAL ────────────────────────────────────────────────────────────────

export async function getHistorialDia(usuarioId) {
  const hoy = (await getFechaServidor()) ?? getFechaHoyHonduras();
  const { inicio, fin } = getRangoDia(hoy);

  const { data, error } = await supabase
    .from("marcajes")
    .select("*, ubicaciones(nombre)")
    .eq("usuario_id", usuarioId)
    .gte("fecha_hora", inicio)
    .lte("fecha_hora", fin)
    .order("fecha_hora", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: calcularTiempos(data || []) };
}

// ─── REPORTE PAGINADO (server-side) ──────────────────────────────────────────
// Trae exactamente 10 filas por página desde Supabase usando .range().
// Soporta rango de fechas (fechaDesde → fechaHasta).
// Los tiempos calculados NO se incluyen porque una paginación server-side rompe
// el emparejamiento entrada/salida; están disponibles en el Excel completo.

const ITEMS_PAGINA_REPORTE = 10;

export async function getReportePaginado({
  fechaDesde,
  fechaHasta,
  zona,
  motoristaId,
  pagina = 1,
}) {
  const { inicio } = getRangoDia(fechaDesde);
  const { fin } = getRangoDia(fechaHasta);

  // 1. Resolver qué usuarios aplican al filtro
  let qUsuarios = supabase
    .from("usuarios")
    .select("id, nombre_completo, zona")
    .eq("rol", "motorista");

  if (motoristaId) qUsuarios = qUsuarios.eq("id", motoristaId);
  else if (zona) qUsuarios = qUsuarios.eq("zona", zona);

  const { data: usuarios } = await qUsuarios;
  if (!usuarios?.length) {
    return {
      success: true,
      data: [],
      total: 0,
      totalPaginas: 1,
      paginaActual: pagina,
    };
  }

  const usuarioMap = Object.fromEntries(usuarios.map((u) => [u.id, u]));
  const ids = usuarios.map((u) => u.id);

  // 2. Query paginada con count exacto (1 sola petición al backend)
  const offset = (pagina - 1) * ITEMS_PAGINA_REPORTE;
  const { data, error, count } = await supabase
    .from("marcajes")
    .select("*, ubicaciones(nombre)", { count: "exact" })
    .in("usuario_id", ids)
    .gte("fecha_hora", inicio)
    .lte("fecha_hora", fin)
    .order("fecha_hora", { ascending: false })
    .range(offset, offset + ITEMS_PAGINA_REPORTE - 1);

  if (error) return { success: false, error: error.message };

  const rows = (data || []).map((m) => ({
    ...m,
    nombre_completo: usuarioMap[m.usuario_id]?.nombre_completo || "—",
    zona: usuarioMap[m.usuario_id]?.zona || "—",
  }));

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / ITEMS_PAGINA_REPORTE));

  return {
    success: true,
    data: rows,
    total,
    totalPaginas,
    paginaActual: pagina,
  };
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────

export async function getZonas() {
  const { data, error } = await supabase
    .from("usuarios")
    .select("zona")
    .eq("rol", "motorista");

  if (error) return { success: false, error: error.message };
  const zonas = [...new Set((data || []).map((u) => u.zona))].sort();
  return { success: true, data: zonas };
}

export async function getMotoristasDeZona(zona) {
  let query = supabase
    .from("usuarios")
    .select("id, nombre_completo, zona")
    .eq("rol", "motorista")
    .order("nombre_completo", { ascending: true });

  if (zona) query = query.eq("zona", zona);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
}

const ITEMS_POR_PAGINA = 10;

export async function getReporteAdmin({
  fecha,
  zona,
  motoristaId,
  pagina = 1,
}) {
  const { inicio, fin } = getRangoDia(fecha);

  // 1. Obtener usuarios
  let queryUsuarios = supabase
    .from("usuarios")
    .select("id, nombre_completo, zona")
    .eq("rol", "motorista")
    .order("zona", { ascending: true })
    .order("nombre_completo", { ascending: true });

  if (motoristaId) queryUsuarios = queryUsuarios.eq("id", motoristaId);
  else if (zona) queryUsuarios = queryUsuarios.eq("zona", zona);

  const { data: todosUsuarios } = await queryUsuarios;

  // 2. Filtrar solo los que tienen actividad ese día
  const { data: marcajesCheck } = await supabase
    .from("marcajes")
    .select("usuario_id")
    .gte("fecha_hora", inicio)
    .lte("fecha_hora", fin);

  const idsConActividad = new Set(
    (marcajesCheck || []).map((m) => m.usuario_id),
  );
  const usuariosActivos = (todosUsuarios || []).filter((u) =>
    idsConActividad.has(u.id),
  );

  const total = usuariosActivos.length;
  const totalPaginas = Math.max(1, Math.ceil(total / ITEMS_POR_PAGINA));
  const offset = (pagina - 1) * ITEMS_POR_PAGINA;
  const usuariosPagina = usuariosActivos.slice(
    offset,
    offset + ITEMS_POR_PAGINA,
  );

  if (usuariosPagina.length === 0) {
    return {
      success: true,
      data: [],
      total,
      totalPaginas,
      paginaActual: pagina,
    };
  }

  // 3. Obtener marcajes de la página
  const ids = usuariosPagina.map((u) => u.id);
  const { data: marcajes } = await supabase
    .from("marcajes")
    .select("*, ubicaciones(nombre)")
    .in("usuario_id", ids)
    .gte("fecha_hora", inicio)
    .lte("fecha_hora", fin)
    .order("usuario_id", { ascending: true })
    .order("fecha_hora", { ascending: true });

  const grupos = {};
  (marcajes || []).forEach((m) => {
    if (!grupos[m.usuario_id]) grupos[m.usuario_id] = [];
    grupos[m.usuario_id].push(m);
  });

  const resultado = usuariosPagina.map((u) => ({
    usuario_id: u.id,
    nombre_completo: u.nombre_completo,
    zona: u.zona,
    marcajes: calcularTiempos(grupos[u.id] || []),
  }));

  return {
    success: true,
    data: resultado,
    total,
    totalPaginas,
    paginaActual: pagina,
  };
}

// Acepta fechaDesde/fechaHasta para rango de fechas.
// Cuando es un solo día (fechaDesde === fechaHasta) calcula tiempos por usuario.
// Para rangos multi-día agrupa por usuario+día para tiempos correctos por jornada.
export async function getDataParaExcel({
  fechaDesde,
  fechaHasta,
  zona,
  motoristaId,
}) {
  const { inicio } = getRangoDia(fechaDesde);
  const { fin } = getRangoDia(fechaHasta);

  let queryUsuarios = supabase
    .from("usuarios")
    .select("id, nombre_completo, zona")
    .eq("rol", "motorista")
    .order("zona", { ascending: true })
    .order("nombre_completo", { ascending: true });

  if (motoristaId) queryUsuarios = queryUsuarios.eq("id", motoristaId);
  else if (zona) queryUsuarios = queryUsuarios.eq("zona", zona);

  const { data: todosUsuarios } = await queryUsuarios;
  if (!todosUsuarios?.length)
    return { success: false, error: "No hay datos para exportar" };

  const ids = todosUsuarios.map((u) => u.id);
  const usuarioMap = Object.fromEntries(todosUsuarios.map((u) => [u.id, u]));

  // Paginar la query para superar el límite de filas del servidor de Supabase
  const marcajes = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  while (true) {
    const { data: chunk, error: chunkError } = await supabase
      .from("marcajes")
      .select("*, ubicaciones(nombre)")
      .in("usuario_id", ids)
      .gte("fecha_hora", inicio)
      .lte("fecha_hora", fin)
      .order("usuario_id", { ascending: true })
      .order("fecha_hora", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (chunkError || !chunk?.length) break;
    marcajes.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    page++;
  }

  if (!marcajes.length)
    return { success: false, error: "No hay datos para exportar" };

  // Agrupar por usuario + día para calcular tiempos correctamente en rangos multi-día
  const grupos = {};
  (marcajes || []).forEach((m) => {
    const dia = new Date(m.fecha_hora).toLocaleDateString("en-CA", {
      timeZone: "America/Tegucigalpa",
    });
    const key = `${m.usuario_id}_${dia}`;
    if (!grupos[key]) grupos[key] = { usuarioId: m.usuario_id, dia, mjs: [] };
    grupos[key].mjs.push(m);
  });

  const rows = [];

  Object.values(grupos).forEach(({ usuarioId, mjs }) => {
    const u = usuarioMap[usuarioId];
    if (!u) return;
    calcularTiempos(mjs).forEach((m) => {
      const fechaLocal = new Date(m.fecha_hora);
      const fechaStr = fechaLocal.toLocaleDateString("en-CA", {
        timeZone: "America/Tegucigalpa",
      });
      const horaStr = fechaLocal.toLocaleTimeString("en-CA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "America/Tegucigalpa",
        hour12: false,
      });

      if (m.tipo_marcaje === "fin_jornada") {
        rows.push({
          motorista: u.nombre_completo,
          zona: u.zona,
          tipo_actividad: "Jornada",
          ubicacion: "Fin de Jornada",
          tipo_marcaje: "Fin",
          fecha: fechaStr,
          hora: horaStr,
          tiempo_sucursal: "",
          tiempo_ruta: "",
          tiempo_almuerzo: "",
          motivo_demora: m.motivo_demora || "",
        });
      } else {
        rows.push({
          motorista: u.nombre_completo,
          zona: u.zona,
          tipo_actividad:
            m.tipo_actividad === "recoleccion"
              ? "Recolección"
              : m.tipo_actividad === "almuerzo"
                ? "Almuerzo"
                : "Envío",
          ubicacion:
            m.tipo_actividad === "almuerzo"
              ? "Almuerzo"
              : m.ubicaciones?.nombre || "-",
          tipo_marcaje: m.tipo_marcaje === "entrada" ? "Inicio" : "Fin",
          fecha: fechaStr,
          hora: horaStr,
          tiempo_sucursal:
            m.tipo_actividad === "envios" ? "" : (m.tiempo_en_sucursal ?? ""),
          tiempo_ruta:
            m.tipo_actividad === "almuerzo" ? "" : (m.tiempo_en_ruta ?? ""),
          tiempo_almuerzo:
            m.tipo_actividad === "almuerzo" ? (m.tiempo_en_ruta ?? "") : "",
          motivo_demora: m.motivo_demora || "",
        });
      }
    });
  });

  // Ordenar por fecha + motorista para que el Excel sea legible
  rows.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) || a.motorista.localeCompare(b.motorista),
  );

  // Inyectar filas de "Espera" solo para recoleccion con T.Sucursal > 10 min
  const rowsConEspera = [];
  rows.forEach((row) => {
    rowsConEspera.push({ ...row, espera: "" });
    if (
      row.tipo_actividad === "Recolección" &&
      typeof row.tiempo_sucursal === "number" &&
      row.tiempo_sucursal > 10
    ) {
      rowsConEspera.push({
        ...row,
        tipo_marcaje: "Espera",
        tiempo_sucursal: "",
        espera: row.tiempo_sucursal - 10,
      });
    }
  });

  return { success: true, data: rowsConEspera };
}

// ─── TEMPERATURA ──────────────────────────────────────────────────────────────

export async function getTemperaturasHoy(usuarioId) {
  const fechaHoy = (await getFechaServidor()) ?? getFechaHoyHonduras();
  const { inicio, fin } = getRangoDia(fechaHoy);

  const { data, error } = await supabase
    .from("temperaturas")
    .select("*")
    .eq("usuario_id", usuarioId)
    .gte("fecha_hora", inicio)
    .lte("fecha_hora", fin)
    .order("fecha_hora", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
}

export async function getTemperaturasAdmin({
  fechaDesde,
  fechaHasta,
  zona,
  motoristaId,
}) {
  const { inicio } = getRangoDia(fechaDesde);
  const { fin } = getRangoDia(fechaHasta);

  let qUsuarios = supabase
    .from("usuarios")
    .select("id, nombre_completo, zona")
    .eq("rol", "motorista")
    .order("zona", { ascending: true })
    .order("nombre_completo", { ascending: true });

  if (motoristaId) qUsuarios = qUsuarios.eq("id", motoristaId);
  else if (zona) qUsuarios = qUsuarios.eq("zona", zona);

  const { data: usuarios } = await qUsuarios;
  if (!usuarios?.length) return { success: true, data: [] };

  const usuarioMap = Object.fromEntries(usuarios.map((u) => [u.id, u]));
  const ids = usuarios.map((u) => u.id);

  const { data, error } = await supabase
    .from("temperaturas")
    .select("*")
    .in("usuario_id", ids)
    .gte("fecha_hora", inicio)
    .lte("fecha_hora", fin)
    .order("fecha_hora", { ascending: true });

  if (error) return { success: false, error: error.message };

  const rows = (data || []).map((t) => ({
    ...t,
    nombre_completo: usuarioMap[t.usuario_id]?.nombre_completo || "—",
    zona: usuarioMap[t.usuario_id]?.zona || "—",
  }));

  return { success: true, data: rows };
}

export async function registrarTemperatura(usuarioId, temperatura) {
  // Verificar que la fecha del dispositivo coincide con la del servidor
  // (igual que registrarMarcaje — evita marcar con reloj manipulado)
  const fechaServidor = await getFechaServidor();
  if (!fechaServidor) {
    return {
      success: false,
      error: "No se pudo verificar la fecha del servidor. Intenta de nuevo.",
    };
  }
  const fechaCliente = getFechaHoyHonduras();
  if (fechaCliente !== fechaServidor) {
    return {
      success: false,
      error:
        "La fecha/hora de tu dispositivo no coincide con la del servidor. Sincroniza el reloj e intenta de nuevo.",
    };
  }

  // La validación de horario se hace en el servidor (función SQL registrar_temperatura)
  // para que nadie pueda bypassearla cambiando solo la hora del dispositivo.
  const { data, error } = await supabase.rpc("registrar_temperatura", {
    p_usuario_id: usuarioId,
    p_temperatura: parseFloat(parseFloat(temperatura).toFixed(1)),
  });

  if (error) return { success: false, error: error.message };
  return data; // { success, turno } o { success: false, error }
}
