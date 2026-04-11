import { Injectable, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

/**
 * Servicio de detección de inactividad del usuario.
 * 
 * Cierra la sesión automáticamente después de 10 minutos sin actividad.
 * Muestra advertencia 30 segundos antes de cerrar.
 * 
 * Eventos que resetean el timer:
 * - Click/tap en cualquier parte
 * - Movimiento del mouse
 * - Presionar teclas
 * - Scroll de página
 * - Focus/input en formularios
 */
@Injectable({ providedIn: 'root' })
export class IdleTimeoutService implements OnDestroy {
  
  // ────────────────────────────────────────────────────────────
  // Configuración
  // ────────────────────────────────────────────────────────────
  
  /** Tiempo total de inactividad antes de logout (10 minutos) */
  private readonly IDLE_TIMEOUT = 10 * 60 * 1000;
  
  /** Tiempo antes de mostrar advertencia (30 segundos antes) */
  private readonly WARNING_TIME = 30 * 1000;
  
  /** Eventos del DOM que resetean el timer */
  private readonly ACTIVITY_EVENTS = [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click',
    'focus',      // Cuando hace focus en un input
    'input',      // Cuando escribe en un input
    'change'      // Cuando cambia un select/checkbox
  ];

  // ────────────────────────────────────────────────────────────
  // Estado interno
  // ────────────────────────────────────────────────────────────
  
  private idleTimer?: number;
  private warningTimer?: number;
  private isActive = false;
  private boundResetTimer: () => void;

  // ────────────────────────────────────────────────────────────
  // Constructor
  // ────────────────────────────────────────────────────────────
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Bind del método para mantener contexto
    this.boundResetTimer = this.resetIdleTimer.bind(this);
    
    // Auto-inicializar cuando el usuario hace login
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        // Usuario logueado → iniciar detección
        this.start();
      } else {
        // Usuario deslogueado → detener detección
        this.stop();
      }
    });
  }

  // ────────────────────────────────────────────────────────────
  // Métodos públicos
  // ────────────────────────────────────────────────────────────
  
  /**
   * Inicia la detección de inactividad.
   * Solo debe llamarse si el usuario está autenticado.
   */
  start(): void {
    if (this.isActive) {
      console.warn('[IdleTimeout] Ya está activo, ignorando start()');
      return;10
    }

    console.log('[IdleTimeout] ✅ Iniciando detección de inactividad (10 min)');
    this.isActive = true;
    this.setupListeners();
    this.resetIdleTimer();
  }

  /**
   * Detiene la detección de inactividad.
   * Se llama al hacer logout o al destruir el servicio.
   */
  stop(): void {
    if (!this.isActive) return;

    console.log('[IdleTimeout] ⏹️ Deteniendo detección de inactividad');
    this.isActive = false;
    this.clearTimers();
    this.removeListeners();
  }

  /**
   * Verifica si la detección está activa.
   */
  isRunning(): boolean {
    return this.isActive;
  }

  // ────────────────────────────────────────────────────────────
  // Métodos privados - Gestión de listeners
  // ────────────────────────────────────────────────────────────
  
  private setupListeners(): void {
    this.ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, this.boundResetTimer, true);
    });
  }

  private removeListeners(): void {
    this.ACTIVITY_EVENTS.forEach(event => {
      window.removeEventListener(event, this.boundResetTimer, true);
    });
  }

  // ────────────────────────────────────────────────────────────
  // Métodos privados - Gestión de timers
  // ────────────────────────────────────────────────────────────
  
  /**
   * Resetea los timers de inactividad.
   * Se llama cada vez que hay actividad del usuario.
   */
  private resetIdleTimer(): void {
    if (!this.isActive) return;

    this.clearTimers();

    // Timer de advertencia (9.5 minutos de inactividad)
    this.warningTimer = window.setTimeout(() => {
      this.showWarning();
    }, this.IDLE_TIMEOUT - this.WARNING_TIME);

    // Timer de logout (10 minutos de inactividad)
    this.idleTimer = window.setTimeout(() => {
      this.handleIdleTimeout();
    }, this.IDLE_TIMEOUT);
  }

  /**
   * Limpia todos los timers activos.
   */
  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = undefined;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Métodos privados - Acciones
  // ────────────────────────────────────────────────────────────
  
  /**
   * Muestra advertencia de inactividad (30s antes de logout).
   */
  private showWarning(): void {
    console.warn(
      '⚠️ [IdleTimeout] Tu sesión expirará en 30 segundos por inactividad. ' +
      'Mueve el mouse o presiona una tecla para continuar.'
    );
    
    // TODO: Aquí se puede mostrar un modal/toast de advertencia
    // Ejemplo: this.toastService.warning('Sesión por expirar', 'Actividad requerida');
  }

  /**
   * Maneja el timeout de inactividad (cierre de sesión).
   */
  private handleIdleTimeout(): void {
    console.warn('🔒 [IdleTimeout] Sesión cerrada por inactividad (10 minutos sin actividad)');
    
    this.stop();
    this.authService.logout();
    
    // Redirigir con mensaje de inactividad
    this.router.navigate(['/'], { 
      queryParams: { 
        reason: 'timeout',
        message: 'Tu sesión expiró por inactividad'
      }
    });
  }

  // ────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────
  
  ngOnDestroy(): void {
    this.stop();
  }
}
