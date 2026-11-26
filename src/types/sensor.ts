export type FoodCategory =
  | 'Produce'
  | 'Bakery'
  | 'Dairy & Chilled'
  | 'Dry Goods'
  | 'Oils & Condiments'
  | 'Meat & Protein';

export type PackagingType = 'Unsealed' | 'Resealable' | 'Airtight';

export type SpoilageStatus = 'Fresh' | 'Watch' | 'High Risk' | 'Likely Expired';

export type WorkspaceTab = 'monitor' | 'inventory' | 'stream' | 'calibration' | 'plans';

export type PlanId =
  | 'free'
  | 'consumer'
  | 'small-business'
  | 'enterprise'
  | 'commercial'
  | 'warehouse';

export interface BME688Reading {
  temperatureC: number;
  humidityPct: number;
  vocPpm: number;
  pressureHpa: number;
  gasResistanceKOhm: number;
  iaqIndex: number;
  timestamp: number;
}

export interface PantryBaseline {
  temperatureC: number;
  humidityPct: number;
  vocPpm: number;
  pressureHpa: number;
  decaySensitivityGain: number;
  vocDriftOffsetPpm: number;
  calibrationAccuracyPct: number;
  calibratedAt: string | null;
  label: string;
}

export interface ProductSpecs {
  optimalTempC?: number;
  optimalRhMin?: number;
  optimalRhMax?: number;
  vocRiskNote?: string;
  source?: 'AI Lookup' | 'Manual';
}

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  packaging: PackagingType;
  nominalShelfLifeDays: number;
  storedHours: number;
  addedAt: string;
  notes?: string;
  specs?: ProductSpecs;
}

export interface CategoryProfile {
  q10: number;
  rhOptimalMin: number;
  rhOptimalMax: number;
  rhHighSensitivity: number;
  rhLowSensitivity: number;
  vocSensitivity: number;
  pressureSensitivity: number;
  defaultShelfLifeDays: number;
  description: string;
}

export interface FactorMultipliers {
  thermal: number;
  moisture: number;
  voc: number;
  pressure: number;
}

export interface SpoilageAssessment {
  expirationLikelihoodPct: number;
  effectiveDecayRate: number;
  effectiveAgeHours: number;
  remainingSafeHours: number;
  status: SpoilageStatus;
  factorMultipliers: FactorMultipliers;
  dominantDriver: 'Temperature' | 'Humidity' | 'VOC' | 'Pressure' | 'Elapsed Time';
}

export interface TrajectoryPoint {
  hour: number;
  day: number;
  currentProbPct: number;
  baselineProbPct: number;
}

export interface WeeklyDaySchedule {
  dayIndex: number;
  dayLabel: string;
  temperatureC: number;
  humidityPct: number;
  vocPpm: number;
  pressureHpa: number;
  scenarioNote: string;
}

export interface WeeklySimulationPoint {
  hour: number;
  dayLabel: string;
  temperatureC: number;
  humidityPct: number;
  vocPpm: number;
  pressureHpa: number;
  uncalibratedProbPct: number;
  calibratedProbPct: number;
}

export interface CalibrationResult {
  fittedGain: number;
  fittedVocOffsetPpm: number;
  uncalibratedEndProbPct: number;
  calibratedEndProbPct: number;
  rawErrorPct: number;
  calibratedErrorPct: number;
  accuracyPct: number;
  totalDays: number;
  totalHours: number;
  meanConditions: {
    temperatureC: number;
    humidityPct: number;
    vocPpm: number;
    pressureHpa: number;
  };
  hourlyPoints: WeeklySimulationPoint[];
}
