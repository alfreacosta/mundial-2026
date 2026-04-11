import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CountriesService, Pais } from '../../core/services/countries.service';
import { GrupoService } from '../../core/services/grupo.service';
import { EquipoFavorito } from '../../core/models/grupo.models';
import { getFlagUrl } from '../../core/utils/flag.utils';
import { normalize } from '../../shared/utils/normalize';

interface ConfederationGroup {
  code: string;
  label: string;
  fullName: string;
  region: string;
  color: string;
  lightColor: string;
  emoji: string;
  logoUrl: string;
  countries: Pais[];
}


@Component({
  selector: 'app-countries',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterLink
  ],
  templateUrl: './countries.component.html',
  styleUrls: ['./countries.component.scss']
})
export class CountriesComponent implements OnInit {
  getFlagUrl = getFlagUrl;
  countries: Pais[] = [];
  countryGroups: ConfederationGroup[] = [];
  totalCountries = 0;
  loading = true;
  error = '';
  activeConf = '';
  favoritosIds = new Set<number>();
  misFavoritos: EquipoFavorito[] = [];
  convocatoriasMap = new Map<number, number>(); // paisId -> totalJugadores
  private logoUrlMap = new Map<number, string | null>();
  pickerSlot: number | null = null; // índice del slot (0-4) con picker abierto
  pickerSearch = '';

  private readonly CONFEDERATION_CONFIG = [
    { code: 'UEFA',     label: 'UEFA',      fullName: 'Union of European Football Associations',    region: 'Europa',              color: '#2563eb', lightColor: '#dbeafe', emoji: '🇪🇺', logoUrl: '/images/confederaciones/uefa.png' },
    { code: 'CONMEBOL', label: 'CONMEBOL',  fullName: 'Confederación Sudamericana de Fútbol',       region: 'América del Sur',     color: '#d97706', lightColor: '#fef3c7', emoji: '🌎', logoUrl: '/images/confederaciones/conmebol.png' },
    { code: 'CONCACAF', label: 'CONCACAF',  fullName: 'Confederation of North & Central America',   region: 'Norteamérica/Caribe', color: '#059669', lightColor: '#d1fae5', emoji: '🍁', logoUrl: '/images/confederaciones/concacaf.png' },
    { code: 'CAF',      label: 'CAF',       fullName: 'Confédération Africaine de Football',        region: 'África',              color: '#dc2626', lightColor: '#fee2e2', emoji: '🌍', logoUrl: '/images/confederaciones/caf.png' },
    { code: 'AFC',      label: 'AFC',       fullName: 'Asian Football Confederation',               region: 'Asia & Oceanía',      color: '#7c3aed', lightColor: '#ede9fe', emoji: '🌏', logoUrl: '/images/confederaciones/afc.png' },
    { code: 'OFC',      label: 'OFC',       fullName: 'Oceania Football Confederation',             region: 'Oceanía & Pacífico',  color: '#0891b2', lightColor: '#cffafe', emoji: '🌊', logoUrl: '/images/confederaciones/ofc.png' },
  ];

