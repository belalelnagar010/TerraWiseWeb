import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';

/**
 * Shifts the host element a few pixels against mouse movement so floating
 * HUD panels feel like they hover over the 3D scene. Usage:
 *   <div appParallax [parallaxStrength]="4"> … </div>
 */
@Directive({ selector: '[appParallax]', standalone: true })
export class ParallaxDirective implements AfterViewInit, OnDestroy {
  @Input('parallaxStrength') strength = 4;

  private tx = 0; private ty = 0;
  private cx = 0; private cy = 0;
  private raf = 0;

  private onMove = (e: PointerEvent) => {
    this.tx = ((e.clientX / window.innerWidth) * 2 - 1) * this.strength;
    this.ty = ((e.clientY / window.innerHeight) * 2 - 1) * this.strength;
  };

  constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove, { passive: true });
      this.loop();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
  }

  private loop = () => {
    this.cx += (this.tx - this.cx) * 0.08;
    this.cy += (this.ty - this.cy) * 0.08;
    this.el.nativeElement.style.transform = `translate3d(${this.cx}px, ${this.cy}px, 0)`;
    this.raf = requestAnimationFrame(this.loop);
  };
}
