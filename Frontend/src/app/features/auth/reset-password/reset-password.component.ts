import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {

  form!: FormGroup;
  token = '';
  hidePassword = true;
  hideConfirm = true;
  loading = false;
  error = '';
  success = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.error = 'Enlace inválido. No se encontró el token.';
    }

    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const pw = form.get('password');
    const cp = form.get('confirmPassword');
    if (pw && cp && pw.value !== cp.value) {
      cp.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(k => this.form.get(k)?.markAsTouched());
      return;
    }
    this.loading = true;
    this.error = '';
    this.authService.resetPassword(this.token, this.form.value.password).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Error al restablecer la contraseña.';
      }
    });
  }

  getErrorMessage(field: string): string {
    const c = this.form.get(field);
    if (c?.hasError('required')) return 'Este campo es requerido';
    if (c?.hasError('minlength')) return 'Mínimo 8 caracteres';
    if (c?.hasError('pattern')) return 'Debe contener mayúscula, minúscula y número';
    if (c?.hasError('passwordMismatch')) return 'Las contraseñas no coinciden';
    return '';
  }
}
