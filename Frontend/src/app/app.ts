import { Component, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AuthService } from './core/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('MUNDIAL 2026');
  
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private authSubscription?: Subscription;

  get showShell(): boolean {
    return this.router.url !== '/register' && !this.router.url.startsWith('/register?');
  }

  ngOnInit(): void {
    // Monitorear cambios en el estado de autenticación
    this.authSubscription = this.authService.currentUser$.subscribe(_user => {
      // Lógica futura: tracking de sesión
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }
}
