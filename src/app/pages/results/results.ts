import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { gsap } from 'gsap';

import { FieldStateService } from '../../core/field-state.service';
import { AnalysisService } from '../../core/analysis.service';
import { EnterDirective } from '../../shared/enter.directive';
import { ParallaxDirective } from '../../shared/parallax.directive';
import { WindowDayToDatePipe } from '../../core/window-day-to-date.pipe';
import { AnalysisResponse, CalendarStatus, IrrigationNeed } from '../../core/models';

type ViewMode = 'farmer' | 'agronomist';

interface CalCell {
  label: string;
  month: number;
  status: CalendarStatus;
  color: string;
  tall: boolean;
}
interface IrrCell {
  label: string;
  month: number;
  need: IrrigationNeed;
  color: string;
}

const DISPLAY_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const DISPLAY_LABELS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

const STATUS_COLOR: Record<CalendarStatus, string> = {
  out: 'rgba(255,255,255,0.06)',
  safe: '#2D6B44',
  optimal: '#49E07B',
  flowering: '#8FD6A6',
  heat: '#F2B347',
  frost: '#8FB8E8',
};
const NEED_COLOR: Record<IrrigationNeed, string> = {
  none: 'rgba(255,255,255,0.06)',
  low: 'rgba(127,176,212,0.3)',
  high: '#7FB0D4',
};

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [RouterLink, EnterDirective, ParallaxDirective, WindowDayToDatePipe],
  templateUrl: './results.html',
  styleUrl: './results.scss',
})
export class ResultsComponent implements OnInit {
  readonly field = inject(FieldStateService);
  private readonly analysis = inject(AnalysisService);
  private readonly router = inject(Router);

  readonly view = signal<ViewMode>('farmer');
  readonly result = signal<AnalysisResponse | null>(this.analysis.lastResult());
  readonly loading = signal(false);

  // Time machine
  readonly sliderYear = signal(2026);

  // ---- lifecycle ----
  ngOnInit(): void {
    if (!this.result()) {
      // Direct navigation / refresh: recompute from the stored field.
      this.loading.set(true);
      this.analysis
        .analyze({
          lat: this.field.lat() ?? 0,
          lon: this.field.lon() ?? 0,
          crop: this.field.crop() ?? 'wheat',
          irrigation: this.field.irrigation() ?? 'surface',
          soilType: this.field.soilType(),
          usualPlantMonth: this.field.usualPlantMonth() ?? 12,
          usualPlantWeek: this.field.usualPlantWeek() ?? 'mid',
          priorities: this.field.priorities(),
          boundaryGeoJSON: this.field.boundaryGeoJSON(),
        })
        .subscribe((r) => {
          this.result.set(r);
          this.loading.set(false);
        });
    }
  }

  // ---- derived display ----
  readonly cropLabel = computed(() => {
    const c = this.field.crop();
    if (!c) return 'your crop';
    return c.charAt(0).toUpperCase() + c.slice(1).replace('favabeans', 'Fava Beans');
  });

  readonly headlineRange = computed(() => {
    const w = this.result()?.window;
    if (!w) return '';
    return `${this.short(w.start)} – ${this.short(w.end)}`;
  });

  readonly calendar = computed<CalCell[]>(() => {
    const r = this.result();
    if (!r) return [];
    return DISPLAY_MONTHS.map((m, i) => {
      const c = r.calendar.find((x) => x.month === m);
      const status = (c?.status ?? 'out') as CalendarStatus;
      return { label: DISPLAY_LABELS[i], month: m, status, color: STATUS_COLOR[status], tall: status === 'optimal' };
    });
  });

  readonly irrigation = computed<IrrCell[]>(() => {
    const r = this.result();
    if (!r) return [];
    return DISPLAY_MONTHS.map((m, i) => {
      const c = r.irrigation.find((x) => x.month === m);
      const need = (c?.need ?? 'none') as IrrigationNeed;
      return { label: DISPLAY_LABELS[i], month: m, need, color: NEED_COLOR[need] };
    });
  });

