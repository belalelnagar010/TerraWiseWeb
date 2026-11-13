import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  OnChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { gsap } from 'gsap';
import { FarmerRow } from './agronomist.models';

export interface ReviewResult {
  note: string;
  testFirst: boolean;
}

/** Slide-in review panel (from the right) for a single farmer request. */
@Component({
  selector: 'app-review-drawer',
  standalone: true,
  template: `
    <div #backdrop class="rd-backdrop" (click)="requestClose()"></div>
    <aside #panel class="rd-panel glass">
      @if (farmer) {
        <header class="rd-head">
          <div>
            <h3>{{ farmer.name }}</h3>
            <span class="muted">{{ farmer.crop }}</span>
          </div>
          <button class="rd-x interactive" (click)="requestClose()" aria-label="Close">✕</button>
        </header>

        <div class="rd-detail">
          <div class="rd-row"><span class="muted">Suggested window</span><strong class="green">{{ farmer.window }}</strong></div>
          <div class="rd-row"><span class="muted">Their usual date</span><strong>{{ farmer.usual }}</strong></div>
          <div class="rd-row">
            <span class="muted">Status</span>
            <span class="chip" [class.amber]="farmer.status === 'late'">
              {{ farmer.status === 'late' ? 'Planting late' : 'On track' }}
            </span>
          </div>
        </div>

        <label class="rd-label">Add note for farmer</label>
        <textarea class="rd-textarea interactive" rows="4"
                  placeholder="e.g. Try the window on half the field first…"
                  [value]="note()" (input)="note.set($any($event.target).value)"></textarea>

        <label class="rd-check interactive">
          <input type="checkbox" [checked]="testFirst()" (change)="testFirst.set($any($event.target).checked)" />
          Recommend testing on part of field first
        </label>

        <div class="rd-actions">
          <button class="btn interactive" (click)="onApprove()">Approve ✓</button>
          <button class="btn btn-ghost interactive" (click)="onAdjust()">Request adjustment</button>
        </div>
      }
    </aside>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 60; pointer-events: none; }
    .rd-backdrop { position: absolute; inset: 0; background: rgba(2,5,8,0.55); backdrop-filter: blur(2px); opacity: 0; pointer-events: none; }
    .rd-panel {
      position: absolute; top: 0; right: 0; height: 100%; width: min(480px, 92vw);
      border-radius: 20px 0 0 20px; padding: 26px; overflow-y: auto; pointer-events: auto;
      transform: translateX(100%); display: flex; flex-direction: column; gap: 16px;
    }
    .rd-head { display: flex; align-items: flex-start; justify-content: space-between; }
    .rd-head h3 { font-family: var(--font-head); font-size: 22px; margin: 0; }
    .rd-head .muted { font-size: 13px; }
    .rd-x { background: rgba(73,224,123,0.08); border: 1px solid var(--border); color: var(--text); width: 32px; height: 32px; border-radius: 9px; }
    .rd-detail { display: flex; flex-direction: column; gap: 10px; padding: 14px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .rd-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
    .rd-row .green { color: var(--primary); }
    .rd-label { font-size: 13px; color: var(--text-muted); font-weight: 600; }
    .rd-textarea {
      width: 100%; background: rgba(3,10,7,0.6); border: 1px solid var(--border); border-radius: 12px;
      color: var(--text); font-family: var(--font-body); font-size: 14px; padding: 12px; resize: vertical;
    }
    .rd-textarea:focus { outline: none; border-color: var(--border-strong); box-shadow: var(--glow-soft); }
    .rd-check { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--text); }
    .rd-check input { width: 17px; height: 17px; accent-color: var(--primary); }
    .rd-actions { display: flex; gap: 10px; margin-top: auto; padding-top: 10px; }
    .rd-actions .btn { flex: 1; }
  `],
})
export class ReviewDrawerComponent implements AfterViewInit, OnChanges {
  @Input() farmer: FarmerRow | null = null;
  @Input() open = false;
  @Output() approved = new EventEmitter<ReviewResult>();
  @Output() adjustment = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel', { static: true }) panel!: ElementRef<HTMLElement>;
  @ViewChild('backdrop', { static: true }) backdrop!: ElementRef<HTMLElement>;

  readonly note = signal('');
  readonly testFirst = signal(false);
  private ready = false;

  ngAfterViewInit(): void {
    this.ready = true;
    this.render(this.open, true);
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['open'] && this.ready) this.render(this.open, false);
    if (ch['open']?.currentValue) {
      this.note.set('');
      this.testFirst.set(false);
    }
  }

  private render(open: boolean, instant: boolean): void {
    const dur = instant ? 0 : 0.42;
    gsap.to(this.panel.nativeElement, { x: open ? '0%' : '100%', duration: dur, ease: 'power3.out' });
    gsap.to(this.backdrop.nativeElement, {
      opacity: open ? 1 : 0, duration: dur,
      onComplete: () => { if (!open) this.backdrop.nativeElement.style.pointerEvents = 'none'; },
    });
    this.backdrop.nativeElement.style.pointerEvents = open ? 'auto' : 'none';
  }

  onApprove(): void {
    this.approved.emit({ note: this.note(), testFirst: this.testFirst() });
  }
  onAdjust(): void { this.adjustment.emit(); }
  requestClose(): void { this.closed.emit(); }
}
