#!/bin/bash

PROJECT_DIR="/home/administrador/Escritorio/Facultad-2026/Proyecto Futbol"
LOG_DIR="$PROJECT_DIR/Log"
BACKEND_DIR="$PROJECT_DIR/Backend"
FRONTEND_DIR="$PROJECT_DIR/Frontend"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== MUNDIAL 2026 - Restart Script ===${NC}"
echo ""

# Crear carpeta de logs si no existe
mkdir -p "$LOG_DIR"

# Función para matar procesos
kill_processes() {
    echo -e "${YELLOW}Cerrando procesos existentes...${NC}"
    
    # Liberar puerto 4200 forzadamente
    lsof -ti:4200 | xargs -r kill -9 2>/dev/null && echo -e "${GREEN}✓ Puerto 4200 liberado${NC}" || true
    
    # Matar procesos de Angular con -9
    pkill -9 -f "ng serve" && echo -e "${GREEN}✓ Angular cerrado${NC}" || echo -e "${RED}✗ No había Angular corriendo${NC}"
    pkill -9 -f "node.*angular" 2>/dev/null || true
    
    # Liberar puerto 8080
    lsof -ti:8080 | xargs -r kill -9 2>/dev/null && echo -e "${GREEN}✓ Puerto 8080 liberado${NC}" || true
    
    # Matar procesos de Spring Boot con -9
    pkill -9 -f "spring-boot:run" && echo -e "${GREEN}✓ Spring Boot cerrado${NC}" || echo -e "${RED}✗ No había Spring Boot corriendo${NC}"
    pkill -9 -f "FantasyMundialApplication" 2>/dev/null || true
    
    # Esperar a que los procesos terminen
    sleep 3
    echo ""
}

# Función para iniciar backend
start_backend() {
    echo -e "${YELLOW}Iniciando Backend (Spring Boot)...${NC}"
    cd "$BACKEND_DIR"
    
    # Limpiar logs anteriores (opcional, comentar si quieres mantener histórico)
    > "$LOG_DIR/backend.log"
    
    # Iniciar Spring Boot en background con logs
    nohup mvn spring-boot:run >> "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    
    echo -e "${GREEN}✓ Backend iniciado (PID: $BACKEND_PID)${NC}"
    echo -e "  Log: $LOG_DIR/backend.log"
    echo ""
    
    # Esperar a que Spring Boot esté listo (máximo 30 segundos)
    echo -e "${YELLOW}Esperando a que Backend esté listo...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:8080/api/auth/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend respondiendo en http://localhost:8080${NC}"
            echo ""
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e "${RED}✗ Backend no respondió en 30 segundos. Revisa el log.${NC}"
    echo ""
}

# Función para iniciar frontend
start_frontend() {
    echo -e "${YELLOW}Iniciando Frontend (Angular)...${NC}"
    cd "$FRONTEND_DIR"
    
    # Limpiar logs anteriores (opcional)
    > "$LOG_DIR/frontend.log"
    
    # Iniciar Angular en background con logs (aceptando conexiones de red)
    nohup npm start -- --host 0.0.0.0 >> "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    
    echo -e "${GREEN}✓ Frontend iniciado (PID: $FRONTEND_PID)${NC}"
    echo -e "  Log: $LOG_DIR/frontend.log"
    echo ""
    
    # Esperar a que Angular compile (máximo 45 segundos)
    echo -e "${YELLOW}Esperando a que Angular compile...${NC}"
    for i in {1..45}; do
        if curl -s http://localhost:4200 > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Frontend disponible en http://localhost:4200${NC}"
            echo ""
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e "${RED}✗ Frontend no respondió en 45 segundos. Revisa el log.${NC}"
    echo ""
}

# Mostrar estado de procesos
show_status() {
    echo -e "${YELLOW}=== Estado de Procesos ===${NC}"
    echo ""
    
    if pgrep -f "spring-boot:run" > /dev/null; then
        BACKEND_PID=$(pgrep -f "FantasyMundialApplication" | head -1)
        echo -e "${GREEN}✓ Backend corriendo (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}✗ Backend no está corriendo${NC}"
    fi
    
    if pgrep -f "ng serve" > /dev/null; then
        FRONTEND_PID=$(pgrep -f "ng serve" | head -1)
        echo -e "${GREEN}✓ Frontend corriendo (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${RED}✗ Frontend no está corriendo${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}=== URLs ===${NC}"
    echo "Backend:  http://localhost:8080"
    echo "Frontend: http://localhost:4200"
    echo ""
    echo -e "${YELLOW}=== Acceso desde red local (celular) ===${NC}"
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    echo "Frontend: http://$LOCAL_IP:4200"
    echo "Backend:  http://$LOCAL_IP:8080"
    echo ""
    echo -e "${YELLOW}=== Logs en tiempo real ===${NC}"
    echo "Backend:  tail -f $LOG_DIR/backend.log"
    echo "Frontend: tail -f $LOG_DIR/frontend.log"
    echo ""
}

# Ejecución principal
kill_processes
start_backend
start_frontend
show_status

echo -e "${GREEN}=== Listo! ===${NC}"
echo -e "Usa ${YELLOW}Ctrl+C${NC} para salir (los procesos seguirán corriendo)"
echo ""
