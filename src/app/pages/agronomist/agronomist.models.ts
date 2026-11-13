export interface FarmerRow {
  name: string;
  crop: string;
  window: string;
  usual: string;
  status: 'ok' | 'late';
  reviewed: boolean;
}

export type RuleType = 'soil' | 'variety' | 'market' | 'pest' | 'irrigation';
export interface Rule {
  text: string;
  type: RuleType;
  active: boolean;
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
