import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterRequest, LoginRequest } from '../../../core/models/auth.models';
import { environment } from '../../../../environments/environment';
import * as THREE from 'three';

declare const google: any;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('threeCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  mode: 'register' | 'login' | 'forgot' = 'register';
  showAuthPanel = false;

  registerForm!: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;
  loading = false;
  errorMessage = '';

  loginForm!: FormGroup;
  hideLoginPassword = true;
  loadingLogin = false;
  errorLogin = '';

  // Forgot password
  forgotEmail = '';
  loadingForgot = false;
  forgotMessage = '';
  forgotError = '';

  loadingGoogle = false;

  readonly allPhotos = [
    'images/1000620828.jpg',
    'images/1000620829.jpg',
    'images/1000620830.jpg',
    'images/1000620831.jpg',
    'images/1000620832.jpg',
    'images/1000620833.jpg',
    'images/1000620834.jpg',
  ];
  heroPhotos: string[] = [];
  heroPhotosVisible = true;
  private heroSlideshowTimer: any;

  private shuffleHeroPhotos(): void {
    const shuffled = [...this.allPhotos].sort(() => Math.random() - 0.5);
    this.heroPhotos = shuffled.slice(0, 4);
  }
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private particles!: THREE.Points;
  private animationId: number = 0;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initThreeJS();
      this.animate();
      this.initGoogleSignIn();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.renderer) this.renderer.dispose();
    if (this.heroSlideshowTimer) clearInterval(this.heroSlideshowTimer);
  }

  private initThreeJS(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 50;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.createParticles();
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0x00d4ff, 0.8);
    directionalLight.position.set(10, 10, 5);
    this.scene.add(directionalLight);
    const pointLight1 = new THREE.PointLight(0x00d4ff, 1.2, 120);
    pointLight1.position.set(-30, 25, 15);
    this.scene.add(pointLight1);
    const pointLight2 = new THREE.PointLight(0x0891b2, 1.2, 120);
    pointLight2.position.set(30, -25, 15);
    this.scene.add(pointLight2);
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private createParticles(): void {
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 3000;
    const posArray = new Float32Array(particlesCount * 3);
    const colorsArray = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 200;
      posArray[i + 1] = (Math.random() - 0.5) * 200;
      posArray[i + 2] = (Math.random() - 0.5) * 200;
      const color = new THREE.Color();
      const hue = Math.random();
      if (hue < 0.3) color.setHSL(0.52 + Math.random() * 0.06, 0.9, 0.55);
      else if (hue < 0.6) color.setHSL(0.46 + Math.random() * 0.06, 0.85, 0.5);
      else color.setHSL(0.58 + Math.random() * 0.06, 0.8, 0.5);
      colorsArray[i] = color.r; colorsArray[i + 1] = color.g; colorsArray[i + 2] = color.b;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.5, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false
    });
    this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
    this.scene.add(this.particles);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    if (this.particles) { this.particles.rotation.x += 0.0003; this.particles.rotation.y += 0.0005; }
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  };

  private onWindowResize(): void {
    if (!this.canvasRef) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  ngOnInit(): void {
    this.shuffleHeroPhotos();
    this.heroSlideshowTimer = setInterval(() => {
      this.heroPhotosVisible = false;
      setTimeout(() => {
        this.shuffleHeroPhotos();
        this.heroPhotosVisible = true;
      }, 400);
    }, 5000);

    this.registerForm = this.fb.group({
      user:     ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      email:    ['', [Validators.required, Validators.email]],
      nombre:   [''],
      apellido: [''],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required]],
      password:   ['', [Validators.required]]
    });

    this.route.queryParamMap.subscribe(params => {
      const m = params.get('mode');
      if (m === 'login') this.mode = 'login';
      else if (m === 'forgot') this.mode = 'forgot';
      else this.mode = 'register';
      
      // Abrir panel si viene con mode en la URL
      if (m === 'login' || m === 'register' || m === 'forgot') {
        this.showAuthPanel = true;
      }

      // Mostrar mensaje de timeout si vienen redirigidos por inactividad
      const reason = params.get('reason');
      const message = params.get('message');
      if (reason === 'timeout') {
        this.errorLogin = message || 'Tu sesión expiró por inactividad (2 minutos sin actividad)';
        this.mode = 'login';
        this.showAuthPanel = true;
      }
    });
  }

  setMode(m: 'register' | 'login' | 'forgot'): void {
    this.mode = m;
    this.errorMessage = '';
    this.errorLogin = '';
    this.forgotMessage = '';
    this.forgotError = '';
    // Preservar returnUrl al cambiar de tab para que el redirect post-login siga funcionando
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const queryParams: Record<string, string> = {};
    if (m === 'login') queryParams['mode'] = 'login';
    if (m === 'forgot') queryParams['mode'] = 'forgot';
    if (returnUrl) queryParams['returnUrl'] = returnUrl;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true
    });
    // Re-render Google buttons after Angular renders the new tab
    if (m !== 'forgot') setTimeout(() => this.initGoogleSignIn(), 50);
  }

  toggleAuth(): void {
    this.showAuthPanel = !this.showAuthPanel;
  }

  openAuth(m: 'register' | 'login'): void {
    this.mode = m;
    this.showAuthPanel = true;
    this.errorMessage = '';
    this.errorLogin = '';
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone
  ) {}

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { confirmPassword, ...rest } = this.registerForm.value;
    const payload: RegisterRequest = {
      user:     rest.user,
      email:    rest.email,
      password: rest.password,
      nombre:   rest.nombre  || undefined,
      apellido: rest.apellido || undefined
    };

    this.authService.register(payload).subscribe({
      next: (response) => {
        this.loading = false;
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate([returnUrl]);
      },
      error: (error) => {
        this.loading = false;
        if (error.error?.details) {
          this.errorMessage = Object.values(error.error.details).join('. ');
        } else {
          this.errorMessage = error.error?.error || error.error?.message || 'Error al registrar usuario';
        }
      }
    });
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loadingLogin = true;
    this.errorLogin = '';
    const payload: LoginRequest = this.loginForm.value;
    this.authService.login(payload).subscribe({
      next: () => {
        this.loadingLogin = false;
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate([returnUrl]);
      },
      error: (err) => {
        this.loadingLogin = false;
        if (err?.status === 401) {
          this.errorLogin = 'Usuario o contraseña incorrectos.';
        } else if (err?.status === 0) {
          this.errorLogin = 'No se puede conectar al servidor.';
        } else {
          this.errorLogin = err.error?.error || err.error?.message || 'Error al iniciar sesión.';
        }
      }
    });
  }

  onForgotPassword(): void {
    if (!this.forgotEmail || !this.forgotEmail.includes('@')) {
      this.forgotError = 'Ingresá un email válido.';
      return;
    }
    this.loadingForgot = true;
    this.forgotError = '';
    this.forgotMessage = '';
    this.authService.forgotPassword(this.forgotEmail).subscribe({
      next: (res) => {
        this.loadingForgot = false;
        this.forgotMessage = res.message;
      },
      error: (err) => {
        this.loadingForgot = false;
        this.forgotError = err.error?.error || 'Error al enviar el email.';
      }
    });
  }

  // ----------------------------------------------------------------
  // Google Sign-In
  // ----------------------------------------------------------------

  private initGoogleSignIn(): void {
    if (typeof google === 'undefined') return;
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => this.handleGoogleResponse(response),
      auto_select: false,
      cancel_on_tap_outside: true
    });
    // Renderizar botón en el contenedor del registro
    const btnContainer = document.getElementById('google-btn');
    if (btnContainer) {
      google.accounts.id.renderButton(btnContainer, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320
      });
    }
    // Renderizar botón en el contenedor del login
    const btnContainerLogin = document.getElementById('google-btn-login');
    if (btnContainerLogin) {
      google.accounts.id.renderButton(btnContainerLogin, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 320
      });
    }
  }

  handleGoogleResponse(response: any): void {
    this.ngZone.run(() => {
      this.loadingGoogle = true;
      this.errorMessage = '';
      this.errorLogin = '';
      this.authService.loginWithGoogle(response.credential).subscribe({
        next: () => {
          this.loadingGoogle = false;
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.loadingGoogle = false;
          const msg = 'Error al iniciar sesión con Google.';
          if (this.mode === 'login') {
            this.errorLogin = msg;
          } else {
            this.errorMessage = msg;
          }
        }
      });
    });
  }

  getErrorMessage(field: string): string {
    const control = this.registerForm.get(field);
    
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('email')) {
      return 'Email inválido';
    }
    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    if (control?.hasError('pattern')) {
      return 'Debe contener al menos una mayúscula, una minúscula y un número';
    }
    if (control?.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden';
    }
    
    return '';
  }
}