  /** Optimal window bracket position as {left%, width%} over the 12-column bar. */
  readonly bracket = computed(() => {
    const w = this.result()?.window;
    if (!w) return { left: 0, width: 0 };
    const sM = +w.start.slice(5, 7), sD = +w.start.slice(8, 10);
    const eM = +w.end.slice(5, 7), eD = +w.end.slice(8, 10);
    const si = DISPLAY_MONTHS.indexOf(sM) + (sD - 1) / 31;
    const ei = DISPLAY_MONTHS.indexOf(eM) + eD / 31;
    return { left: (si / 12) * 100, width: Math.max(((ei - si) / 12) * 100, 5) };
  });

  /** Red "usual date" marker position as a left%. */
  readonly usualLeft = computed(() => {
    const w = this.result()?.window;
    const m = this.field.usualPlantMonth() ?? (w ? +w.usualStart.slice(5, 7) : 12);
    const idx = DISPLAY_MONTHS.indexOf(m);
    if (idx < 0) return -1;
    return ((idx + 0.5) / 12) * 100;
  });

  // ---- time machine ----
  private interp(year: number): number {
    const tm = this.result()?.timeMachine ?? [];
    if (!tm.length) return 0;
    const sorted = [...tm].sort((a, b) => a.year - b.year);
    if (year <= sorted[0].year) return sorted[0].windowStartDay;
    if (year >= sorted[sorted.length - 1].year) return sorted[sorted.length - 1].windowStartDay;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (year >= a.year && year <= b.year) {
        const t = (year - a.year) / (b.year - a.year);
        return a.windowStartDay + t * (b.windowStartDay - a.windowStartDay);
      }
    }
    return sorted[sorted.length - 1].windowStartDay;
  }

  readonly interpDay = computed(() => Math.round(this.interp(this.sliderYear())));
  readonly baseDay = computed(() => Math.round(this.interp(2001)));
  readonly drift = computed(() => this.interpDay() - this.baseDay());
  readonly driftClass = computed(() => {
    const d = this.drift();
    return d > 14 ? 'danger' : d >= 7 ? 'amber' : 'green';
  });

  onYear(value: string): void {
    this.sliderYear.set(+value);
  }

  jumpTo2050(): void {
    const proxy = { y: this.sliderYear() };
    gsap.to(proxy, {
      y: 2050,
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: () => this.sliderYear.set(Math.round(proxy.y)),
    });
  }

  // ---- GDD mini chart (agronomist) ----
  // Cumulative GDD points across Oct→Sep (shape only; backend supplies values).
  readonly gddPoints = [0, 60, 140, 210, 290, 400, 560, 760, 980, 1180, 1320, 1400];
  readonly gddPath = computed(() => {
    const max = 1400, W = 560, H = 150, pad = 4;
    return this.gddPoints
      .map((v, i) => {
        const x = pad + (i / (this.gddPoints.length - 1)) * (W - pad * 2);
        const y = H - pad - (v / max) * (H - pad * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });
  readonly gddStages = [
    { label: 'Emergence', idx: 1 },
    { label: 'Tillering', idx: 3 },
    { label: 'Flowering', idx: 6 },
    { label: 'Grain-fill', idx: 8 },
  ];
  gddX(idx: number): number {
    const W = 560, pad = 4;
    return pad + (idx / (this.gddPoints.length - 1)) * (W - pad * 2);
  }

  readonly confidenceLabel = computed(() => {
    const c = this.result()?.evidence.confidence;
    return c === 'high' ? 'High confidence' : c === 'medium' ? 'Medium confidence' : 'Low confidence — add soil data';
  });

  readonly reviewPoints = [
    'Crop variety and its maturity speed',
    "Your field's drainage characteristics",
    'Local pest pressure in your area',
  ];

  // ---- nav ----
  toAgronomist(): void {
    this.router.navigate(['/agronomist']);
  }

  // ---- helpers ----
  private short(iso: string): string {
    const d = new Date(iso + 'T00:00:00Z');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }
  readonly currentYear = new Date().getFullYear();
}
