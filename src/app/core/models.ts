import { Feature, Polygon, FeatureCollection } from 'geojson';

export type SelectionMode = 'pin' | 'draw';

export interface FieldState {
  lat: number | null;
  lon: number | null;
  boundaryGeoJSON: Feature<Polygon> | FeatureCollection | null;
  areaHectares: number | null;
  selectionMode: SelectionMode;
}

export type IrrigationMethod = 'rainfed' | 'surface' | 'drip' | 'well';
export type SoilType = 'clay' | 'sandy' | 'loam' | 'silty' | null;
export type PlantWeek = 'early' | 'mid' | 'late';

export interface Priorities {
  waterSaving: number;
  soilHealth: number;
  yieldStability: number;
}

export interface AnalysisRequest {
  lat: number;
  lon: number;
  crop: string;
  irrigation: IrrigationMethod;
  soilType: SoilType;
  usualPlantMonth: number;      // 1-12
  usualPlantWeek: PlantWeek;
  priorities: Priorities;
  boundaryGeoJSON?: Feature<Polygon> | FeatureCollection | null;
}

export type CalendarStatus = 'out' | 'safe' | 'optimal' | 'flowering' | 'heat' | 'frost';
export type IrrigationNeed = 'none' | 'low' | 'high';
export type Confidence = 'high' | 'medium' | 'low';

export interface GddPoint { month: number; cumulative: number; }
export interface GddStage { label: string; month: number; }
export interface Gdd {
  unit: string;
  base: number;
  points: GddPoint[];   // cumulative GDD, ordered Oct→Sep (12 points)
  stages: GddStage[];   // vertical stage markers
}

export interface AnalysisResponse {
  window: {
    start: string;        // ISO date
    end: string;
    usualStart: string;
    shiftDays: number;
  };
  calendar: Array<{ month: number; status: CalendarStatus }>;
  irrigation: Array<{ month: number; need: IrrigationNeed }>;
  timeMachine: Array<{ year: number; windowStartDay: number }>;
  evidence: { why: string; nasaSource: string; confidence: Confidence };
  gdd?: Gdd;            // present when the backend supplies the GDD chart
}
