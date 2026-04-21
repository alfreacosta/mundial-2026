import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { IdleTimeoutService } from './core/services/idle-timeout.service';

// Registrar locale español para DatePipe y otros pipes
registerLocaleData(localeEs, 'es');

/**
 * Inicializa el servicio de detección de inactividad.
 * El servicio se auto-suscribe a cambios de autenticación y gestiona
 * el timeout automáticamente.
 */
function initializeIdleTimeout(idleService: IdleTimeoutService) {
  return () => {
    // Solo instanciar el servicio, se auto-configura
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    { provide: LOCALE_ID, useValue: 'es' },
    
    // ────────────────────────────────────────────────────────────
    // Inicialización del servicio de timeout de inactividad
    // ────────────────────────────────────────────────────────────
    {
      provide: APP_INITIALIZER,
      useFactory: initializeIdleTimeout,
      deps: [IdleTimeoutService],
      multi: true
    }
    /* GraphQL deshabilitado - usar REST
    ,provideApollo(() => {
      const httpClient = inject(HttpClient);
      const httpLink = new HttpLink(httpClient);
      const router = inject(Router);
      
      // Link de autenticación para Apollo
      const auth = setContext(() => {
        const token = localStorage.getItem('token');  // ✅ Corregido: usar 'token' (clave limpia)
        if (token) {
          return {
            headers: {
              Authorization: `Bearer ${token}`
            }
          };
        }
        return {};
      });

      // Error handler para cerrar sesión automáticamente
      const errorLink = onError(({ graphQLErrors, networkError }) => {
        if (graphQLErrors) {
          for (const err of graphQLErrors) {
            console.error('[GraphQL Error]:', err.message, 'Code:', err.extensions?.['code']);
            
            // Si el error es de autenticación, cerrar sesión
            if (err.extensions?.['code'] === 'UNAUTHENTICATED' || 
                err.message.includes('Token inválido') ||
                err.message.includes('No autenticado')) {
              console.warn('[Apollo] Sesión expirada. Cerrando sesión automáticamente...');
              localStorage.removeItem('usuario');
              localStorage.removeItem('token');
              localStorage.removeItem('empresa');
              router.navigate(['/login']);
              alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
            }
          }
        }
        
        if (networkError) {
          console.error('[Network Error]:', networkError);
        }
      });

      // Crear el link HTTP
      const http = httpLink.create({
        uri: environment.graphqlUrl
      });

      return {
        link: ApolloLink.from([errorLink, auth, http]),
        cache: new InMemoryCache(),
        defaultOptions: {
          watchQuery: {
            fetchPolicy: 'network-only',
            errorPolicy: 'all'
          },
          query: {
            fetchPolicy: 'network-only',
            errorPolicy: 'all'
          },
          mutate: {
            errorPolicy: 'all'
          }
        }
      };
    })
    */
  ]
};
