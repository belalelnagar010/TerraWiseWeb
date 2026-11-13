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
import { FarmerRow, LogRow, Rule, RuleType, RULE_ICON } from './agronomist.models';

interface AreaMarker { lng: number; lat: number; name: string; status: 'ok' | 'near' | 'late'; }

const STORAGE_KEY = 'tw_agro_code';

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

  @ViewChild('areaMap') areaMapRef?: ElementRef<HTMLDivElement>;

  readonly RULE_ICON = RULE_ICON;

  // ---- gate ----
  readonly authed = signal(this.readStoredCode());
  readonly code = signal('');

  // ---- data ----
  readonly farmers = signal<FarmerRow[]>([
    { name: 'Ahmed Hassan', crop: 'Wheat', window: 'Nov 16–29', usual: 'Dec 1', status: 'late', reviewed: false },
    { name: 'Sara Mohamed', crop: 'Beans', window: 'Nov 5–18', usual: 'Nov 10', status: 'ok', reviewed: false },
    { name: 'Khaled Ali', crop: 'Barley', window: 'Nov 20–Dec 3', usual: 'Dec 15', status: 'late', reviewed: false },
    { name: 'Fatma Ibrahim', crop: 'Wheat', window: 'Nov 16–29', usual: 'Nov 18', status: 'ok', reviewed: true },
    { name: 'Youssef Omar', crop: 'Maize', window: 'Apr 10–23', usual: 'Apr 5', status: 'ok', reviewed: false },
  ]);

  readonly rules = signal<Rule[]>([
    { text: 'Slow-draining soil in this area — delay planting start by 5 days', type: 'soil', active: true },
    { text: 'Local wheat variety matures 8 days faster than standard tables', type: 'variety', active: true },
    { text: 'Fall armyworm pressure peaks late October — plant after Oct 28', type: 'pest', active: false },
  ]);

  readonly log = signal<LogRow[]>([
    { farmer: 'Ahmed Hassan', triedWindow: true, outcome: 'success', modelSaid: 'success' },
    { farmer: 'Sara Mohamed', triedWindow: false, outcome: 'heat-stressed', modelSaid: 'at-risk' },
    { farmer: 'Khaled Ali', triedWindow: true, outcome: 'success', modelSaid: 'success' },
  ]);

  // ---- derived ----
  readonly unreviewedCount = computed(() => this.farmers().filter((f) => !f.reviewed).length);
  readonly rulesActive = computed(() => this.rules().filter((r) => r.active).length);
  readonly kpis = computed(() => [
    { label: 'Awaiting review', value: this.unreviewedCount(), amber: false },
    { label: 'Farmers in area', value: 86, amber: false },
    { label: 'Planting late vs window', value: this.farmers().filter((f) => f.status === 'late').length + 7, amber: true },
    { label: 'Local rules active', value: this.rulesActive(), amber: false },
  ]);

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
  readonly areaMarkers = signal<AreaMarker[]>([]);
  readonly lateAlertCount = computed(() => this.areaMarkers().filter((m) => m.status === 'late').length);

  // ------------------------------------------------------------------
  ngAfterViewInit(): void {
    if (this.authed()) this.scheduleMap();
  }

  ngOnDestroy(): void {
    this.markers.forEach((m) => m.remove());
    this.map?.remove();
  }

  // ---- gate ----
  submitCode(): void {
    const c = this.code().trim();
    if (!c) return;
    try { sessionStorage.setItem(STORAGE_KEY, c); } catch { /* ignore */ }
    this.authed.set(true);
    this.scheduleMap();
  }

  private readStoredCode(): boolean {
    try { return !!sessionStorage.getItem(STORAGE_KEY); } catch { return false; }
  }

  // ---- review ----
  openReview(f: FarmerRow): void {
    this.activeFarmer.set(f);
    this.drawerOpen.set(true);
  }
  closeReview(): void { this.drawerOpen.set(false); }
  approveFarmer(_r: ReviewResult): void {
    const target = this.activeFarmer();
    if (target) {
      this.farmers.update((list) => list.map((f) => (f === target ? { ...f, reviewed: true } : f)));
    }
    this.drawerOpen.set(false);
  }
  requestAdjustment(): void { this.drawerOpen.set(false); }

  // ---- rules ----
  toggleRule(rule: Rule): void {
    this.rules.update((list) => list.map((r) => (r === rule ? { ...r, active: !r.active } : r)));
  }
  deleteRule(rule: Rule): void {
    this.rules.update((list) => list.filter((r) => r !== rule));
  }
  addRule(): void {
    const text = this.newRuleText().trim();
    if (!text) return;
    this.rules.update((list) => [...list, { text, type: this.newRuleType(), active: true }]);
    this.newRuleText.set('');
    // Slide-in the newest row.
    queueMicrotask(() => {
      const rows = document.querySelectorAll('.rule-row');
      const last = rows[rows.length - 1] as HTMLElement | undefined;
      if (last) gsap.from(last, { x: -24, opacity: 0, duration: 0.45, ease: 'power3.out' });
    });
  }

  // ---- season log ----
  addLog(row: LogRow): void {
    this.log.update((list) => [...list, row]);
    this.logModalOpen.set(false);
  }
  agreement(row: LogRow): boolean {
    const normalize = (o: string) => (o === 'success' ? 'success' : 'risk');
    return normalize(row.outcome) === normalize(row.modelSaid);
  }

  toFarmerView(): void { this.router.navigate(['/results']); }

  // ---- map ----
  private scheduleMap(): void {
    // Wait for the dashboard DOM (and the map container) to render.
    setTimeout(() => this.zone.runOutsideAngular(() => this.initMap()), 50);
  }

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

    const statuses: AreaMarker['status'][] = ['ok', 'ok', 'ok', 'near', 'near', 'late', 'ok', 'late', 'ok'];
    const names = ['Ahmed', 'Sara', 'Khaled', 'Fatma', 'Youssef', 'Mona', 'Tarek', 'Hoda', 'Nabil'];
    const generated: AreaMarker[] = statuses.map((status, i) => ({
      lng: lon + (Math.random() - 0.5) * 0.36,
      lat: lat + (Math.random() - 0.5) * 0.36,
      name: names[i],
      status,
    }));
    this.zone.run(() => this.areaMarkers.set(generated));

    this.map.on('load', () => {
      const color = { ok: '#49E07B', near: '#F2B347', late: '#E05449' };
      for (const m of generated) {
        const el = document.createElement('div');
        el.className = 'area-marker';
        el.style.background = color[m.status];
        el.style.boxShadow = `0 0 12px ${color[m.status]}`;
        const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
          `<div class="area-popup"><strong>${m.name}</strong><br>${
            m.status === 'ok' ? 'Within window' : m.status === 'near' ? 'Near boundary' : 'Planting late'
          }</div>`,
        );
        this.markers.push(new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).setPopup(popup).addTo(this.map!));
      }
    });
    this.map.on('error', (e) => console.warn('Area map:', e.error?.message ?? e));
  }
}
