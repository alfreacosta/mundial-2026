# Mundial 2026

Aplicación web de predicciones y fantasy football para el **Mundial FIFA 2026** (USA, México y Canadá). Los usuarios arman convocatorias, predicen resultados, compiten en grupos privados y siguen el torneo en tiempo real.

## Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Angular + TypeScript | 20 / 5.9 |
| Backend | Java + Spring Boot | 21 / 3.5 |
| Base de Datos | PostgreSQL | 14+ |
| API Externa | API-Football (api-sports.io) | v3 |
| Auth | JWT (HS256) + Google OAuth2 | — |
| API | GraphQL (Spring GraphQL + Apollo Angular) | — |
| Deploy | Railway (backend + DB) · Vercel (frontend) | — |

## Funcionalidades

- **Registro / Login** — JWT + Google Sign-In
- **48 selecciones** con jugadores reales sincronizados desde API-Football
- **Convocatoria** — Armá tu lista de 26 jugadores por selección
- **Predicciones** — Resultado de cada partido (fase de grupos, eliminatorias)
- **Grupos privados** — Creá grupos, invitá amigos por link, ranking interno
- **Fixture completo** — 104 partidos con fecha, hora y estadio
- **Estadios** — Info y fotos de las sedes del Mundial
- **Estadísticas** — Goleadores, asistencias, tarjetas
- **Perfil público** — Buscá usuarios y mirá sus predicciones
- **Exportar a PDF** — Descargá tu convocatoria

## Estructura del Proyecto

```
Proyecto Futbol/
├── Backend/          ← API Spring Boot (GraphQL + REST)
├── Frontend/         ← Angular SPA
├── Database/         ← Scripts SQL (schema, seeds, migraciones)
├── Diagramas/        ← Diagramas de clases (.drawio)
├── tools/            ← Scripts Python de sincronización de datos
├── DEPLOY-PASOS.md   ← Guía de deploy a producción
└── SEGURIDAD.md      ← Auditoría de seguridad del proyecto
```

## Setup Local

### Requisitos
- Java 21
- Node.js 20+
- PostgreSQL 14+

### Base de datos
```bash
createdb -U postgres mundial
psql -U postgres -d mundial -f Database/schema.sql
psql -U postgres -d mundial -f Database/seed.sql
```

### Backend
```bash
cd Backend
cp src/main/resources/application.properties.example src/main/resources/application.properties
# Editá application.properties con tus credenciales locales
./mvnw spring-boot:run
```

### Frontend
```bash
cd Frontend
npm install
npm start
# → http://localhost:4200
```

El proxy (`proxy.conf.json`) redirige `/api` y `/graphql` al backend en `localhost:8080`.

## Deploy

- **Frontend:** Vercel (auto-deploy desde `main`)
- **Backend + DB:** Railway

Ver [DEPLOY-PASOS.md](DEPLOY-PASOS.md) para la guía completa.

## Documentación

- [Backend/README.md](Backend/README.md) — API, endpoints, GraphQL
- [Frontend/README.md](Frontend/README.md) — Componentes, rutas, tecnologías
- [SEGURIDAD.md](SEGURIDAD.md) — Auditoría de seguridad
- [Database/diagrama-clases.md](Database/diagrama-clases.md) — Modelo de datos

---

**Inicio:** marzo 2026 · **Estado:** en desarrollo activo





Objetivo del proyecto
Crear una aplicación donde los usuarios puedan armar su propia lista de convocados para la selección, elegir los titulares por partido y predecir los resultados de los partidos de la fase de grupos. La app debe ser simple, rápida y compartible mediante link.
Funcionalidades principales
1. Selección de convocados (mínimo 23, máximo 26).
2. Estados de jugador: PENDIENTE, NO VA, CONVOCADO.
3. Vista de jugadores con foto, nombre y posición.
4. Posiciones disponibles: ARQ, DEF, MED, DEL.
5. Posibilidad de agregar jugadores propios con foto desde galería.
6. Selección de XI titular por partido.
7. Validaciones:
   - Máximo 11 titulares.
   - Solo 1 arquero titular.
8. Predicción de resultados de cada partido: GANA / EMPATA / PIERDE.
9. Vista global de resultados del grupo.
10. Pantalla de resumen final con lista completa.
11. Compartir lista mediante link.
Reglas del juego
- El usuario debe seleccionar entre 23 y 26 convocados.
- Una vez cerrada la lista, solo se podrán elegir titulares por partido. Podria ser 24 hs antes del encuentro.
- Cada partido permite elegir 11 titulares.
- Debe haber exactamente 1 arquero titular.
- El usuario puede predecir el resultado del partido (G/E/P).
- Las elecciones pueden modificarse hasta la fecha de cierre.
Arquitectura básica de datos
Players
Matches
Roster (estado de convocatoria)
Lineups (XI por partido)
Predictions (resultados G/E/P)
Users
Recomendaciones técnicas
- Base de datos flexible (Firebase, Supabase o PostgreSQL).
- Frontend responsive (React / Next.js / FlutterFlow / Glide).
- Sistema de autenticación simple.
- Almacenamiento de imágenes de jugadores.
- Sistema de links compartibles para viralidad.
- Preparar arquitectura para ranking futuro.
Fases del proyecto (10 etapas)
Fase 1: Definición del producto y reglas del juego.
Fase 2: Diseño UX/UI de todas las pantallas.
Fase 3: Modelado de base de datos.
Fase 4: Construcción del módulo de jugadores.
Fase 5: Construcción del módulo de convocados.
Fase 6: Construcción del módulo de partidos.
Fase 7: Construcción del módulo de XI titular.
Fase 8: Construcción del módulo de predicción de resultados.
Fase 9: Pantalla de resumen y sistema de compartir.
Fase 10: Testing, ajustes y preparación para lanzamiento.