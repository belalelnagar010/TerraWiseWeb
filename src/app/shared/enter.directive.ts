import { AfterViewInit, Directive, ElementRef, Input } from '@angular/core';
import { gsap } from 'gsap';

/**
 * GSAP entrance: fades + slides up the host's direct children (or the host
 * itself) with a stagger when the view initializes. Mark children with the
 * `.enter-item` class, or let it animate immediate element children.
 */
@Directive({ selector: '[appEnter]', standalone: true })
export class EnterDirective implements AfterViewInit {
  @Input() enterStagger = 0.08;
  @Input() enterY = 24;
  @Input() enterDelay = 0.05;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const host = this.el.nativeElement;
    const marked = host.querySelectorAll<HTMLElement>('.enter-item');
    const targets: HTMLElement[] = marked.length
      ? Array.from(marked)
      : (Array.from(host.children) as HTMLElement[]);
    if (!targets.length) return;

    gsap.set(targets, { opacity: 0, y: this.enterY });
    gsap.to(targets, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: this.enterStagger,
      delay: this.enterDelay,
    });
  }
}
