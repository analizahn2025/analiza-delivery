/**
 * Calcula tiempos en ruta y en sucursal para cada marcaje.
 * Filtra por tipo_actividad para que los marcajes de envíos
 * no contaminen los tiempos de los marcajes de recolección y viceversa.
 *
 * - salida:  tiempo_en_ruta     = (esta salida) − (última entrada del mismo tipo)
 *   · recolección: tiempo viajando entre sucursales
 *   · envíos:      tiempo en parada (entrada→salida en el mismo lugar)
 * - entrada: tiempo_en_sucursal = (esta entrada) − (última salida del mismo tipo + misma ubicación)
 */
export function calcularTiempos(rows) {
  // Pre-calcular períodos de almuerzo para descontarlos de tiempo_en_sucursal
  const almuerzos = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].tipo_actividad === "almuerzo" && rows[i].tipo_marcaje === "salida") {
      for (let j = i - 1; j >= 0; j--) {
        if (rows[j].tipo_actividad === "almuerzo" && rows[j].tipo_marcaje === "entrada") {
          almuerzos.push({
            inicio: new Date(rows[j].fecha_hora).getTime(),
            fin: new Date(rows[i].fecha_hora).getTime(),
          });
          break;
        }
      }
    }
  }

  return rows.map((row, i) => {
    const item = { ...row, tiempo_en_sucursal: null, tiempo_en_ruta: null };

    if (row.tipo_marcaje === "fin_jornada" || i === 0) return item;

    if (row.tipo_marcaje === "salida") {
      // Buscar la última entrada del MISMO tipo de actividad
      for (let j = i - 1; j >= 0; j--) {
        if (
          rows[j].tipo_marcaje === "entrada" &&
          rows[j].tipo_actividad === row.tipo_actividad
        ) {
          const ms = new Date(row.fecha_hora) - new Date(rows[j].fecha_hora);
          const min = Math.round(ms / 60000);
          if (!isNaN(min) && min >= 0) item.tiempo_en_ruta = min;
          break;
        }
      }
    }

    if (row.tipo_marcaje === "entrada") {
      // Buscar la última salida del MISMO tipo de actividad y misma ubicación
      for (let k = i - 1; k >= 0; k--) {
        if (
          rows[k].tipo_marcaje === "salida" &&
          rows[k].tipo_actividad === row.tipo_actividad &&
          rows[k].ubicacion_id === row.ubicacion_id
        ) {
          const salidaMs = new Date(rows[k].fecha_hora).getTime();
          const entradaMs = new Date(row.fecha_hora).getTime();
          let ms = entradaMs - salidaMs;

          // Descontar cualquier período de almuerzo que caiga dentro del intervalo
          for (const alm of almuerzos) {
            const overlapInicio = Math.max(alm.inicio, salidaMs);
            const overlapFin = Math.min(alm.fin, entradaMs);
            if (overlapFin > overlapInicio) ms -= overlapFin - overlapInicio;
          }

          const min = Math.round(ms / 60000);
          if (!isNaN(min) && min >= 0) item.tiempo_en_sucursal = min;
          break;
        }
      }
    }

    return item;
  });
}

export function formatMinutos(min) {
  if (min === null || min === undefined || isNaN(min)) return "-";
  if (min === 0) return "0 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ""}`;
}

/**
 * Fecha de trabajo en Honduras (UTC-6).
 * La jornada inicia a las 5:00 AM: si son las 00:00–04:59
 * se considera parte del día de trabajo anterior.
 */
export function getFechaHoyHonduras() {
  const ahora = new Date();
  const offsetMs = -6 * 60 * 60 * 1000;
  const fechaHN = new Date(ahora.getTime() + offsetMs);
  // Antes de las 5:00 AM pertenece al día de trabajo anterior
  if (fechaHN.getUTCHours() < 5) {
    fechaHN.setUTCDate(fechaHN.getUTCDate() - 1);
  }
  const year = fechaHN.getUTCFullYear();
  const month = String(fechaHN.getUTCMonth() + 1).padStart(2, "0");
  const day = String(fechaHN.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Rango de la jornada de trabajo: 05:00 AM del día indicado
 * hasta 04:59:59.999 AM del día siguiente (hora Honduras).
 * Devuelve ISO strings UTC para queries Supabase.
 */
export function getRangoDia(fechaStr) {
  const inicio = new Date(fechaStr + "T05:00:00-06:00");
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { inicio: inicio.toISOString(), fin: fin.toISOString() };
}

/** Formatea fecha UTC a hora Honduras para mostrar */
export function formatHoraHN(fechaUTC) {
  const fecha = new Date(fechaUTC);
  return fecha.toLocaleTimeString("es-HN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Tegucigalpa",
  });
}
