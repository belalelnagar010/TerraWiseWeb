import { Component, EventEmitter, Output, signal } from '@angular/core';
import { gsap } from 'gsap';
import { LogRow, Outcome } from './agronomist.models';

/** Modal to log what actually happened for a farmer after harvest. */
@Component({
  selector: 'app-season-log-modal',
  standalone: true,
  template: `
    <div class="slm-backdrop" (click)="cancel.emit()"></div>
    <div class="slm-card glass">
      <h3>Log new season</h3>

      <label class="slm-label">Farmer name</label>
      <input class="slm-input interactive" [value]="name()" (input)="name.set($any($event.target).value)"
             placeholder="e.g. Ahmed Hassan" />

      <label class="slm-label">Did they plant in the window?</label>
      <div class="slm-yn">
        <button class="interactive" [class.on]="tried()" (click)="tried.set(true)">Yes</button>
        <button class="interactive" [class.on]="!tried()" (click)="tried.set(false)">No</button>
      </div>

      <label class="slm-label">Actual outcome</label>
      <select class="slm-input interactive" [value]="outcome()" (change)="outcome.set($any($event.target).value)">
        <option value="success">Success</option>
        <option value="partial">Partial</option>
        <option value="heat-stressed">Heat stressed</option>
        <option value="frost-damage">Frost damage</option>
        <option value="other">Other</option>
      </select>

      <div class="slm-actions">
        <button class="btn btn-ghost interactive" (click)="cancel.emit()">Cancel</button>
        <button class="btn interactive" [disabled]="!name().trim()" (click)="submit()">Add to log</button>
      </div>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 20px; }
    .slm-backdrop { position: absolute; inset: 0; background: rgba(2,5,8,0.6); backdrop-filter: blur(3px); }
    .slm-card { position: relative; width: min(440px, 100%); padding: 26px; display: flex; flex-direction: column; gap: 10px; }
    h3 { font-family: var(--font-head); font-size: 20px; margin: 0 0 6px; }
    .slm-label { font-size: 12.5px; color: var(--text-muted); font-weight: 600; margin-top: 6px; }
    .slm-input {
      width: 100%; background: rgba(3,10,7,0.6); border: 1px solid var(--border); border-radius: 11px;
      color: var(--text); font-family: var(--font-body); font-size: 14px; padding: 11px 13px;
    }
    .slm-input:focus { outline: none; border-color: var(--border-strong); box-shadow: var(--glow-soft); }
    option { background: #061410; }
    .slm-yn { display: flex; gap: 8px; }
    .slm-yn button { flex: 1; padding: 10px; border-radius: 11px; background: rgba(73,224,123,0.05); border: 1px solid var(--border); color: var(--text); font-weight: 600; }
    .slm-yn button.on { background: rgba(73,224,123,0.16); border-color: var(--primary); box-shadow: var(--glow-soft); }
    .slm-actions { display: flex; gap: 10px; margin-top: 14px; }
    .slm-actions .btn { flex: 1; }
  `],
})
export class SeasonLogModalComponent {
  @Output() logged = new EventEmitter<LogRow>();
  @Output() cancel = new EventEmitter<void>();

  readonly name = signal('');
  readonly tried = signal(true);
  readonly outcome = signal<Outcome>('success');

  submit(): void {
    if (!this.name().trim()) return;
    this.logged.emit({
      farmer: this.name().trim(),
      triedWindow: this.tried(),
      outcome: this.outcome(),
      modelSaid: this.outcome(), // model prediction is backend-supplied; mirror for the demo
    });
  }
}
