import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (avatarId) {
      <svg [attr.viewBox]="'0 0 80 80'" class="avatar-svg" [style.width.px]="size" [style.height.px]="size">
        @switch (avatarId) {
          @case ('avatar-goalkeeper') {
            <circle cx="40" cy="28" r="14" fill="#fbbf24"/>
            <path d="M20 70 Q40 50 60 70" fill="#22c55e"/>
            <rect x="32" y="16" width="16" height="4" rx="2" fill="#fff"/>
          }
          @case ('avatar-striker') {
            <circle cx="40" cy="28" r="14" fill="#f87171"/>
            <path d="M20 70 Q40 50 60 70" fill="#ef4444"/>
            <circle cx="40" cy="60" r="6" fill="#fff" stroke="#333" stroke-width="1.5"/>
          }
          @case ('avatar-defender') {
            <circle cx="40" cy="28" r="14" fill="#60a5fa"/>
            <path d="M20 70 Q40 50 60 70" fill="#2563eb"/>
            <path d="M33 50 L40 44 L47 50 L47 58 L33 58Z" fill="#fbbf24"/>
          }
          @case ('avatar-midfielder') {
            <circle cx="40" cy="28" r="14" fill="#a78bfa"/>
            <path d="M20 70 Q40 50 60 70" fill="#7c3aed"/>
            <path d="M34 52 L46 52 L43 60 L37 60Z" fill="#fbbf24"/>
          }
          @case ('avatar-captain') {
            <circle cx="40" cy="28" r="14" fill="#fbbf24"/>
            <path d="M20 70 Q40 50 60 70" fill="#1e3a5f"/>
            <text x="40" y="32" text-anchor="middle" fill="#1e3a5f" font-size="12" font-weight="bold">C</text>
          }
          @case ('avatar-referee') {
            <circle cx="40" cy="28" r="14" fill="#fde68a"/>
            <path d="M20 70 Q40 50 60 70" fill="#111"/>
            <rect x="36" y="48" width="8" height="12" rx="1" fill="#fbbf24"/>
          }
          @case ('avatar-coach') {
            <circle cx="40" cy="28" r="14" fill="#d1d5db"/>
            <path d="M20 70 Q40 50 60 70" fill="#374151"/>
            <rect x="30" y="18" width="20" height="3" rx="1.5" fill="#374151"/>
          }
          @case ('avatar-fan-m') {
            <circle cx="40" cy="28" r="14" fill="#fca5a5"/>
            <path d="M20 70 Q40 50 60 70" fill="#ef4444"/>
            <path d="M30 18 L40 10 L50 18" fill="none" stroke="#ef4444" stroke-width="2.5"/>
          }
          @case ('avatar-fan-f') {
            <circle cx="40" cy="28" r="14" fill="#fbcfe8"/>
            <path d="M20 70 Q40 50 60 70" fill="#ec4899"/>
            <circle cx="34" cy="22" r="2" fill="#ec4899"/>
            <circle cx="46" cy="22" r="2" fill="#ec4899"/>
          }
          @case ('avatar-trophy') {
            <circle cx="40" cy="28" r="14" fill="#fef3c7"/>
            <path d="M20 70 Q40 50 60 70" fill="#d97706"/>
            <path d="M34 20 L34 34 Q34 38 40 38 Q46 38 46 34 L46 20 L50 20 Q48 28 46 34 L34 34 Q32 28 30 20Z" fill="#fbbf24"/>
          }
          @default {
            <circle cx="40" cy="28" r="14" fill="#64748b"/>
            <path d="M20 70 Q40 50 60 70" fill="#475569"/>
          }
        }
      </svg>
    } @else if (initials) {
      <span class="avatar-initials" [style.width.px]="size" [style.height.px]="size" [style.font-size.px]="size * 0.4">{{ initials }}</span>
    } @else {
      <span class="avatar-default" [style.width.px]="size" [style.height.px]="size">
        <svg viewBox="0 0 24 24" fill="currentColor" [style.width.px]="size * 0.6" [style.height.px]="size * 0.6">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </span>
    }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; justify-content: center; }
    .avatar-svg { border-radius: 50%; background: rgba(30,41,59,.6); }
    .avatar-initials {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; background: rgba(6,182,212,.15); color: #06b6d4;
      font-weight: 700; text-transform: uppercase;
    }
    .avatar-default {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; background: rgba(100,116,139,.2); color: #64748b;
    }
  `]
})
export class AvatarIconComponent {
  @Input() avatarId: string | null | undefined = null;
  @Input() nombre: string | null | undefined = null;
  @Input() apellido: string | null | undefined = null;
  @Input() size = 32;

  get initials(): string {
    const n = (this.nombre || '').trim();
    const a = (this.apellido || '').trim();
    if (n && a) return n[0] + a[0];
    if (n) return n.substring(0, 2);
    return '';
  }
}
