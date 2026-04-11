import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { AuthResponse, LoginRequest, RegisterRequest, Usuario } from '../models/auth.models';
import { environment } from '../../../environments/environment';

const TOKEN_KEY   = 'mundial_token';
const USER_KEY    = 'mundial_user';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly base = `${environment.apiUrl}/auth`;

  private userSubject  = new BehaviorSubject<Usuario | null>(this.loadUser());
  private tokenSubject = new BehaviorSubject<string | null>(this.loadToken());

  /** Observable del usuario actual */
  currentUser$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.checkTokenExpiration();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkTokenExpiration();
      }
    });
  }

  // ----------------------------------------------------------------
  // Login
  // ----------------------------------------------------------------
  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/login`, req).pipe(
      tap(res => this.saveSession(res))
    );
  }

  // ----------------------------------------------------------------
  // Registro
  // ----------------------------------------------------------------
  register(req: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, req).pipe(
      tap(res => this.saveSession(res))
    );
  }

  // ----------------------------------------------------------------
  // Google Sign-In
  // ----------------------------------------------------------------
  loginWithGoogle(credential: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/google`, { credential }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  // ----------------------------------------------------------------
  // Logout
  // ----------------------------------------------------------------
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSubject.next(null);
    this.tokenSubject.next(null);
    this.router.navigate(['/']);
  }

  // ----------------------------------------------------------------
  // Forgot / Reset Password
  // ----------------------------------------------------------------
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/reset-password`, { token, newPassword });
  }

  /**
   * Limpia el estado de sesión sin disparar navegación inmediata.
   * Usar cuando se detecta 401 en una petición HTTP: el authGuard
   * redirigirá al usuario en la próxima navegación que intente.
   */
  logoutSilent(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSubject.next(null);
    this.tokenSubject.next(null);
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  getToken(): string | null {
    return this.tokenSubject.value;
  }

  isAuthenticated(): boolean {
    if (!this.tokenSubject.value) return false;
    if (this.isTokenExpired(this.tokenSubject.value)) {
      this.logout();
      return false;
    }
    return true;
  }

  getCurrentUser(): Usuario | null {
    return this.userSubject.value;
  }

  // ----------------------------------------------------------------
  // Profile
  // ----------------------------------------------------------------
  updateProfile(data: { nombre?: string; apellido?: string; telefono?: string; urlAvatar?: string }): Observable<AuthResponse> {
    return this.http.put<AuthResponse>(`${this.base}/profile`, data).pipe(
      tap(res => this.saveSession(res))
    );
  }

  changePassword(data: { currentPassword: string; newPassword: string }): Observable<any> {
    return this.http.put(`${this.base}/password`, data);
  }

  // ----------------------------------------------------------------
  // Persistencia en localStorage
  // ----------------------------------------------------------------
  private saveSession(res: AuthResponse): void {
    const usuario: Usuario = {
      userId:    res.userId,
      user:      res.user,
      email:     res.email,
      nombre:    res.nombre,
      apellido:  res.apellido,
      telefono:  res.telefono,
      urlAvatar: res.urlAvatar,
      puntaje:   res.puntaje
    };
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    this.tokenSubject.next(res.token);
    this.userSubject.next(usuario);
  }

  private loadToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private loadUser(): Usuario | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  /** Decodifica el payload del JWT y verifica si expiró */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  /** Si el token expiró, limpia la sesión */
  private checkTokenExpiration(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && this.isTokenExpired(token)) {
      this.logout();
    }
  }
}
