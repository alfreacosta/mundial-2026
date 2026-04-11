import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-beneficios',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './beneficios.component.html',
  styleUrls: ['./beneficios.component.scss']
})
export class BeneficiosComponent {

  premios = [
    {
      emoji: '👕',
      categoria: 'Merchandising',
      titulo: 'Remera Selección Paraguaya',
      descripcion: 'Camiseta oficial de la Albirroja con el nombre y número de tu jugador favorito. Edición especial Mundial 2026.',
      sponsor: 'APF',
      color: 'red',
      destacado: false
    },
    {
      emoji: '🏆',
      categoria: 'Gran Premio',
      titulo: 'Trofeo del Campeón',
      descripcion: 'El jugador que termine primero en la clasificación general recibirá el trofeo oficial del torneo Mundial 2026.',
      sponsor: 'Mundial 2026',
      color: 'gold',
      destacado: true
    },
    {
      emoji: '🎰',
      categoria: 'Apuestas',
      titulo: 'Vale de Apuestas',
      descripcion: 'Crédito para apostar en las mejores plataformas oficiales de apuestas deportivas.',
      sponsor: 'Sponsors',
      color: 'gold',
      destacado: false
    },
    {
      emoji: '🧢',
      categoria: 'Merchandising',
      titulo: 'Kepis Oficiales',
      descripcion: 'Gorras bordadas con el escudo de la Selección Paraguaya. Colección exclusiva Mundial 2026.',
      sponsor: 'APF',
      color: 'blue',
      destacado: false
    },
    {
      emoji: '💊',
      categoria: 'Salud',
      titulo: 'Vale Consumición Farmacia',
      descripcion: 'Vales canjeables en farmacias adheridas para medicamentos, vitaminas y productos de salud.',
      sponsor: 'Farmacias Adheridas',
      color: 'green',
      destacado: false
    },
    {
      emoji: '🎁',
      categoria: 'Sorpresas',
      titulo: 'Premios Sorpresa',
      descripcion: 'Los primeros 10 del ranking recibirán premios sorpresa adicionales de nuestros patrocinadores.',
      sponsor: 'Sponsors',
      color: 'purple',
      destacado: false
    }
  ];

  ranking = [
    { posicion: '🥇 1.º puesto Grupo', premios:['Vale Consumision', 'Kepi oficial','Trofeo campeón'] },
    { posicion: '🥈 1.º puesto Jugador', premios:['Remera Selección Paraguaya', 'Kepi oficial', 'Trofeo campeón'] },
    { posicion: '🥉 2.º puesto', premios:['Kepi oficial', 'Vale Efectivo'] },
    { posicion: '🏅 3.º - 10.º',  premios:['Premio sorpresa de sponsors'] },
  ];
}
