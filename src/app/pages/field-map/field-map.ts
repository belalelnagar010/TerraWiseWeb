import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import { gsap } from 'gsap';

import { FieldStateService } from '../../core/field-state.service';
import { ParallaxDirective } from '../../shared/parallax.directive';
import { EnterDirective } from '../../shared/enter.directive';
import {
  areaHectares,
  buildGraticule,
  polygonCentroid,
  polygonFeature,
} from '../../core/geo.util';

type LayerMode = 'grid' | 'satellite' | 'night';

@Component({
  selector: 'app-field-map',
  standalone: true,
  imports: [ParallaxDirective, EnterDirective],
  templateUrl: './field-map.html',
  styleUrl: './field-map.scss',
})
export class FieldMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  readonly field = inject(FieldStateService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  map!: maplibregl.Map;
  private marker?: maplibregl.Marker;

  // UI state
  readonly searching = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly toast = signal<string | null>(null);
  readonly layerMode = signal<LayerMode>('grid');
  readonly drawing = signal(false);

  // Draw state
  private drawPoints: number[][] = [];
  private clickHandler?: (e: maplibregl.MapMouseEvent) => void;
  private dblHandler?: (e: maplibregl.MapMouseEvent) => void;
  private keyHandler?: (e: KeyboardEvent) => void;

  // ------------------------------------------------------------------
  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initMap());
  }

  ngOnDestroy(): void {
    this.detachDraw();
    this.marker?.remove();
    this.map?.remove();
  }

  // ------------------------------------------------------------------
  private initMap(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.darkStyle(),
      center: [31.2358, 30.6042], // Nile delta
      zoom: 4,
      pitch: 55,
      bearing: -15,
      attributionControl: { compact: true },
    });

    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    this.map.on('load', () => {
      // Cinematic intro: rotate + ease in.
      this.map.easeTo({ bearing: 8, zoom: 4.6, duration: 2600, easing: (t) => 1 - Math.pow(1 - t, 3) });
      this.ensureDrawSources();
      this.wirePinClicks();
    });

    this.map.on('error', (e) => console.warn('Map error:', e.error?.message ?? e));
  }

  /** Minimal dark "space ops" style: near-black ocean, dim land, green graticule. */
  private darkStyle(): maplibregl.StyleSpecification {
    return {
      version: 8,
      sources: {
        carto: {
          type: 'raster',
          // ESRI Dark Gray Canvas — free, no API key, near-black ocean + dim land.
          tiles: [
            'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 16,
          attribution: 'Tiles © Esri — Esri, DeLorme, HERE',
        },
        satellite: {
          type: 'raster',
          tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
          tileSize: 256,
          attribution: 'Sentinel-2 cloudless © EOX',
        },
        night: {
          type: 'raster',
          tiles: [
            'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
          ],
          tileSize: 256,
          maxzoom: 8,
          attribution: 'NASA GIBS · VIIRS City Lights',
        },
        graticule: { type: 'geojson', data: buildGraticule(10) },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#03060A' } },
        { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.9, 'raster-saturation': -0.3, 'raster-contrast': 0.05 } },
        { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.92 } },
        { id: 'night', type: 'raster', source: 'night', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.95 } },
        {
          id: 'graticule',
          type: 'line',
          source: 'graticule',
          paint: { 'line-color': '#49E07B', 'line-opacity': 0.13, 'line-width': 1 },
        },
      ],
    };
  }

  private ensureDrawSources(): void {
    if (!this.map.getSource('field-boundary')) {
      this.map.addSource('field-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'field-boundary-fill', type: 'fill', source: 'field-boundary',
        paint: { 'fill-color': '#49E07B', 'fill-opacity': 0.14 },
      });
      this.map.addLayer({
        id: 'field-boundary-line', type: 'line', source: 'field-boundary',
        paint: { 'line-color': '#49E07B', 'line-width': 2.2, 'line-opacity': 0.9 },
      });
    }
    if (!this.map.getSource('draw-progress')) {
      this.map.addSource('draw-progress', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: 'draw-progress-line', type: 'line', source: 'draw-progress',
        paint: { 'line-color': '#F2B347', 'line-width': 2, 'line-dasharray': [2, 1.5], 'line-opacity': 0.95 },
      });
      this.map.addLayer({
        id: 'draw-progress-pts', type: 'circle', source: 'draw-progress',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#F2B347', 'circle-stroke-color': '#03060A', 'circle-stroke-width': 2 },
      });
    }
  }

  // ---------------- Pin mode ----------------
  private wirePinClicks(): void {
    this.map.on('click', (e) => {
      if (this.drawing()) return;
      this.dropPin(e.lngLat.lng, e.lngLat.lat, true);
    });
  }

  /** Drop a fresh pin (pin mode): clears any drawn boundary, then places the marker. */
  private dropPin(lon: number, lat: number, animate: boolean): void {
    this.zone.run(() => {
      this.field.clearBoundary();
      this.clearBoundaryLayer();
      this.field.setPin(lat, lon);
    });
    this.placeMarker(lon, lat, animate);
  }

  /** Create/move the marker element only — does not touch field state. */
  private placeMarker(lon: number, lat: number, animate: boolean): void {
    if (!this.marker) {
      const el = document.createElement('div');
      el.className = 'tw-pin';
      el.innerHTML = '<span class="tw-pin-ring"></span><span class="tw-pin-core"></span>';
      this.marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lon, lat])
        .addTo(this.map);
    } else {
      this.marker.setLngLat([lon, lat]);
    }
    if (animate) {
      const core = this.marker.getElement().querySelector('.tw-pin-core') as HTMLElement;
      gsap.fromTo(core, { scale: 0, y: -14 }, { scale: 1, y: 0, duration: 0.6, ease: 'bounce.out' });
    }
  }

  setMode(mode: 'pin' | 'draw'): void {
    this.field.selectionMode.set(mode);
    if (mode === 'draw') this.startDraw();
    else this.cancelDraw();
  }

  // ---------------- Draw mode ----------------
  startDraw(): void {
    if (this.drawing()) return;
    this.ensureDrawSources(); // defensive: sources exist even if 'load' timing was missed
    this.drawing.set(true);
    this.field.selectionMode.set('draw');
    this.drawPoints = [];
    this.updateProgress();
    this.showToast('Click to add corners · double-click to finish · Esc to cancel');
    this.map.doubleClickZoom.disable();
    this.map.getCanvas().style.cursor = 'crosshair';

    this.clickHandler = (e) => {
      this.drawPoints.push([e.lngLat.lng, e.lngLat.lat]);
      this.updateProgress();
    };
    this.dblHandler = () => this.finishDraw();
    this.keyHandler = (ev) => {
      if (ev.key === 'Escape') this.cancelDraw();
      if (ev.key === 'Enter') this.finishDraw();
    };
    this.map.on('click', this.clickHandler);
    this.map.on('dblclick', this.dblHandler);
    window.addEventListener('keydown', this.keyHandler);
  }

  private updateProgress(): void {
    const src = this.map.getSource('draw-progress') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const features: any[] = this.drawPoints.map((p) => ({
      type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p },
    }));
    if (this.drawPoints.length >= 2) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: this.drawPoints } });
    }
    src.setData({ type: 'FeatureCollection', features });
  }

  private finishDraw(): void {
    if (this.drawPoints.length < 3) {
      this.showToast('Add at least 3 corners to close a field');
      return;
    }
    const ring = [...this.drawPoints, this.drawPoints[0]];
    const ha = areaHectares(ring);
    const [clon, clat] = polygonCentroid(this.drawPoints);
    const feature = polygonFeature(ring);

    const src = this.map.getSource('field-boundary') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData({ type: 'FeatureCollection', features: [feature] });

    this.zone.run(() => {
      this.field.setPin(clat, clon);
      this.field.setBoundary(feature, ha);
    });
    this.placeMarker(clon, clat, true);
    this.showToast(`Field boundary set · ${ha.toFixed(1)} ha`, 2600);
    this.cancelDraw();
  }

  cancelDraw(): void {
    this.detachDraw();
    this.drawing.set(false);
    this.field.selectionMode.set('pin');
    const src = this.map?.getSource('draw-progress') as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: [] });
    this.drawPoints = [];
    if (this.map) {
      this.map.doubleClickZoom.enable();
      this.map.getCanvas().style.cursor = '';
    }
  }

  private detachDraw(): void {
    if (this.clickHandler) this.map?.off('click', this.clickHandler);
    if (this.dblHandler) this.map?.off('dblclick', this.dblHandler);
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.clickHandler = this.dblHandler = undefined;
    this.keyHandler = undefined;
  }

  private clearBoundaryLayer(): void {
    const src = this.map?.getSource('field-boundary') as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: [] });
  }

  // ---------------- Layer toggle ----------------
  toggleLayer(): void {
    const order: LayerMode[] = ['grid', 'satellite', 'night'];
    const next = order[(order.indexOf(this.layerMode()) + 1) % order.length];
    this.layerMode.set(next);
    this.map.setLayoutProperty('satellite', 'visibility', next === 'satellite' ? 'visible' : 'none');
    this.map.setLayoutProperty('night', 'visibility', next === 'night' ? 'visible' : 'none');
    this.map.setLayoutProperty('carto', 'visibility', next === 'grid' ? 'visible' : 'none');
    const label = next === 'grid' ? 'Dark grid' : next === 'satellite' ? 'Satellite (Sentinel-2)' : 'NASA night lights';
    this.showToast(label, 1600);
  }

  // ---------------- My location ----------------
  myLocation(): void {
    if (!navigator.geolocation) {
      this.showToast('Geolocation not available');
      return;
    }
    this.showToast('Locating…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        this.map.flyTo({ center: [longitude, latitude], zoom: 11, pitch: 55, duration: 2600 });
        this.dropPin(longitude, latitude, true);
        this.showToast('Located you', 1400);
      },
      () => this.showToast('Could not get your location'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  // ---------------- Search (Nominatim) ----------------
  onSearch(query: string): void {
    const q = query.trim();
    if (!q) return;
    this.searching.set(true);
    this.searchError.set(null);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((results: Array<{ lat: string; lon: string; display_name: string }>) => {
        this.zone.run(() => {
          this.searching.set(false);
          if (!results?.length) {
            this.searchError.set('No place found');
            return;
          }
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          this.map.flyTo({ center: [lon, lat], zoom: 10, pitch: 55, bearing: -8, duration: 3000 });
          this.dropPin(lon, lat, true);
        });
      })
      .catch(() => this.zone.run(() => {
        this.searching.set(false);
        this.searchError.set('Search failed — try again');
      }));
  }

  // ---------------- Nav ----------------
  computeWindow(): void {
    if (!this.field.hasField()) return;
    this.router.navigate(['/setup']);
  }

  private toastTimer?: ReturnType<typeof setTimeout>;
  private showToast(msg: string, ms = 4200): void {
    this.zone.run(() => this.toast.set(msg));
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.zone.run(() => this.toast.set(null)), ms);
  }
}
