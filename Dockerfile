# ── Etapa 1: Compilar con JDK 21 + Maven ──────────────────
FROM maven:3.9-eclipse-temurin-25 AS build

WORKDIR /app

# Copiar solo el pom.xml primero (cachea las dependencias si no cambian)
COPY Backend/pom.xml Backend/pom.xml
COPY Backend/.mvn Backend/.mvn
COPY Backend/mvnw Backend/mvnw
RUN chmod +x Backend/mvnw

# Descargar dependencias (se cachea si pom.xml no cambia)
RUN cd Backend && ./mvnw dependency:go-offline -q

# Copiar el código fuente y compilar
COPY Backend/src Backend/src
RUN cd Backend && ./mvnw clean package -DskipTests -Pprod

# ── Etapa 2: Imagen final liviana solo con JRE ─────────────
FROM eclipse-temurin:25-jre-alpine

WORKDIR /app

COPY --from=build /app/Backend/target/*.jar app.jar

EXPOSE 8080

CMD ["java", "-Xmx400m", "-Xms128m", "-jar", "app.jar", "--spring.profiles.active=prod"]
