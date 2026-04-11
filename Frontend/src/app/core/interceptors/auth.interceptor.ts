import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Header custom: si una request lo incluye, el interceptor NO
 * cierra sesión ni redirige ante un 401. El componente se encarga
 * de manejar el error con su propio catchError.
 */
export const SKIP_AUTH_REDIRECT = 'X-Skip-Auth-Redirect';

/** Flag para evitar cascada de logouts concurrentes. */
let handling401 = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();

  const publicEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/google',
    '/api/auth/health',
    '/api/auth/generate-hash'
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));

  // Detectar si la request pide que NO se haga redirect en 401
  const skipRedirect = req.headers.has(SKIP_AUTH_REDIRECT);

  // Clonar request: agregar token + quitar header custom (no enviarlo al backend)
  let authReq: HttpRequest<unknown> = req;
  if (skipRedirect) {
    authReq = authReq.clone({ headers: authReq.headers.delete(SKIP_AUTH_REDIRECT) });
  }
  if (token && !isPublicEndpoint) {
    authReq = authReq.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(authReq).pipe(
    catchError((error) => {
      // Redirigir al login solo si:
      // 1. Es un 401 real (no endpoint público)
      // 2. Enviamos un token (si no había, el 401 es esperado)
      // 3. La request NO pidió skip (el componente la maneja)
      // 4. No estamos ya procesando un 401 concurrente
      if (error.status === 401 && !isPublicEndpoint && token && !skipRedirect && !handling401) {
        handling401 = true;
        console.warn(`⚠️ 401 en ${req.url} — cerrando sesión`);
        authService.logoutSilent();
        router.navigate(['/register']);
        setTimeout(() => (handling401 = false), 2000);
      }

      return throwError(() => error);
    })
  );
};
