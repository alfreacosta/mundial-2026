# Mundial 2026 — Frontend

**Proyecto Final — Universidad Católica Nuestra Señora de la Asunción**  
**Facultad de Ciencias y Tecnología**  
**Año:** 2026

---

## ¿Qué es esto?

Frontend de **Mundial 2026**, una aplicación de predicciones de fútbol para el Mundial 2026. Los usuarios se registran, arman su convocatoria de jugadores, compiten en ligas con otros usuarios y siguen las estadísticas del torneo en tiempo real.

Inspirado en Fantasy Premier League, adaptado al Mundial de la FIFA.
---

## Tecnologías

| Tecnología | Versión | Para qué |
|---|---|---|
| **Angular** | 20 | Framework principal (standalone components) |
| **TypeScript** | 5.9 | Tipado estático |
| **Angular Material** | 20 | Componentes UI (inputs, iconos, spinners) |
| **Apollo Angular** | 11 | Cliente GraphQL |
| **Three.js** | 0.181 | Fondo animado con partículas en el login |
| **Font Awesome** | 7 | Iconos de redes sociales |
| **Bootstrap** | 5.3 | Utilidades CSS complementarias |
| **jsPDF** | 3 | Exportar convocatorias a PDF |
| **SCSS** | — | Estilos (CSS con variables y nesting) |

---

## Estructura del Proyecto

```
src/app/
├── core/
│   ├── guards/           # authGuard (rutas protegidas), loginGuard (evita doble login)
│   ├── interceptors/     # HTTP interceptors (auth token, errores)
│   ├── models/           # Interfaces TypeScript
│   └── services/         # Servicios globales (auth, etc.)
│
├── features/
│   ├── auth/             # Registro + Login (una sola página con pestañas)
│   ├── dashboard/        # Panel principal con cards de acceso rápido
│   ├── my-team/          # Mi equipo – gestión del equipo propio
│   ├── players/          # Catálogo de jugadores del Mundial
│   ├── countries/        # Selecciones participantes
│   ├── convocados/       # Convocados por país (/convocados/:paisId)
│   ├── fixtures/         # Fixture del torneo
│   ├── stats/            # Estadísticas del torneo y del equipo
│   ├── groups/           # Tabla de grupos del Mundial
│   ├── leagues/          # Ligas privadas entre usuarios
│   ├── transfers/        # Mercado de transferencias
│   ├── beneficios/       # Página pública de beneficios
│   └── privacy/          # Política de privacidad
│
└── shared/
    └── components/       # Navbar, Footer y componentes reutilizables
```

---

## Rutas

| Ruta | Acceso | Componente |
|---|---|---|
| `/` | Público | Redirige a `/register` |
| `/register` | Público | Registro e inicio de sesión (pestañas) |
| `/login` | Público | Redirige a `/register` |
| `/beneficios` | Público | Información de beneficios |
| `/privacidad` | Público | Política de privacidad |
| `/dashboard` | Autenticado | Panel principal |
| `/my-team` | Autenticado | Mi equipo |
| `/players` | Autenticado | Catálogo de jugadores |
| `/countries` | Autenticado | Selecciones |
| `/convocados/:paisId` | Autenticado | Convocados de un país |
| `/fixtures` | Autenticado | Fixture |
| `/stats` | Autenticado | Estadísticas |
| `/groups` | Autenticado | Grupos del Mundial |
| `/leagues` | Autenticado | Ligas |
| `/transfers` | Autenticado | Transferencias |

---

## Cómo Levantar el Proyecto

### Requisitos

- **Node.js** 20 o superior
- **npm** (incluido con Node.js)
- **Backend corriendo** en `http://localhost:8080` (Spring Boot + PostgreSQL)

### Instalación

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm start
# → http://localhost:4200
```

### Build

```bash
# Development
npx ng build --configuration development

# Production
npm run build
```

Los archivos compilados quedan en `dist/mundial-2026/`.

### Script de reinicio rápido

En la raíz del proyecto hay un `restart.sh` que levanta backend + frontend juntos.

```bash
cd ..
./restart.sh
```

---

## Variables de Entorno

`src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: '/api',
  graphqlUrl: '/graphql',
  appName: 'MUNDIAL 2026',
  version: '1.0.0'
};
```

Las URLs usan proxy (`proxy.conf.json`) que redirige al backend en `localhost:8080`.

---

## Conexión con el Backend

El backend expone una API **GraphQL** en `/graphql`. Las queries y mutations están definidas en:

```
Backend/src/main/resources/graphql/schema.graphqls
```

Ejemplo de mutation de login:
```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
    user {
      internalId
      userName
      email
      nombre
      apellido
    }
  }
}
```

---

## Diseño

- **Paleta principal:** rojo FIFA `#c1272d`, azul marino `#1e3a8a`
- **Fondo login:** canvas Three.js con partículas animadas
- **Responsive:** funciona en móvil y desktop
- **Tema oscuro** en formularios y paneles internos
- **Redes sociales FIFA:** Twitter/X, Facebook, Instagram, YouTube, Spotify (links reales)

---

## Base de Datos

El backend usa **PostgreSQL** con la base de datos `mundial`. Las tablas principales:

- `usuario` — Usuarios registrados
- `pais` — Selecciones del Mundial 2026 (48 equipos)
- `jugador` — Jugadores convocados por país
- `liga` — Ligas de competencia entre usuarios
- `fixture` — Partidos del torneo

---

## Notas de Desarrollo

- Componentes **standalone** (sin NgModules)
- Control de sesión con `localStorage`
- Guards: `authGuard` bloquea rutas privadas, `loginGuard` redirige al dashboard si ya estás logueado
- Exportación de convocatoria a **PDF** con jsPDF
- Deploy en **Vercel** con auto-deploy desde `main`


