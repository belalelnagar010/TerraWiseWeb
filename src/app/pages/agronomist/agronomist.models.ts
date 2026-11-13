export interface FarmerRow {
  id: string;
  name: string;
  crop: string;
  window: string;
  usual: string;
  status: 'ok' | 'late';
  reviewed: boolean;
}

export type RuleType = 'soil' | 'variety' | 'market' | 'pest' | 'irrigation';
export interface Rule {
  id?: string;
  text: string;
  type: RuleType;
  active: boolean;
}

export interface Kpis {
  awaitingReview: number;
  farmersInArea: number;
  plantingLateVsWindow: number;
  localRulesActive: number;
}

export interface AreaMarker {
  name: string;
  lat: number;
  lon: number;
  status: 'ok' | 'near' | 'late';
}

export interface Agronomist {
  id: string;
  name: string;
  area: string;
}

export type Outcome = 'success' | 'partial' | 'heat-stressed' | 'frost-damage' | 'at-risk' | 'other';
export interface LogRow {
  farmer: string;
  triedWindow: boolean;
  outcome: Outcome;
  modelSaid: Outcome;
}

export const RULE_ICON: Record<RuleType, string> = {
  soil: '🟤',
  variety: '🌱',
  market: '📈',
  pest: '🐛',
  irrigation: '💧',
};
