import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import { gsap } from 'gsap';

import { FieldStateService } from '../../core/field-state.service';
import { buildGraticule } from '../../core/geo.util';
import { EnterDirective } from '../../shared/enter.directive';
import { ReviewDrawerComponent, ReviewResult } from './review-drawer';
import { SeasonLogModalComponent } from './season-log-modal';
import { AgronomistService } from './agronomist.service';
import {
  AreaMarker,
  FarmerRow,
  Kpis,
  LogRow,
  Rule,
  RuleType,
  RULE_ICON,
} from './agronomist.models';

const STORAGE_KEY = 'tw_agro_token';

@Component({
  selector: 'app-agronomist',
  standalone: true,
  imports: [EnterDirective, ReviewDrawerComponent, SeasonLogModalComponent],
  templateUrl: './agronomist.html',
  styleUrl: './agronomist.scss',
})
export class AgronomistComponent implements AfterViewInit, OnDestroy {
  readonly field = inject(FieldStateService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly agro = inject(AgronomistService);

  @ViewChild('areaMap') areaMapRef?: ElementRef<HTMLDivElement>;

  readonly RULE_ICON = RULE_ICON;

  // ---- gate ----
  readonly authed = signal(this.hasToken());
  readonly code = signal('');
  readonly loggingIn = signal(false);
  readonly loginError = signal<string | null>(null);

  // ---- data (loaded from the API) ----
  readonly farmers = signal<FarmerRow[]>([]);
  readonly rules = signal<Rule[]>([]);
  readonly log = signal<LogRow[]>([]);
  readonly areaMarkers = signal<AreaMarker[]>([]);
  readonly kpiData = signal<Kpis | null>(null);

  // ---- derived ----
  readonly unreviewedCount = computed(() => this.farmers().filter((f) => !f.reviewed).length);
  readonly rulesActive = computed(() => this.rules().filter((r) => r.active).length);
  readonly lateAlertCount = computed(() => this.areaMarkers().filter((m) => m.status === 'late').length);
  readonly kpis = computed(() => {
    const k = this.kpiData();
    return [
      { label: 'Awaiting review', value: this.unreviewedCount(), amber: false },
      { label: 'Farmers in area', value: k?.farmersInArea ?? this.areaMarkers().length, amber: false },
      { label: 'Planting late vs window', value: k?.plantingLateVsWindow ?? this.lateAlertCount(), amber: true },
      { label: 'Local rules active', value: this.rulesActive(), amber: false },
    ];
  });

  // ---- review drawer ----
  readonly activeFarmer = signal<FarmerRow | null>(null);
  readonly drawerOpen = signal(false);

  // ---- add-rule form ----
  readonly newRuleText = signal('');
  readonly newRuleType = signal<RuleType>('soil');

  // ---- season log modal ----
  readonly logModalOpen = signal(false);

  // ---- map ----
  private map?: maplibregl.Map;
  private markers: maplibregl.Marker[] = [];
  private mapLoaded = false;

  // ------------------------------------------------------------------
  ngAfterViewInit(): void {
    if (this.authed()) this.afterAuth();
  }

  ngOnDestroy(): void {
    this.markers.forEach((m) => m.remove());
    this.map?.remove();
  }

  // ---- gate ----
  submitCode(): void {
    const c = this.code().trim();
    if (!c || this.loggingIn()) return;
    this.loggingIn.set(true);
    this.loginError.set(null);
    this.agro.login(c).subscribe({
      next: (res) => {
        try { sessionStorage.setItem(STORAGE_KEY, res.token); } catch { /* ignore */ }
        this.loggingIn.set(false);
        this.authed.set(true);
        this.afterAuth();
      },
      error: () => {
        this.loggingIn.set(false);
        this.loginError.set('Could not sign in — check the backend is running.');
      },
    });
  }

  private hasToken(): boolean {
    try { return !!sessionStorage.getItem(STORAGE_KEY); } catch { return false; }
  }

  private afterAuth(): void {
    this.loadDashboard();
    setTimeout(() => this.zone.runOutsideAngular(() => this.initMap()), 50);
  }

  private loadDashboard(): void {
    this.agro.kpis().subscribe({ next: (k) => this.kpiData.set(k), error: () => {} });
    this.agro.requests().subscribe({ next: (r) => this.farmers.set(r), error: () => {} });
    this.agro.rules().subscribe({ next: (r) => this.rules.set(r), error: () => {} });
    this.agro.seasonLog().subscribe({ next: (l) => this.log.set(l), error: () => {} });
    const lat = this.field.lat() ?? 30.6042;
    const lon = this.field.lon() ?? 31.2358;
    this.agro.area(lat, lon, 25).subscribe({
      next: (m) => { this.areaMarkers.set(m); this.plotMarkers(); },
      error: () => {},
    });
  }

  // ---- review ----
  openReview(f: FarmerRow): void {
    this.activeFarmer.set(f);
    this.drawerOpen.set(true);
  }
  closeReview(): void { this.drawerOpen.set(false); }

  approveFarmer(r: ReviewResult): void { this.submitReview('approve', r); }
  requestAdjustment(r: ReviewResult): void { this.submitReview('adjust', r); }

  private submitReview(decision: 'approve' | 'adjust', r: ReviewResult): void {
    const target = this.activeFarmer();
    if (!target) { this.drawerOpen.set(false); return; }
    this.agro.review(target.id, { decision, note: r.note, testFirst: r.testFirst }).subscribe({
      next: () => {
        if (decision === 'approve') {
          this.farmers.update((list) => list.map((f) => (f === target ? { ...f, reviewed: true } : f)));
        }
        this.drawerOpen.set(false);
      },
      error: () => this.drawerOpen.set(false),
    });
  }

  // ---- rules ----
  toggleRule(rule: Rule): void {
    const next = !rule.active;
    const apply = () => this.rules.update((list) => list.map((r) => (r === rule ? { ...r, active: next } : r)));
    if (rule.id) this.agro.patchRule(rule.id, next).subscribe({ next: apply, error: () => {} });
    else apply();
  }
  deleteRule(rule: Rule): void {
    const apply = () => this.rules.update((list) => list.filter((r) => r !== rule));
    if (rule.id) this.agro.deleteRule(rule.id).subscribe({ next: apply, error: () => {} });
    else apply();
  }
  addRule(): void {
    const text = this.newRuleText().trim();
    if (!text) return;
    this.agro.addRule(text, this.newRuleType()).subscribe({
      next: (rule) => {
        this.rules.update((list) => [...list, rule]);
        this.newRuleText.set('');
        this.animateLastRule();
      },
      error: () => {},
    });
  }
  private animateLastRule(): void {
    queueMicrotask(() => {
      const rows = document.querySelectorAll('.rule-row');
      const last = rows[rows.length - 1] as HTMLElement | undefined;
      if (last) gsap.from(last, { x: -24, opacity: 0, duration: 0.45, ease: 'power3.out' });
    });
  }

  // ---- season log ----
  addLog(row: LogRow): void {
    this.agro.addLog({ farmer: row.farmer, triedWindow: row.triedWindow, outcome: row.outcome }).subscribe({
      next: (saved) => { this.log.update((list) => [...list, saved]); this.logModalOpen.set(false); },
      error: () => this.logModalOpen.set(false),
    });
  }
  agreement(row: LogRow): boolean {
    const norm = (o: string) => (o === 'success' ? 'success' : 'risk');
    return norm(row.outcome) === norm(row.modelSaid);
  }

  toFarmerView(): void { this.router.navigate(['/results']); }

  // ---- map ----
  private initMap(): void {
    if (this.map || !this.areaMapRef) return;
    const lat = this.field.lat() ?? 30.6042;
    const lon = this.field.lon() ?? 31.2358;

    this.map = new maplibregl.Map({
      container: this.areaMapRef.nativeElement,
      style: {
        version: 8,
        sources: {
          base: {
            type: 'raster',
            tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Tiles © Esri',
          },
          graticule: { type: 'geojson', data: buildGraticule(1) },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#03060A' } },
          { id: 'base', type: 'raster', source: 'base', paint: { 'raster-opacity': 0.9, 'raster-saturation': -0.3 } },
          { id: 'grat', type: 'line', source: 'graticule', paint: { 'line-color': '#49E07B', 'line-opacity': 0.12, 'line-width': 1 } },
        ],
      },
      center: [lon, lat],
      zoom: 10,
      pitch: 35,
    });

    this.map.on('load', () => { this.mapLoaded = true; this.plotMarkers(); });
    this.map.on('error', (e) => console.warn('Area map:', e.error?.message ?? e));
  }

  /** Render the current area markers on the map (idempotent). */
  private plotMarkers(): void {
    if (!this.map || !this.mapLoaded) return;
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    const color = { ok: '#49E07B', near: '#F2B347', late: '#E05449' } as const;
    for (const m of this.areaMarkers()) {
      const el = document.createElement('div');
      el.className = 'area-marker';
      el.style.background = color[m.status];
      el.style.boxShadow = `0 0 12px ${color[m.status]}`;
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
        `<div class="area-popup"><strong>${m.name}</strong><br>${
          m.status === 'ok' ? 'Within window' : m.status === 'near' ? 'Near boundary' : 'Planting late'
        }</div>`,
      );
      this.markers.push(new maplibregl.Marker({ element: el }).setLngLat([m.lon, m.lat]).setPopup(popup).addTo(this.map!));
    }
  }
}
