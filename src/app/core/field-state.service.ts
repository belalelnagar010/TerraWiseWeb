import { Injectable, computed, signal } from '@angular/core';
import { Feature, FeatureCollection, Polygon } from 'geojson';
import {
  FieldState,
  IrrigationMethod,
  Priorities,
  SelectionMode,
  SoilType,
  PlantWeek,
} from './models';

/**
 * Single source of truth for the field the user is configuring.
 * Signal-based so templates stay reactive without manual change detection.
 */
@Injectable({ providedIn: 'root' })
export class FieldStateService {
  // ---- Field location ----
  readonly lat = signal<number | null>(null);
  readonly lon = signal<number | null>(null);
  readonly boundaryGeoJSON = signal<Feature<Polygon> | FeatureCollection | null>(null);
  readonly areaHectares = signal<number | null>(null);
  readonly selectionMode = signal<SelectionMode>('pin');

  // ---- Crop & field setup ----
  readonly crop = signal<string | null>(null);
  readonly irrigation = signal<IrrigationMethod | null>(null);
  readonly soilType = signal<SoilType>(null);
  readonly usualPlantMonth = signal<number | null>(null);
  readonly usualPlantWeek = signal<PlantWeek | null>(null);
  readonly priorities = signal<Priorities>({ waterSaving: 3, soilHealth: 3, yieldStability: 3 });

  // ---- Derived ----
  readonly hasField = computed(() => this.lat() !== null && this.lon() !== null);
  readonly coordLabel = computed(() => {
    const la = this.lat();
    const lo = this.lon();
    if (la === null || lo === null) return '';
    const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(4)}°`;
    return `${fmt(la)}, ${fmt(lo)}`;
  });

  readonly field = computed<FieldState>(() => ({
    lat: this.lat(),
    lon: this.lon(),
    boundaryGeoJSON: this.boundaryGeoJSON(),
    areaHectares: this.areaHectares(),
    selectionMode: this.selectionMode(),
  }));

  // ---- Mutations ----
  setPin(lat: number, lon: number): void {
    this.lat.set(lat);
    this.lon.set(lon);
  }

  setBoundary(geojson: Feature<Polygon> | FeatureCollection | null, areaHectares: number | null): void {
    this.boundaryGeoJSON.set(geojson);
    this.areaHectares.set(areaHectares);
  }

  clearBoundary(): void {
    this.boundaryGeoJSON.set(null);
    this.areaHectares.set(null);
  }

  reset(): void {
    this.lat.set(null);
    this.lon.set(null);
    this.boundaryGeoJSON.set(null);
    this.areaHectares.set(null);
    this.selectionMode.set('pin');
  }
}
