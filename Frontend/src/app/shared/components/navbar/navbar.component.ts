import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AvatarIconComponent } from '../avatar-icon/avatar-icon.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, AvatarIconComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  
  protected readonly isMenuOpen = signal(false);
  protected readonly user = this.authService.currentUser$;
  protected readonly isAuthenticated = () => this.authService.isAuthenticated();

  countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  private countdownTimer: any;
  private readonly worldCupStart = new Date('2026-06-11T16:00:00Z');

  ngOnInit(): void {
    this.updateCountdown();
    this.countdownTimer = setInterval(() => this.updateCountdown(), 1000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  private updateCountdown(): void {
    const now = new Date();
    const diff = this.worldCupStart.getTime() - now.getTime();
    if (diff <= 0) {
      this.countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return;
    }
    this.countdown = {
      days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }

  protected toggleMenu(): void {
    this.isMenuOpen.update(value => !value);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
    this.closeMenu();
  }
}
