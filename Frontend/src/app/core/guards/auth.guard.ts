import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard que protege rutas requiriendo autenticación
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // No autenticado, redirigir al login
  router.navigate(['/register'], { queryParams: { returnUrl: state.url } });
  return false;
};

/**
 * LoginGuard - Evita que usuarios logueados vean el login
 * Si el usuario YA está logueado → redirige a dashboard
 */
export const loginGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  // Ya está autenticado, redirigir a dashboard
  router.navigate(['/dashboard']);
  return false;
};

/**
 * Guard que verifica si el usuario está autenticado (admin futuro)
 */
export const adminGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // No autenticado, redirigir al login
  router.navigate(['/']);
  return false;
};
