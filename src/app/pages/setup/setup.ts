import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { FieldStateService } from '../../core/field-state.service';
import { AnalysisService } from '../../core/analysis.service';
import { EnterDirective } from '../../shared/enter.directive';
import { ParallaxDirective } from '../../shared/parallax.directive';
import {
  AnalysisRequest,
  IrrigationMethod,
  PlantWeek,
  Priorities,
  SoilType,
} from '../../core/models';

interface Crop { id: string; name: string; season: string; icon: string; }
interface Option<T> { id: T; label: string; icon: string; note?: string; }

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [EnterDirective, ParallaxDirective, RouterLink],
  templateUrl: './setup.html',
  styleUrl: './setup.scss',
})
export class SetupComponent {
  readonly field = inject(FieldStateService);
  private readonly analysis = inject(AnalysisService);
  private readonly router = inject(Router);

  readonly loading = signal(false);

  readonly crops: Crop[] = [
    { id: 'wheat', name: 'Wheat', season: 'winter', icon: '🌾' },
    { id: 'maize', name: 'Maize / Corn', season: 'summer', icon: '🌽' },
    { id: 'rice', name: 'Rice', season: 'summer', icon: '🌾' },
    { id: 'barley', name: 'Barley', season: 'winter', icon: '🌿' },
    { id: 'sorghum', name: 'Sorghum', season: 'summer', icon: '🌱' },
    { id: 'cotton', name: 'Cotton', season: 'summer', icon: '☁️' },
    { id: 'lentils', name: 'Lentils', season: 'winter', icon: '🫘' },
    { id: 'favabeans', name: 'Fava Beans', season: 'winter', icon: '🌰' },
  ];

  readonly irrigationOptions: Option<IrrigationMethod>[] = [
    { id: 'rainfed', label: 'Rainfed only', icon: '🌧️' },
    { id: 'surface', label: 'Surface (canal/river)', icon: '💧' },
    { id: 'drip', label: 'Drip irrigation', icon: '🚰' },
    { id: 'well', label: 'Well / groundwater', icon: '🪣' },
  ];

  readonly soilOptions: Option<Exclude<SoilType, null>>[] = [
    { id: 'clay', label: 'Clay', icon: '🟫', note: 'heavy, slow drainage' },
    { id: 'sandy', label: 'Sandy', icon: '🟨', note: 'light, fast drainage' },
    { id: 'loam', label: 'Loam', icon: '🟤', note: 'mixed, balanced' },
    { id: 'silty', label: 'Silty', icon: '🔵', note: 'fine, moderate drainage' },
  ];

  readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  readonly weeks: { id: PlantWeek; label: string }[] = [
    { id: 'early', label: 'Early' }, { id: 'mid', label: 'Mid' }, { id: 'late', label: 'Late' },
  ];

  readonly sliderKeys: { key: keyof Priorities; label: string; icon: string }[] = [
    { key: 'waterSaving', label: 'Water saving', icon: '💧' },
    { key: 'soilHealth', label: 'Soil health', icon: '🌱' },
    { key: 'yieldStability', label: 'Yield stability', icon: '📈' },
  ];

  // ---------- selections ----------
  selectCrop(id: string): void { this.field.crop.set(id); }
  selectIrrigation(id: IrrigationMethod): void { this.field.irrigation.set(id); }
  selectSoil(id: Exclude<SoilType, null>): void {
    this.field.soilType.set(this.field.soilType() === id ? null : id);
  }
  setMonth(value: string): void { this.field.usualPlantMonth.set(value ? +value : null); }
  setWeek(id: PlantWeek): void { this.field.usualPlantWeek.set(id); }
  setPriority(key: keyof Priorities, value: string | number): void {
    this.field.priorities.set({ ...this.field.priorities(), [key]: +value });
  }

  get canSubmit(): boolean {
    return this.field.hasField() && !!this.field.crop() && !!this.field.irrigation();
  }

  // ---------- submit ----------
  findWindow(): void {
    if (!this.canSubmit || this.loading()) return;
    this.loading.set(true);

    const req: AnalysisRequest = {
      lat: this.field.lat()!,
      lon: this.field.lon()!,
      crop: this.field.crop()!,
      irrigation: this.field.irrigation()!,
      soilType: this.field.soilType(),
      usualPlantMonth: this.field.usualPlantMonth() ?? 11,
      usualPlantWeek: this.field.usualPlantWeek() ?? 'mid',
      priorities: this.field.priorities(),
      boundaryGeoJSON: this.field.boundaryGeoJSON(),
    };

    // Prepared payload — fired against mock backend (1.5s) for now.
    this.analysis.analyze(req).subscribe(() => {
      this.loading.set(false);
      this.router.navigate(['/results']);
    });
  }
}
