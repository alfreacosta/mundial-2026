---
name: mundial-2026
description: >
  Agente full-stack para el proyecto Fantasy Mundial 2026.
  Usar cuando se trabaja en backend (Spring Boot + PostgreSQL),
  frontend (Angular 17+) o sincronización de datos (API-Football).
  Conoce la arquitectura, convenciones y estado actual del proyecto.
---

Sos el asistente principal del proyecto **Fantasy Mundial 2026**, una app full-stack de simulación y predicciones del Mundial FIFA 2026.

## Stack tecnológico
- **Backend:** Java 17 + Spring Boot 3 + Spring Security + JPA/Hibernate
- **Base de datos:** PostgreSQL (host: localhost, DB: `mundial`, user: `postgres`)
- **Frontend:** Angular 17+ (standalone components, signals), SCSS, `flag-icons`
- **API externa:** API-Football v3 (`https://v3.football.api-sports.io`) — 100 llamadas/día gratis
- **Build:** Maven (backend), `npx ng serve` (frontend)

## Estructura del proyecto
```
Backend/src/main/java/com/fantasy/mundial/
  controller/     — REST controllers
  service/        — lógica de negocio
  model/          — entidades JPA
  repository/     — Spring Data JPA
  dto/            — requests y responses
  config/         — SecurityConfig, CorsConfig

Frontend/src/app/
  core/
    models/       — interfaces TypeScript
    services/     — servicios Angular HTTP
    guards/       — auth guards
    interceptors/ — JWT interceptor
  features/       — componentes por feature (auth, selecciones, grupos, etc.)
  shared/         — componentes reutilizables
Database/         — migraciones y seeds SQL
```

## Convenciones obligatorias
- **PKs:** siempre `internalId` (nunca `id`)
- **FKs master-detail:** siempre `masterId`
- **Fechas:** `transDate` (creación), `endDate` (cierre/deadline)
- **Métodos booleanos:** prefijo `es...()` (esEditable, esTitular)
- **Banderas:** campo `codigo` (ej: "BRA") con librería `flag-icons` — NO guardar banderas en BD
- **Imágenes jugadores/equipos:** URLs de `https://media.api-sports.io/football/...` (sin quota)
- **Seguridad:** todos los endpoints autenticados excepto `/api/selecciones/**`, `/api/sync/**`, auth endpoints

## Estado actual del proyecto (al 28/03/2026)
### ✅ Implementado
- Auth (JWT login/registro)
- Entidades base: Pais, Confederacion, Jugador, Club, Partido, Fase, Estadio
- Feature Selecciones: SeleccionController, SeleccionService, ApiFootballExtendedService, SyncService
- Feature Grupos (backend completo): Grupo, GrupoRow, EquipoFavorito + repos + DTOs + GrupoService + GrupoController
- Frontend Grupos: `grupo.service.ts` + `grupo.models.ts`

### ❌ Pendiente inmediato
1. **Sync de datos:** re-sincronizar PAR (api_team_id=2380), SEN y TUN (IDs incorrectos)
2. **Frontend Grupos - Fase 8:** `mis-grupos` + `crear-grupo` components
3. **Frontend Grupos - Fase 9:** `detalle-grupo` + `unirse-grupo` components
4. **Frontend Grupos - Fase 10:** `buscar-usuarios` + `perfil-publico` components

## Comandos frecuentes
```bash
# Iniciar backend
cd Backend && mvn spring-boot:run -q

# Iniciar frontend
cd Frontend && npx ng serve --host 0.0.0.0

# Conectar a BD
psql -h localhost -U postgres -d mundial

# Sync de un equipo
curl -X POST http://localhost:8080/api/sync/team/PAR

# Buscar equipo en API-Football (para encontrar IDs correctos)
curl -s "https://v3.football.api-sports.io/teams?search=senegal" \
  -H "x-apisports-key: TU_API_KEY" | jq '.response[] | select(.team.national==true)'
```

## API-Football — Gestión de quota
- **Límite:** 100 llamadas/día (reset medianoche UTC)
- **IDs ya verificados:** BEL,FRA,CRO,BRA,URU,ESP,ENG,SUI,MEX,KOR,AUS,DEN,IRN,SAU,POL,GER,ARG,POR (IDs 1-27)
- **URLs de imágenes:** GRATIS, no consumen quota
- **Rate limit:** 10 req/min → 7s de delay entre llamadas de sync

## Reglas de negocio clave
- `UNIQUE (usuarioId, paisId)` en Convocatoria
- `UNIQUE (usuarioId)` en PrediccionTorneo
- `UNIQUE (usuarioId, partidoId)` en Prediccion
- EquipoFavorito: `CHECK (orden BETWEEN 1 AND 5)`, máximo 5 por usuario
- GrupoRow: `paisCampeonId` y `goleadorId` son NOT NULL (se eligen al unirse)
- JWT: 1 hora (desarrollo), 24 horas (producción)

## Primeras preguntas al retomar trabajo
Siempre leer `/memories/repo/selecciones-feature.md` para el estado de la sincronización de datos.
Revisar `PLAN-GRUPOS-FEATURE.md` para ver las fases del frontend pendientes.
