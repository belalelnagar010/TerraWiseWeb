import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';

/** Glowing green dot that trails the mouse and swells over interactive targets. */
@Component({
  selector: 'app-cursor',
  standalone: true,
  template: `<div #dot class="tw-cursor"></div>`,
})
export class CursorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('dot', { static: true }) dot!: ElementRef<HTMLDivElement>;

  private x = 0; private y = 0;
  private cx = 0; private cy = 0;
  private raf = 0;

  private onMove = (e: PointerEvent) => {
    this.x = e.clientX;
    this.y = e.clientY;
    const el = e.target as HTMLElement;
    const interactive = !!el?.closest?.('button, a, input, .interactive, [role="button"]');
    this.dot.nativeElement.classList.toggle('ring', interactive);
  };
  private onDown = () => this.dot.nativeElement.style.setProperty('transform', 'translate(-50%,-50%) scale(0.8)');
  private onUp = () => this.dot.nativeElement.style.removeProperty('transform');

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove, { passive: true });
      window.addEventListener('pointerdown', this.onDown);
      window.addEventListener('pointerup', this.onUp);
      this.loop();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
  }

  private loop = () => {
    this.cx += (this.x - this.cx) * 0.25;
    this.cy += (this.y - this.cy) * 0.25;
    this.dot.nativeElement.style.left = this.cx + 'px';
    this.dot.nativeElement.style.top = this.cy + 'px';
    this.raf = requestAnimationFrame(this.loop);
  };
}