  constructor(
    private countriesService: CountriesService,
    private grupoService: GrupoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCountries();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.pickerSlot !== null) this.cerrarPicker();
  }

  loadCountries(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      paises: this.countriesService.getPaises(),
      favoritos: this.grupoService.getMisFavoritos()
    }).subscribe({
      next: ({ paises, favoritos }) => {
        this.countries = paises.filter(c => c.activo);
        this.misFavoritos = [...favoritos].sort((a, b) => a.orden - b.orden);
        this.favoritosIds = new Set(favoritos.map(f => f.paisId));
        this.loading = false;
        this.buildCountryGroups();
        this.loadConvocatoriasFavoritos();
      },
      error: () => {
        // Si falla favoritos (ej: no logueado), igual cargamos los países
        this.countriesService.getPaises().subscribe({
          next: (data) => {
            this.countries = data.filter(c => c.activo);
            this.loading = false;
            this.buildCountryGroups();
          },
          error: () => {
            this.error = 'Error al cargar los países. Por favor, intentá de nuevo.';
            this.loading = false;
          }
        });
      }
    });
  }

  loadConvocatoriasFavoritos(): void {
    this.misFavoritos.forEach(fav => {
      this.countriesService.getMiConvocatoria(fav.paisId).subscribe({
        next: (conv) => {
          if (conv) {
            this.convocatoriasMap.set(fav.paisId, conv.totalJugadores);
          }
        },
        error: () => {
          // Si falla, simplemente no mostramos el contador
        }
      });
    });
  }

  getConvocados(paisId: number): number {
    return this.convocatoriasMap.get(paisId) || 0;
  }

  esFavorito(pais: Pais): boolean {
    return this.misFavoritos.some(f => Number(f.paisId) === Number(pais.internalId));
  }

  quitarFavoritoById(paisId: number, event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    const id = Number(paisId);
    this.grupoService.quitarFavorito(id).subscribe({
      next: () => {
        this.misFavoritos = this.misFavoritos.filter(f => Number(f.paisId) !== id);
        this.convocatoriasMap.delete(id);
        
        // Reordenar los restantes
        if (this.misFavoritos.length > 0) {
          const paisIds = this.misFavoritos.map(f => Number(f.paisId));
          this.grupoService.setFavoritos(paisIds).subscribe({
            next: (updated) => {
              this.misFavoritos = [...updated].sort((a, b) => a.orden - b.orden);
            }
          });
        }
      },
      error: (err) => {
        console.error('Error al quitar favorito:', err);
      }
    });
  }

  toggleFavorito(pais: Pais, event?: Event): void {
    if (event) event.stopPropagation();

    const esFav = this.esFavorito(pais);

    const paisId = Number(pais.internalId);

    if (esFav) {
      // Optimistic update: quitar inmediatamente
      const backupFavs = [...this.misFavoritos];
      this.misFavoritos = this.misFavoritos.filter(f => Number(f.paisId) !== paisId);

      this.grupoService.quitarFavorito(paisId).subscribe({
        next: () => {
          this.convocatoriasMap.delete(paisId);
          if (this.misFavoritos.length > 0) {
            const paisIds = this.misFavoritos.map(f => Number(f.paisId));
            this.grupoService.setFavoritos(paisIds).subscribe({
              next: (updated) => {
                this.misFavoritos = [...updated].sort((a, b) => a.orden - b.orden);
              }
            });
          }
        },
        error: () => {
          this.misFavoritos = backupFavs;
        }
      });
    } else {
      if (this.misFavoritos.length >= 5) {
        alert('Ya tenés 5 equipos favoritos. Quitá uno para agregar otro.');
        return;
      }

      // Optimistic update: marcar como favorito inmediatamente
      const newIds = [...this.misFavoritos.map(f => Number(f.paisId)), paisId];

      this.grupoService.setFavoritos(newIds).subscribe({
        next: (updated) => {
          this.misFavoritos = [...updated].sort((a, b) => a.orden - b.orden);
          this.countriesService.getMiConvocatoria(paisId).subscribe({
            next: (conv) => {
              if (conv) this.convocatoriasMap.set(paisId, conv.totalJugadores);
            }
          });
        },
        error: () => {
          alert('Error al agregar favorito');
        }
      });
    }
  }

  private buildCountryGroups(): void {
    // Precomputar URLs de logos UNA sola vez (evita recalcular en cada ciclo de CD)
    this.countries.forEach(p => {
      if (!this.logoUrlMap.has(p.internalId)) {
        this.logoUrlMap.set(p.internalId, CountriesService.proxyUrl(p.logoUrl ?? null));
      }
    });
    this.countryGroups = this.CONFEDERATION_CONFIG
      .map(conf => ({
        ...conf,
        countries: this.countries
          .filter(c => c.confederacion?.codigo === conf.code)
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
      }))
      .filter(g => g.countries.length > 0);
    this.totalCountries = this.countries.length;
    if (this.countryGroups.length > 0 && !this.activeConf) {
      this.activeConf = this.countryGroups[0].code;
    }
  }

  getLogoUrl(pais: Pais): string | null {
    return this.logoUrlMap.get(pais.internalId) ?? null;
  }

  onConfLogoError(event: Event, fallbackEmoji: string): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const span = document.createElement('span');
    span.className = 'pill-emoji';
    span.textContent = fallbackEmoji;
    img.parentElement?.insertBefore(span, img);
  }

  trackByPaisId(_index: number, pais: Pais): number {
    return pais.internalId;
  }

  trackByConfCode(_index: number, group: ConfederationGroup): string {
    return group.code;
  }

  scrollToSection(code: string): void {
    this.activeConf = code;
    const el = document.getElementById('section-' + code);
    if (!el) return;
    // Calcular posición ANTES de cualquier scroll para evitar doble-animación
    const headerOffset = 144; // navbar(80) + conf-nav(~54) + margen(10)
    const target = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  seleccionarConvocados(pais: Pais): void {
    this.router.navigate(['/convocados', pais.internalId]);
  }

  verSeleccion(pais: Pais): void {
    this.router.navigate(['/seleccion', pais.codigo]);
  }

  private readonly FIFA_TO_ISO: Record<string, string> = {
    'ARG': 'AR', 'BRA': 'BR', 'URU': 'UY', 'COL': 'CO',
    'CHI': 'CL', 'PAR': 'PY', 'ECU': 'EC', 'BOL': 'BO',
    'PER': 'PE', 'VEN': 'VE',
    'GER': 'DE', 'ENG': 'GB', 'FRA': 'FR', 'ESP': 'ES',
    'ITA': 'IT', 'POR': 'PT', 'NED': 'NL', 'BEL': 'BE',
    'SUI': 'CH', 'AUT': 'AT', 'CRO': 'HR', 'SVN': 'SI',
    'DEN': 'DK', 'SWE': 'SE', 'NOR': 'NO', 'FIN': 'FI',
    'ISL': 'IS', 'IRL': 'IE', 'SCO': 'GB', 'WAL': 'GB',
    'TUR': 'TR', 'POL': 'PL', 'ROU': 'RO', 'HUN': 'HU',
    'GRE': 'GR', 'SRB': 'RS', 'CZE': 'CZ', 'SVK': 'SK',
    'UKR': 'UA', 'ALB': 'AL', 'MKD': 'MK', 'MNE': 'ME',
    'BIH': 'BA', 'RUS': 'RU', 'GEO': 'GE', 'LUX': 'LU',
    'USA': 'US', 'MEX': 'MX', 'CAN': 'CA', 'CRC': 'CR',
    'HON': 'HN', 'PAN': 'PA', 'SLV': 'SV', 'TRI': 'TT',
    'JAM': 'JM', 'HAI': 'HT', 'GUA': 'GT', 'CUB': 'CU',
    'MAR': 'MA', 'SEN': 'SN', 'NGA': 'NG', 'GHA': 'GH',
    'CMR': 'CM', 'CIV': 'CI', 'EGY': 'EG', 'TUN': 'TN',
    'ALG': 'DZ', 'RSA': 'ZA', 'ZAF': 'ZA', 'KEN': 'KE',
    'ETH': 'ET', 'ANG': 'AO', 'MLI': 'ML', 'MOZ': 'MZ',
    'JPN': 'JP', 'KOR': 'KR', 'IRN': 'IR', 'SAU': 'SA',
    'AUS': 'AU', 'QAT': 'QA', 'UAE': 'AE', 'IRQ': 'IQ',
    'JOR': 'JO', 'UZB': 'UZ', 'KAZ': 'KZ', 'CHN': 'CN',
    'IND': 'IN', 'THA': 'TH', 'VIE': 'VN', 'IDN': 'ID',
    'SYR': 'SY', 'KWT': 'KW', 'LBN': 'LB', 'OMN': 'OM',
    'TPE': 'TW', 'PRK': 'KP', 'SGP': 'SG',
    'NZL': 'NZ', 'FIJ': 'FJ', 'SOL': 'SB', 'PNG': 'PG',
    'VAN': 'VU', 'SAM': 'WS', 'CPV': 'CV',
  };

  abrirPicker(slotIndex: number, event: Event): void {
    event.stopPropagation();
    this.pickerSlot = this.pickerSlot === slotIndex ? null : slotIndex;
    this.pickerSearch = '';
  }

  cerrarPicker(): void {
    this.pickerSlot = null;
    this.pickerSearch = '';
  }

  get paisesDisponibles(): Pais[] {
    const favIds = new Set(this.misFavoritos.map(f => Number(f.paisId)));
    return this.countries
      .filter(p => !favIds.has(Number(p.internalId)))
      .filter(p => !this.pickerSearch || normalize(p.nombre).includes(normalize(this.pickerSearch)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  seleccionarDesdeSlot(pais: Pais, event: Event): void {
    event.stopPropagation();
    this.cerrarPicker();
    this.toggleFavorito(pais);
  }

  getFlagEmoji(codigo: string): string {
    if (!codigo) return '🏳️';
    const upper = codigo.toUpperCase();
    const iso = upper.length === 3
      ? (this.FIFA_TO_ISO[upper] ?? upper.substring(0, 2))
      : upper;
    if (iso.length !== 2) return '🏳️';
    const codePoints = iso.split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0));
    try { return String.fromCodePoint(...codePoints); } catch { return '🏳️'; }
  }

  onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
