import { Routes } from '@angular/router';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { PlayersComponent } from './features/players/players.component';
import { CountriesComponent } from './features/countries/countries.component';
import { ConvocadosComponent } from './features/convocados/convocados.component';
import { StatsComponent } from './features/stats/stats.component';
import { MyTeamComponent } from './features/my-team/my-team.component';
import { GroupsComponent } from './features/groups/groups.component';
import { PrivacyComponent } from './features/privacy/privacy.component';
import { SeleccionDetailComponent } from './features/seleccion-detail/seleccion-detail.component';
import { EstadiosComponent } from './features/estadios/estadios.component';
import { PerfilComponent } from './features/perfil/perfil.component';
import { MisGruposComponent } from './features/mis-grupos/mis-grupos.component';
import { DetalleGrupoComponent } from './features/detalle-grupo/detalle-grupo.component';
import { BuscarUsuariosComponent } from './features/buscar-usuarios/buscar-usuarios.component';
import { PerfilPublicoComponent } from './features/perfil-publico/perfil-publico.component';
import { GrupoInvitacionComponent } from './features/grupo-invitacion/grupo-invitacion.component';
import { PrediccionTorneoComponent } from './features/prediccion-torneo/prediccion-torneo.component';
import { PrediccionPartidosComponent } from './features/prediccion-partidos/prediccion-partidos.component';
import { PrediccionesComponent } from './features/predicciones/predicciones.component';
import { ReglasComponent } from './features/reglas/reglas.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { authGuard, loginGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Rutas públicas
  { path: '', redirectTo: 'register', pathMatch: 'full' },
  { path: 'login', redirectTo: 'register', pathMatch: 'full' },
  { path: 'register', component: RegisterComponent, canActivate: [loginGuard] },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'reglas', component: ReglasComponent },
  { path: 'privacidad', component: PrivacyComponent },
  { path: 'grupo/:codigo', component: GrupoInvitacionComponent },

  // Rutas protegidas - Mundial 2026
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'my-team', component: MyTeamComponent, canActivate: [authGuard] },
  { path: 'players', component: PlayersComponent, canActivate: [authGuard] },
  { path: 'stats', component: StatsComponent, canActivate: [authGuard] },
  { path: 'countries', component: CountriesComponent, canActivate: [authGuard] },
  { path: 'convocados/:paisId', component: ConvocadosComponent, canActivate: [authGuard] },
  { path: 'seleccion/:codigo', redirectTo: 'countries', pathMatch: 'full' },
  { path: 'groups', component: GroupsComponent, canActivate: [authGuard] },
  { path: 'estadios', component: EstadiosComponent, canActivate: [authGuard] },
  { path: 'perfil', component: PerfilComponent, canActivate: [authGuard] },

  // Predicciones (nuevo — página unificada)
  { path: 'predicciones', component: PrediccionesComponent, canActivate: [authGuard] },
  // Rutas antiguas redirigen a la nueva página unificada
  { path: 'prediccion-torneo',   redirectTo: 'predicciones', pathMatch: 'full' },
  { path: 'prediccion-partidos', redirectTo: 'predicciones', pathMatch: 'full' },

  // Nuevas rutas: Grupos & Perfiles
  { path: 'mis-grupos', component: MisGruposComponent, canActivate: [authGuard] },
  { path: 'mis-grupos/:id', component: DetalleGrupoComponent, canActivate: [authGuard] },
  { path: 'buscar-usuarios', component: BuscarUsuariosComponent, canActivate: [authGuard] },
  { path: 'perfil-publico/:user', component: PerfilPublicoComponent, canActivate: [authGuard] },

  // Redirección por defecto
  { path: '**', redirectTo: '' }
];
