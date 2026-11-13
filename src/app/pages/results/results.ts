import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FieldStateService } from '../../core/field-state.service';
import { EnterDirective } from '../../shared/enter.directive';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [RouterLink, EnterDirective],
  template: `
    <div class="results-wrap">
      <div class="results-card glass" appEnter>
        <span class="orbit enter-item" aria-hidden="true">🛰️</span>
        <h1 class="gradient-text enter-item">Your planting window is being charted</h1>
        <p class="muted enter-item">
          The analysis engine has your field
          @if (field.hasField()) { at <strong>{{ field.coordLabel() }}</strong> }
          and crop profile ready. The full results dashboard — optimal window, 12-month
          calendar, irrigation plan, 45-year time machine and NASA evidence — lands here next.
        </p>
        <div class="results-actions enter-item">
          <a class="btn btn-ghost interactive" routerLink="/setup">← Adjust setup</a>
          <a class="btn interactive" routerLink="/field">New field</a>
        </div>
        <div class="muted foot enter-item">TerraWise · NASA Space Apps 2026 · results view coming soon</div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .results-wrap {
      position: absolute; inset: 0; z-index: 1;
      display: grid; place-items: center; padding: 24px; overflow-y: auto;
    }
    .results-card {
      max-width: 620px; padding: 44px 40px; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 18px;
    }
    .orbit { font-size: 54px; animation: float-o 4s ease-in-out infinite; }
    @keyframes float-o { 0%,100% { transform: translateY(0) rotate(-8deg); } 50% { transform: translateY(-14px) rotate(8deg); } }
    h1 { font-size: 30px; margin: 0; font-weight: 700; line-height: 1.2; }
    p { margin: 0; font-size: 15px; line-height: 1.6; }
    .results-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }
    .foot { font-size: 12px; letter-spacing: 0.6px; margin-top: 8px; }
  `],
})
export class ResultsComponent {
  readonly field = inject(FieldStateService);
}
