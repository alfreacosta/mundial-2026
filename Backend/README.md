# Mundial 2026 — Backend

API backend en **Java 21 + Spring Boot 3.5** con **GraphQL** y endpoints REST complementarios.

## Tecnologías

- **Java 21** + Spring Boot 3.5
- **Spring GraphQL** — API principal
- **Spring Security** — JWT (HS256) + Google OAuth2
- **PostgreSQL 14+** — Base de datos relacional
- **Hibernate / JPA** — ORM
- **Resend API** — Emails transaccionales (recuperación de contraseña)
- **API-Football v3** — Sincronización de datos reales (jugadores, fixtures, estadísticas)

## Estructura

```
src/main/java/com/mundial2026/
├── config/          ← Seguridad, CORS, GraphQL, JWT
├── controller/      ← Controladores REST complementarios
├── dto/             ← DTOs de request/response
├── entity/          ← Entidades JPA (Usuario, Jugador, Pais, Partido, etc.)
├── repository/      ← Repositorios Spring Data JPA
├── resolver/        ← Resolvers GraphQL (queries + mutations)
└── service/         ← Lógica de negocio
```

## Setup

### Requisitos
- Java 21
- PostgreSQL 14+ corriendo con la base `mundial` creada
- Maven (incluido via `./mvnw`)

### Configuración

```bash
cp src/main/resources/application.properties.example src/main/resources/application.properties
```

Editá `application.properties` con tus credenciales locales (DB password, JWT secret, etc.).

> **IMPORTANTE:** No commitear `application.properties` con credenciales reales. Usá `application.properties.example` como template.

### Ejecutar

```bash
./mvnw spring-boot:run
# → http://localhost:8080
```

### Build

```bash
./mvnw package -DskipTests
java -jar target/mundial-2026-backend-1.0.0.jar
```

## API

### GraphQL

Endpoint principal: `POST /graphql`

Playground interactivo: http://localhost:8080/graphiql

Ejemplo de query:
```graphql
query {
  paises {
    id nombre codigo confederacion
    jugadores { nombre posicion club }
  }
}
```

Ejemplo de mutation (login):
```graphql
mutation {
  login(input: { email: "tu@email.com", password: "..." }) {
    token
    user { internalId userName email nombre apellido }
  }
}
```

### REST (complementarios)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/fixtures` | Fixture completo del torneo |
| GET | `/api/estadios` | Estadios del Mundial |
| GET | `/api/stats/top-scorers` | Goleadores |
| POST | `/api/predicciones` | Guardar predicción de partido |
| GET | `/api/predicciones/mis` | Mis predicciones |
| POST | `/api/grupos` | Crear grupo privado |
| GET | `/api/grupos/mis` | Mis grupos |

### Autenticación

Todas las rutas protegidas requieren header:
```
Authorization: Bearer <jwt_token>
```

## Perfiles de ejecución

- **default** (`application.properties`) — Desarrollo local
- **prod** (`application-prod.properties`) — Producción (variables de entorno)

En producción, las credenciales se inyectan via variables de entorno (`DB_URL`, `DB_PASSWORD`, `JWT_SECRET`, etc.).
