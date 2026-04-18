import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { StatsService, UsuarioRanking } from '../../core/services/stats.service';
import { MensajeService } from '../../core/services/mensaje.service';
import { GrupoService, GrupoRanking } from '../../core/services/grupo.service';
import { EquipoFavorito, Grupo } from '../../core/models/grupo.models';
import { JugadorPais } from '../../core/services/countries.service';
import { PrediccionTorneoService, PrediccionTorneo } from '../../core/services/prediccion-torneo.service';
import { CountriesService, ConvocatoriaResponse } from '../../core/services/countries.service';
import { PrediccionPartidoService, ResumenPredicciones } from '../../core/services/prediccion-partido.service';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { getFlagUrl } from '../../core/utils/flag.utils';
import { AvatarIconComponent } from '../../shared/components/avatar-icon/avatar-icon.component';
import { MiniPitchComponent } from '../../shared/mini-pitch/mini-pitch.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, ClipboardModule, AvatarIconComponent, MiniPitchComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {

  userName = 'Usuario';
  userPoints = 0;
  userRank: number | null = null;
  top5: (UsuarioRanking & { pos: number })[] = [];
  top10: (UsuarioRanking & { pos: number })[] = [];
  fullRanking: (UsuarioRanking & { pos: number })[] = [];
  userEntry: (UsuarioRanking & { pos: number }) | null = null;
  gruposRanking: GrupoRanking[] = [];
  misGrupos: Grupo[] = [];

  // Datos personales del usuario
  misFavoritos: EquipoFavorito[] = [];
  miPrediccion: PrediccionTorneo | null = null;
  convocatorias: Map<number, ConvocatoriaResponse> = new Map();
  convocadosExpandidos = new Set<number>();
  titularesExpandidos = new Set<number>();
  jugadoresPorPais: Map<number, JugadorPais[]> = new Map();
  convocadosCargando = new Set<number>();
  datosPersonalesLoading = false;

  // Resumen predicciones de partidos
  resumenPredicciones: ResumenPredicciones | null = null;

  // Mensaje / sugerencia
  mensajeText = '';
  mensajeLoading = false;
  mensajeEnviado = false;
  mensajeError = '';

  countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  private countdownTimer: any;

  // Fecha de inicio del Mundial 2026
  private readonly worldCupStart = new Date('2026-06-11T16:00:00Z');

  newsItems = [
    { id: 1, emoji: '🏆', tag: 'Formato',    type: 'highlight', text: 'Por primera vez la Copa del Mundo contará con 48 selecciones divididas en 12 grupos de 4.' },
    { id: 2, emoji: '🌎', tag: 'Sede',       type: 'info',      text: 'El torneo se disputará en 16 ciudades de Estados Unidos, Canadá y México — el primero en 3 países.' },
    { id: 3, emoji: '🏟️', tag: 'Metlife',   type: 'venue',     text: 'La final será en el MetLife Stadium de Nueva York/New Jersey, con capacidad para 82.500 espectadores.' },
    { id: 4, emoji: '⚽', tag: 'Partidos',   type: 'stat',      text: '104 partidos en total. La fase de grupos es la más larga de la historia con 3 equipos clasificando por grupo.' },
    { id: 5, emoji: '🥇', tag: 'Récord',     type: 'record',    text: 'Brasil es el mayor ganador con 5 títulos, seguido de Alemania e Italia con 4 cada uno.' },
    { id: 6, emoji: '📅', tag: 'Calendario', type: 'info',      text: 'La fase de grupos inicia el 11 de junio y la gran final está programada para el 19 de julio de 2026.' },
  ];

  showVideo = false;
  videoUrl!: SafeResourceUrl;

  readonly slideshowPhotos = [
    'images/1000620828.jpg',
    'images/1000620829.jpg',
    'images/1000620830.jpg',
    'images/1000620831.jpg',
    'images/1000620832.jpg',
    'images/1000620833.jpg',
    'images/1000620834.jpg',
  ];

  currentPhotoIndex = 0;
  photoVisible = true;
  private slideshowTimer: any;

  worldCupFacts = [
    { emoji: '🌍', label: 'Países participantes', value: '48 selecciones' },
    { emoji: '🏙️', label: 'Ciudades sede',        value: '16 ciudades' },
    { emoji: '⚽', label: 'Total de partidos',     value: '104 partidos' },
    { emoji: '📅', label: 'Inicio',                value: '11 Jun 2026' },
    { emoji: '🏆', label: 'Final',                 value: '19 Jul 2026' },
    { emoji: '👥', label: 'Grupos',                value: '12 grupos (A–L)' },
  ];

  constructor(
    private authService: AuthService,
    private statsService: StatsService,
    private mensajeService: MensajeService,
    private grupoService: GrupoService,
    private prediccionService: PrediccionTorneoService,
    private prediccionPartidoService: PrediccionPartidoService,
    private countriesService: CountriesService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private snackBar: MatSnackBar
  ) {
    const origin = encodeURIComponent(window.location.origin);
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/QR52cerl0CQ?autoplay=1&rel=0&controls=1&origin=${origin}`
    );
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.nombre || user.user || 'Usuario';
      this.userPoints = user.puntaje ?? 0;
    }

    // Cargar ranking completo
    this.statsService.getRanking().subscribe({
      next: (ranking) => {
        const withPos = ranking.map((u, i) => ({ ...u, pos: i + 1 }));
        this.fullRanking = withPos;
        this.top5 = withPos.slice(0, 5);
        this.top10 = withPos.slice(0, 10);
        const currentUser = user?.user ?? '';
        const idx = withPos.findIndex(u => u.user === currentUser);
        if (idx !== -1) {
          this.userRank = idx + 1;
          this.userEntry = withPos[idx];
        }
      },
      error: () => {}
    });

    // Cargar ranking de grupos
    this.grupoService.getRankingGrupos().subscribe({
      next: (grupos) => { this.gruposRanking = grupos; },
      error: () => {}
    });

    // Cargar mis grupos
    this.grupoService.getMisGrupos().subscribe({
      next: (grupos) => { this.misGrupos = grupos; },
      error: () => {}
    });

    // Cargar datos personales del usuario (favoritos, predicción, convocatorias)
    this.cargarDatosPersonales();

    this.updateCountdown();
    this.countdownTimer = setInterval(() => this.updateCountdown(), 1000);

    this.slideshowTimer = setInterval(() => {
      this.photoVisible = false;
      setTimeout(() => {
        this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.slideshowPhotos.length;
        this.photoVisible = true;
      }, 400);
    }, 5000);
  }

  private cargarDatosPersonales(): void {
    this.datosPersonalesLoading = true;

    forkJoin({
      favoritos:   this.grupoService.getMisFavoritos(),
      prediccion:  this.prediccionService.getMiPrediccion(),
      resumen:     this.prediccionPartidoService.getMiResumen().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ favoritos, prediccion, resumen }) => {
        this.misFavoritos    = favoritos;
        this.miPrediccion    = prediccion;
        this.resumenPredicciones = resumen;

        // Cargar convocatorias de cada equipo favorito
        if (favoritos.length > 0) {
          const convObs = favoritos.map(fav =>
            this.countriesService.getMiConvocatoria(fav.paisId)
          );

          forkJoin(convObs).subscribe({
            next: convResList => {
              this.convocatorias.clear();
              favoritos.forEach((fav, idx) => {
                const conv = convResList[idx];
                if (conv) this.convocatorias.set(fav.paisId, conv);
              });
              this.datosPersonalesLoading = false;
            },
            error: () => { this.datosPersonalesLoading = false; }
          });
        } else {
          this.datosPersonalesLoading = false;
        }
      },
      error: () => { this.datosPersonalesLoading = false; }
    });
  }

  getFlagUrl = getFlagUrl;

  getConvocatoriaProgress(paisId: number): { total: number; max: number } {
    const conv = this.convocatorias.get(paisId);
    return { total: conv?.totalJugadores ?? 0, max: 26 };
  }

  toggleConvocados(paisId: number): void {
    if (this.convocadosExpandidos.has(paisId)) {
      this.convocadosExpandidos.delete(paisId);
      return;
    }
    this.convocadosExpandidos.add(paisId);
    // Carga lazy de jugadores via GraphQL (permitAll - no requiere token)
    if (!this.jugadoresPorPais.has(paisId) && !this.convocadosCargando.has(paisId)) {
      this.convocadosCargando.add(paisId);
      this.countriesService.getJugadoresPorPais(paisId).pipe(
        catchError(() => of([]))
      ).subscribe(jugadores => {
        this.jugadoresPorPais.set(paisId, jugadores);
        this.convocadosCargando.delete(paisId);
      });
    }
  }

  toggleTitulares(paisId: number): void {
    if (this.titularesExpandidos.has(paisId)) {
      this.titularesExpandidos.delete(paisId);
      return;
    }
    this.titularesExpandidos.add(paisId);
    // Carga lazy de jugadores si no tenemos
    if (!this.jugadoresPorPais.has(paisId) && !this.convocadosCargando.has(paisId)) {
      this.convocadosCargando.add(paisId);
      this.countriesService.getJugadoresPorPais(paisId).pipe(
        catchError(() => of([]))
      ).subscribe(jugadores => {
        this.jugadoresPorPais.set(paisId, jugadores);
        this.convocadosCargando.delete(paisId);
      });
    }
  }

  getTitularesParaCancha(paisId: number): { id: number; apellido: string; camiseta: number | null; posAbr: string; x: number; y: number; urlFoto: string | null }[] {
    const todos = this.jugadoresPorPais.get(paisId) ?? [];
    const conv = this.convocatorias.get(paisId);
    if (!conv || todos.length === 0) return [];
    const titIds = new Set(conv.titularesIds ?? []);
    if (titIds.size === 0) return [];
    const posMap = new Map((conv.posicionesTitulares ?? []).map(p => [p.jugadorId, { x: p.x, y: p.y }]));

    // Filtrar titulares y agrupar por posición
    const titulares = todos.filter(j => titIds.has(j.internalId));
    const porPos = new Map<string, typeof titulares>();
    for (const j of titulares) {
      const abr = j.posicion.abreviatura === 'ARQ' ? 'POR' : j.posicion.abreviatura;
      if (!porPos.has(abr)) porPos.set(abr, []);
      porPos.get(abr)!.push(j);
    }

    // Y por posición, X distribuido equitativamente
    const yByPos: Record<string, number> = { POR: 90, DEF: 70, MED: 44, DEL: 18 };
    const results: { id: number; apellido: string; camiseta: number | null; posAbr: string; x: number; y: number; urlFoto: string | null }[] = [];

    for (const [abr, jugadores] of porPos) {
      const baseY = yByPos[abr] ?? 50;
      const n = jugadores.length;
      jugadores.forEach((j, i) => {
        const saved = posMap.get(j.internalId);
        if (saved) {
          results.push({ id: j.internalId, apellido: j.apellido ?? j.nombre, camiseta: j.numeroCamiseta, posAbr: j.posicion.abreviatura, x: saved.x, y: saved.y, urlFoto: j.urlFoto });
        } else {
          // Distribuir horizontalmente entre 15% y 85%
          const x = n === 1 ? 50 : 15 + (70 * i) / (n - 1);
          results.push({ id: j.internalId, apellido: j.apellido ?? j.nombre, camiseta: j.numeroCamiseta, posAbr: j.posicion.abreviatura, x, y: baseY, urlFoto: j.urlFoto });
        }
      });
    }
    return results;
  }

  private getDefaultPos(posAbr: string, _allIds: number[], _id: number): { x: number; y: number } {
    const defaults: Record<string, { x: number; y: number }> = {
      POR: { x: 50, y: 90 }, ARQ: { x: 50, y: 90 },
      DEF: { x: 50, y: 70 }, MED: { x: 50, y: 44 }, DEL: { x: 50, y: 18 }
    };
    return defaults[posAbr] ?? { x: 50, y: 50 };
  }

  getDashboardConvocados(paisId: number): { id: number; nombre: string; apellido: string; numeroCamiseta: number | null; posicionAbr: string; urlFoto: string | null; club: string | null; titular: boolean }[] {
    const todos = this.jugadoresPorPais.get(paisId) ?? [];
    const conv  = this.convocatorias.get(paisId);
    if (!conv || todos.length === 0) return [];
    const ids    = new Set(conv.jugadoresIds);
    const titIds = new Set(conv.titularesIds ?? []);
    const POS_ORDER: Record<string, number> = { ARQ: 1, POR: 1, DEF: 2, MED: 3, DEL: 4 };
    return todos
      .filter(j => ids.has(j.internalId))
      .map(j => ({
        id: j.internalId,
        nombre: j.nombre,
        apellido: j.apellido ?? '',
        numeroCamiseta: j.numeroCamiseta,
        posicionAbr: j.posicion.abreviatura,
        urlFoto: j.urlFoto,
        club: j.club?.nombre ?? null,
        titular: titIds.has(j.internalId),
      }))
      .sort((a, b) => (POS_ORDER[a.posicionAbr] ?? 5) - (POS_ORDER[b.posicionAbr] ?? 5));
  }

  getPosColorDashboard(abr: string): string {
    const MAP: Record<string, string> = { ARQ: '#f59e0b', POR: '#f59e0b', DEF: '#3b82f6', MED: '#10b981', DEL: '#ef4444' };
    return MAP[abr] ?? '#94a3b8';
  }

  getDashboardConvocadosPorPos(paisId: number, posAbr: string) {
    return this.getDashboardConvocados(paisId).filter(j => j.posicionAbr === posAbr);
  }

  toggleTitularDashboard(paisId: number, jugadorId: number): void {
    const conv = this.convocatorias.get(paisId);
    if (!conv) return;
    const titSet  = new Set(conv.titularesIds ?? []);
    const jugadores = this.jugadoresPorPais.get(paisId) ?? [];

    if (titSet.has(jugadorId)) {
      // Quitar titular
      titSet.delete(jugadorId);
    } else {
      // Validar máximo 11 titulares
      if (titSet.size >= 11) {
        this.snackBar.open('Máximo 11 titulares', '', { duration: 2500, panelClass: 'snack-warn' });
        return;
      }
      // Validar máximo 1 ARQ
      const jugador = jugadores.find(j => j.internalId === jugadorId);
      const posAbr  = jugador?.posicion?.abreviatura ?? jugador?.posicion?.codigo ?? '';
      const esArq   = posAbr === 'ARQ' || posAbr === 'POR';
      if (esArq) {
        const arqsActuales = jugadores.filter(j =>
          titSet.has(j.internalId) &&
          (j.posicion?.abreviatura === 'ARQ' || j.posicion?.abreviatura === 'POR' ||
           j.posicion?.codigo === 'ARQ' || j.posicion?.codigo === 'POR')
        ).length;
        if (arqsActuales >= 1) {
          this.snackBar.open('Solo podés tener 1 arquero titular', '', { duration: 2500, panelClass: 'snack-warn' });
          return;
        }
      }
      titSet.add(jugadorId);
    }

    const newTitulares = Array.from(titSet);
    conv.titularesIds = newTitulares;
    this.countriesService.guardarConvocatoria(paisId, conv.jugadoresIds, conv.noVaIds ?? [], newTitulares)
      .subscribe({ error: () => {} });
  }

  getWhatsAppLink(grupo: Grupo): string {
    const url = `${environment.appUrl}/mis-grupos?codigo=${grupo.codigoInvitacion}`;
    const text = `⚽ *DT26 - Mundial 2026* ⚽\n\n¡Unite a "${grupo.nombre}" y demostrá que sabés más que el técnico! 💪\nArmá tu equipo, desafiá a tus amigos y competí por ser el mejor director técnico. 🏆\n\n👉 ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  openVideo(): void {
    window.open('https://www.youtube.com/watch?v=QR52cerl0CQ', '_blank', 'noopener,noreferrer');
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.slideshowTimer) clearInterval(this.slideshowTimer);
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

  enviarMensaje(): void {
    if (!this.mensajeText.trim() || this.mensajeLoading) return;
    this.mensajeLoading = true;
    this.mensajeError = '';
    this.mensajeEnviado = false;

    this.mensajeService.enviar(this.mensajeText.trim()).subscribe({
      next: () => {
        this.mensajeLoading = false;
        this.mensajeEnviado = true;
        this.mensajeText = '';
        setTimeout(() => this.mensajeEnviado = false, 4000);
      },
      error: () => {
        this.mensajeLoading = false;
        this.mensajeError = 'No se pudo enviar. Intentá de nuevo.';
      }
    });
  }
}

