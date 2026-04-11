import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  protected readonly currentYear = signal(new Date().getFullYear());
  
  protected readonly quickLinks = signal([
    { label: 'Inicio',         route: '/' },
    { label: 'Grupos',         route: '/groups' },
    { label: 'Países',         route: '/countries' },
    { label: 'Partidos',       route: '/fixtures' },
    { label: 'Clasificación',  route: '/stats' }
  ]);
  
  protected readonly socialLinks = signal([
    { icon: 'fab fa-twitter', url: 'https://x.com/fifaworldcup_es', label: 'X (Twitter)' },
    { icon: 'fab fa-facebook', url: 'https://www.facebook.com/fifaworldcup/?locale=es_LA', label: 'Facebook' },
    { icon: 'fab fa-instagram', url: 'https://www.instagram.com/fifaworldcup/?hl=es', label: 'Instagram' },
    { icon: 'fab fa-youtube', url: 'https://www.youtube.com/channel/UCpcTrCXblq78GZrTUTLWeBw', label: 'YouTube' },
    { icon: 'fab fa-spotify', url: 'https://open.spotify.com/playlist/6JwECvd2Q2elZU7sR4jvT1?si=cd52455fb4a44996', label: 'Spotify' }
  ]);
}
