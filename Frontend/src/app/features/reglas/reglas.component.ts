import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reglas',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './reglas.component.html',
  styleUrls: ['./reglas.component.scss']
})
export class ReglasComponent {
  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
