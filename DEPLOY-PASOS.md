# Guía de Deploy — Mundial 2026

> Estado actual: código en GitHub en `github.com/alfreacosta/mundial-2026`, rama `main`.

---

## Escala objetivo

- **5.000 usuarios activos** en Paraguay como lanzamiento
- **Potencial explosivo** en Argentina, Brasil y México (decenas de miles)
- Temporada activa: **junio-julio 2026** (Mundial FIFA)

Esto **no es un proyecto de facultad**. Necesita infraestructura de producción real.

---

## PASO 1 — GitHub ✅ (ya hecho)

Código ya subido en https://github.com/alfreacosta/mundial-2026

---

## PASO 2 — Elegir la infraestructura correcta

### ❌ Por qué el plan GRATIS de Render NO sirve para este proyecto

- El servidor **duerme cada 15 minutos** sin visitas
- El "despertar" tarda **30-60 segundos** — con 5000 usuarios eso es inaceptable
- La base de datos gratuita **expira a los 90 días** y se borra toda la data
- RAM limitada a 512MB — Spring Boot bajo carga puede crashear

---

### ✅ Stack recomendado para producción (~$20/mes)

| Componente | Servicio | Precio | Por qué |
|------------|----------|--------|---------|
| **Frontend** | Vercel | Gratis | Maneja millones de requests, CDN global, Angular perfecto |
| **Backend** | Railway | ~$5-15/mes | Sin sleep, auto-escala, muy fácil, Java 21 soportado |
| **Base de datos** | Railway PostgreSQL | incluido | Mismo servidor, latencia casi cero, backups automáticos |
| **Imágenes/CDN** | Cloudflare | Gratis | Protección DDoS si el proyecto explota, caché global |

**Total estimado: $10-20/mes** — menos que una Netflix para un proyecto que puede generar usuarios reales.

---

### 💸 ¿Cuánto vamos a pagar en Railway? Números reales

Railway cobra **por uso real** de recursos (RAM + CPU), no por usuarios. El **plan Hobby** cuesta $5/mes fijo e incluye $5 de crédito de uso. Si usás más, pagás la diferencia.

#### Estimación según escala:

| Escenario | Usuarios activos a la vez | Costo estimado |
|-----------|--------------------------|----------------|
| Pruebas / arranque | 1-50 | **$5/mes** (el mínimo del plan) |
| Lanzamiento Paraguay | 100-300 simultáneos | **$8-15/mes** |
| Pico durante un partido | 500-1000 simultáneos | **$15-25/mes** |
| Explota en Argentina/Brasil | 3000-5000 simultáneos | **$40-80/mes** |

> La clave: **no van a estar los 5000 usuarios online al mismo tiempo**. En promedio, de 5000 registrados, quizás 200-400 están activos en simultáneo. Los picos grandes pasan solo durante partidos.

#### ⚠️ La protección más importante: el Spending Limit

Railway tiene una opción en el Dashboard para poner un **límite máximo de gasto mensual**. Si se supera ese límite, el servicio se pausa en lugar de seguir cobrando.

**Configurar apenas entres:**
- Railway Dashboard → **Account Settings** → **Spending Limit**
- Poner `$25` al principio — alcanza para el lanzamiento y nunca te sorprende

Si el proyecto explota y necesitás subir el límite, lo subís cuando ya tengas ingresos.

---

### Alternativa si Railway da problemas o querés precio fijo sin sorpresas

| Componente | Servicio | Precio |
|------------|----------|--------|
| Backend | Render **Starter** (pago) | $7/mes fijo (sin sleep, nunca cobra más aunque explote) |
| Base de datos | Supabase | Gratis hasta 500MB / $25 mes después |

> Render Starter tiene **precio fijo** — si llegan 100.000 usuarios a la vez, simplemente se pone lento en vez de cobrar más. Para este proyecto que aún no genera ingresos, puede ser más tranquilo.

---

### ¿Por qué Railway sobre Render para este caso?

1. **No duerme nunca** — ni en el plan más barato
2. **Spending Limit** — configurás un tope máximo y nunca te sorprende la factura
3. **Deploy igual de fácil** — conectás GitHub y se redeploya con cada `git push`
4. **PostgreSQL incluida** — mismo dashboard, no hay que configurar conexiones entre servicios
5. **Métricas en tiempo real** — ves cuántos requests tenés, RAM, CPU en vivo

---

## PASO 3 — Deploy del Backend en Railway

**URL:** https://railway.app

1. Crear cuenta con GitHub (login directo)
2. Click en **New Project** → **Deploy from GitHub repo**
3. Seleccionar `alfreacosta/mundial-2026`
4. Railway detecta que es Java/Maven automáticamente
5. Configurar el **Root Directory** del servicio: `Backend`
6. Agregar las variables de entorno (click en el servicio → **Variables**):

