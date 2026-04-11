import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './privacy.component.html',
  styleUrls: ['./privacy.component.scss']
})
export class PrivacyComponent {
  lastUpdated = '22 de marzo de 2026';

  sections = [
    { id: 'defending', icon: 'shield', title: 'Defendemos tus datos' },
    { id: 'how-we-look', icon: 'manage_accounts', title: 'Cómo cuidamos tus datos' },
    { id: 'your-rights', icon: 'verified_user', title: 'Tus derechos' },
    { id: 'collecting', icon: 'data_usage', title: 'Recolección de datos' },
    { id: 'what-data', icon: 'list_alt', title: '¿Qué datos recolectamos?' },
    { id: 'sharing', icon: 'share', title: 'Compartir tus datos' },
    { id: 'when-share', icon: 'schedule', title: '¿Cuándo compartimos datos?' },
    { id: 'keeping-safe', icon: 'lock', title: 'Mantenemos tus datos seguros' },
    { id: 'updating', icon: 'edit', title: 'Actualización y eliminación' },
    { id: 'children', icon: 'child_care', title: 'Menores y datos' },
    { id: 'where', icon: 'public', title: '¿Dónde procesamos tus datos?' },
    { id: 'cookies', icon: 'cookie', title: 'Cookies' },
    { id: 'complaints', icon: 'report_problem', title: 'Reclamaciones' },
    { id: 'small-print', icon: 'article', title: 'La letra chica' },
    { id: 'contact', icon: 'mail', title: 'Contáctanos' },
  ];

  scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
