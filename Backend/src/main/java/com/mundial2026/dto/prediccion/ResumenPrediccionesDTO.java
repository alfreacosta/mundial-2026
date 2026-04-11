package com.mundial2026.dto.prediccion;

/**
 * Resumen estadístico de las predicciones de partidos del usuario.
 * Usado en el dashboard para el widget de progreso.
 */
public record ResumenPrediccionesDTO(
        long totalPartidos,
        long predichas,
        long bloqueadas,
        int  totalPuntosPartidos,

        long exactas,       // marcador exacto → 3 puntos
        long correctas,     // resultado u/o diferencia correcta → 1-2 puntos
        long incorrectas,   // resultado incorrecto → 0 puntos (pred evaluada)

        boolean prediccionTorneoHecha,
        boolean prediccionTorneoConfirmada
) {}