| Variable | Valor |
|----------|-------|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `DB_URL` | *(Railway te lo da automático si agregas PostgreSQL)* |
| `DB_USERNAME` | *(automático)* |
| `DB_PASSWORD` | *(automático)* |
| `JWT_SECRET` | Un string largo y random (ej: generalo en https://generate-secret.vercel.app/64) |
| `FRONTEND_URL` | La URL de Vercel (se completa en el Paso 5) |
| `GOOGLE_CLIENT_ID` | Tu Google Client ID |
| `API_FOOTBALL_KEY` | *(tu API key de api-football.com)* |

7. Agregar la base de datos: en tu proyecto Railway → **New** → **Database** → **PostgreSQL**
8. Railway vincula las variables `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` automáticamente
9. **Copiar la URL pública del backend** (Railway → tu servicio → Settings → Networking → Public Domain)

---

## PASO 4 — Cargar la base de datos

La PostgreSQL de Railway viene vacía. Ejecutar los scripts en orden:

```bash
# Railway te da el connection string en: tu DB → Connect → External connection string
# Tiene este formato: postgresql://usuario:password@host:puerto/railway

psql <CONNECTION_STRING> -f Database/schema.sql
psql <CONNECTION_STRING> -f Database/seed.sql
psql <CONNECTION_STRING> -f Database/seed_grupos.sql
psql <CONNECTION_STRING> -f Database/seed_partidos.sql
psql <CONNECTION_STRING> -f Database/migration_estadios.sql
psql <CONNECTION_STRING> -f Database/migration_grupos.sql
```

---

## PASO 5 — Actualizar la URL del backend en el Frontend

Con la URL pública que te dio Railway, editar:

**Archivo:** `Frontend/src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://TU-SERVICIO.up.railway.app/api',       // URL de Railway
  graphqlUrl: 'https://TU-SERVICIO.up.railway.app/graphql',
  appName: 'MUNDIAL 2026',
  version: '1.0.0',
  googleClientId: 'TU_GOOGLE_CLIENT_ID_REAL'
};
```

Luego subir el cambio:

```bash
git add Frontend/src/environments/environment.prod.ts
git commit -m "config: URL de backend en Railway para produccion"
git push
```

---

## PASO 6 — Deploy del Frontend en Vercel

**URL:** https://vercel.com

1. Crear cuenta con GitHub
2. **Add New Project** → importar `alfreacosta/mundial-2026`
3. Configurar:

| Campo | Valor |
|-------|-------|
| **Root Directory** | `Frontend` |
| **Framework Preset** | Angular |
| **Build Command** | `ng build --configuration production` |
| **Output Directory** | `dist/mundial-2026/browser` |

4. Click en **Deploy**
5. Vercel te da una URL como `https://mundial-2026.vercel.app`
6. Volver a Railway → tu backend → Variables → actualizar `FRONTEND_URL` con esa URL

---

## PASO 7 (Opcional pero recomendado) — Cloudflare

Si el proyecto explota en Argentina o Brasil, Cloudflare protege el backend de picos de tráfico y ataques.

**URL:** https://cloudflare.com — plan Gratis alcanza

1. Crear cuenta
2. Agregar tu dominio de GoDaddy
3. Cloudflare te da nuevos DNS servers — los cambiás en GoDaddy
4. De ahí en más, todo el tráfico pasa por Cloudflare antes de llegar a Railway/Vercel

---

## PASO 8 (Opcional) — Dominio con GoDaddy

Una vez que todo funciona con las URLs de Railway/Vercel:

### Para el Frontend (Vercel):
1. Vercel → tu proyecto → **Settings** → **Domains** → escribir tu dominio
2. Vercel te da un `CNAME` → lo cargás en GoDaddy → DNS → Agregar registro

### Para el Backend (Railway):
1. Railway → tu servicio → **Settings** → **Custom Domain**
2. Agregar `api.mundial2026.com` (o como tengas el dominio)
3. Railway te da un `CNAME` → lo cargás en GoDaddy

---

## Resumen de costos

| Etapa | Costo mensual | Capacidad |
|-------|--------------|-----------|
| Lanzamiento Paraguay | ~$10-15/mes | Hasta ~10.000 usuarios |
| Si explota en Argentina/Brasil | ~$30-50/mes | Escalamos Railway con un clic |
| Gratis siempre | $0 | Vercel (frontend) + Cloudflare (CDN) |

---

## Flujo de trabajo una vez deployado

```bash
# Cualquier cambio que hagas:
git add .
git commit -m "descripcion del cambio"
git push
# → Vercel redeploya el frontend en ~2 minutos
# → Railway redeploya el backend en ~3-5 minutos
# → Los usuarios no notan nada (zero downtime)
```
