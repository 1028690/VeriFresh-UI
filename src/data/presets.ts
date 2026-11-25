import { hoursAgoToLocalTimestamp } from '../engine/spoilageModel';
import { FoodItem, PantryBaseline, WeeklyDaySchedule } from '../types/sensor';

export const STANDARD_PANTRY_BASELINE: PantryBaseline = {
  temperatureC: 20.5,
  humidityPct: 48.0,
  vocPpm: 0.35,
  pressureHpa: 1013.25,
  decaySensitivityGain: 1.0,
  vocDriftOffsetPpm: 0.0,
  calibrationAccuracyPct: 92.4,
  calibratedAt: null,
  label: 'Standard Kitchen Pantry',
};

export const DEFAULT_FOOD_ITEMS: FoodItem[] = [
  {
    id: 'item-strawberries',
    name: 'Organic Strawberries',
    category: 'Produce',
    packaging: 'Unsealed',
    nominalShelfLifeDays: 4,
    storedHours: 58,
    addedAt: hoursAgoToLocalTimestamp(58),
    notes: 'Perforated clamshell on middle rack',
  },
  {
    id: 'item-sourdough',
    name: 'Country Sourdough Boule',
    category: 'Bakery',
    packaging: 'Resealable',
    nominalShelfLifeDays: 4.5,
    storedHours: 46,
    addedAt: hoursAgoToLocalTimestamp(46),
    notes: 'Paper-lined linen bread bag',
  },
  {
    id: 'item-avocado',
    name: 'Hass Avocados (Ripe)',
    category: 'Produce',
    packaging: 'Unsealed',
    nominalShelfLifeDays: 5,
    storedHours: 74,
    addedAt: hoursAgoToLocalTimestamp(74),
    notes: 'Counter bowl near pantry airflow',
  },
  {
    id: 'item-milk',
    name: 'Whole Milk (Opened Ambient Test)',
    category: 'Dairy & Chilled',
    packaging: 'Resealable',
    nominalShelfLifeDays: 1.5,
    storedHours: 14,
    addedAt: hoursAgoToLocalTimestamp(14),
    notes: 'Left out of cold chain for sensor bench check',
  },
  {
    id: 'item-oats',
    name: 'Steel-Cut Rolled Oats',
    category: 'Dry Goods',
    packaging: 'Airtight',
    nominalShelfLifeDays: 120,
    storedHours: 640,
    addedAt: hoursAgoToLocalTimestamp(640),
    notes: 'Borosilicate glass canister with silicone gasket',
  },
  {
    id: 'item-olive-oil',
    name: 'Cold-Pressed Olive Oil',
    category: 'Oils & Condiments',
    packaging: 'Resealable',
    nominalShelfLifeDays: 75,
    storedHours: 420,
    addedAt: hoursAgoToLocalTimestamp(420),
    notes: 'Dark amber bottle, upper shelf',
  },
  {
    id: 'item-spinach',
    name: 'Baby Spinach Leaves',
    category: 'Produce',
    packaging: 'Resealable',
    nominalShelfLifeDays: 3.5,
    storedHours: 66,
    addedAt: hoursAgoToLocalTimestamp(66),
    notes: 'Moisture-sensitive leafy greens',
  },
];

export interface SensorPreset {
  id: string;
  name: string;
  summary: string;
  temperatureC: number;
  humidityPct: number;
  vocPpm: number;
  pressureHpa: number;
}

export const SENSOR_PRESETS: SensorPreset[] = [
  {
    id: 'pantry-normal',
    name: 'Normal Kitchen Pantry',
    summary: '20.5 °C · 48% RH · 0.35 ppm VOC · 1013 hPa',
    temperatureC: 20.5,
    humidityPct: 48.0,
    vocPpm: 0.35,
    pressureHpa: 1013.25,
  },
  {
    id: 'humid-afternoon',
    name: 'Humid Kitchen Spike',
    summary: '26.2 °C · 73% RH · 0.85 ppm VOC · 1007 hPa',
    temperatureC: 26.2,
    humidityPct: 73.0,
    vocPpm: 0.85,
    pressureHpa: 1007.4,
  },
  {
    id: 'voc-spoilage',
    name: 'Off-Gassing VOC Event',
    summary: '23.8 °C · 64% RH · 3.40 ppm VOC · 1011 hPa',
    temperatureC: 23.8,
    humidityPct: 64.0,
    vocPpm: 3.4,
    pressureHpa: 1011.0,
  },
  {
    id: 'cool-cellar',
    name: 'Cool Larder / Cellar',
    summary: '15.2 °C · 44% RH · 0.22 ppm VOC · 1018 hPa',
    temperatureC: 15.2,
    humidityPct: 44.0,
    vocPpm: 0.22,
    pressureHpa: 1018.2,
  },
];

export const DEFAULT_WEEKLY_SCHEDULE: WeeklyDaySchedule[] = [
  { dayIndex: 0, dayLabel: 'Mon', temperatureC: 20.2, humidityPct: 47, vocPpm: 0.32, pressureHpa: 1014.0, scenarioNote: 'Steady pantry baseline' },
  { dayIndex: 1, dayLabel: 'Tue', temperatureC: 20.8, humidityPct: 49, vocPpm: 0.38, pressureHpa: 1013.2, scenarioNote: 'Evening stovetop prep' },
  { dayIndex: 2, dayLabel: 'Wed', temperatureC: 22.1, humidityPct: 55, vocPpm: 0.62, pressureHpa: 1009.5, scenarioNote: 'Rainy afternoon humidity' },
  { dayIndex: 3, dayLabel: 'Thu', temperatureC: 21.4, humidityPct: 51, vocPpm: 0.44, pressureHpa: 1010.8, scenarioNote: 'Ventilated recovery' },
  { dayIndex: 4, dayLabel: 'Fri', temperatureC: 23.0, humidityPct: 56, vocPpm: 0.78, pressureHpa: 1012.1, scenarioNote: 'Oven baking warmth & VOC' },
  { dayIndex: 5, dayLabel: 'Sat', temperatureC: 21.6, humidityPct: 50, vocPpm: 0.52, pressureHpa: 1015.0, scenarioNote: 'Weekend kitchen activity' },
  { dayIndex: 6, dayLabel: 'Sun', temperatureC: 20.0, humidityPct: 46, vocPpm: 0.30, pressureHpa: 1016.4, scenarioNote: 'Cool quiet overnight' },
];

export interface WeeklySchedulePreset {
  id: string;
  name: string;
  days: WeeklyDaySchedule[];
}

export const WEEKLY_SCHEDULE_PRESETS: WeeklySchedulePreset[] = [
  {
    id: 'standard-kitchen',
    name: 'Standard Kitchen Pantry Week',
    days: DEFAULT_WEEKLY_SCHEDULE,
  },
  {
    id: 'humid-summer',
    name: 'Humid Summer Kitchen',
    days: [
      { dayIndex: 0, dayLabel: 'Mon', temperatureC: 24.5, humidityPct: 66, vocPpm: 0.55, pressureHpa: 1008.2, scenarioNote: 'Warm morning humidity' },
      { dayIndex: 1, dayLabel: 'Tue', temperatureC: 26.1, humidityPct: 71, vocPpm: 0.74, pressureHpa: 1006.4, scenarioNote: 'Peak afternoon heat' },
      { dayIndex: 2, dayLabel: 'Wed', temperatureC: 26.8, humidityPct: 74, vocPpm: 0.92, pressureHpa: 1005.1, scenarioNote: 'Humid storm front' },
      { dayIndex: 3, dayLabel: 'Thu', temperatureC: 25.4, humidityPct: 69, vocPpm: 0.68, pressureHpa: 1007.8, scenarioNote: 'Muggy evening' },
      { dayIndex: 4, dayLabel: 'Fri', temperatureC: 27.2, humidityPct: 72, vocPpm: 1.12, pressureHpa: 1008.9, scenarioNote: 'Cooking heat load' },
      { dayIndex: 5, dayLabel: 'Sat', temperatureC: 25.9, humidityPct: 67, vocPpm: 0.80, pressureHpa: 1010.2, scenarioNote: 'AC cycle' },
      { dayIndex: 6, dayLabel: 'Sun', temperatureC: 24.2, humidityPct: 63, vocPpm: 0.52, pressureHpa: 1011.5, scenarioNote: 'Moderate recovery' },
    ],
  },
  {
    id: 'cool-larder',
    name: 'Controlled Cool Larder',
    days: [
      { dayIndex: 0, dayLabel: 'Mon', temperatureC: 16.5, humidityPct: 43, vocPpm: 0.24, pressureHpa: 1016.0, scenarioNote: 'Cool steady state' },
      { dayIndex: 1, dayLabel: 'Tue', temperatureC: 16.8, humidityPct: 44, vocPpm: 0.25, pressureHpa: 1015.8, scenarioNote: 'Cool steady state' },
      { dayIndex: 2, dayLabel: 'Wed', temperatureC: 17.1, humidityPct: 45, vocPpm: 0.28, pressureHpa: 1014.9, scenarioNote: 'Brief door opening' },
      { dayIndex: 3, dayLabel: 'Thu', temperatureC: 16.4, humidityPct: 42, vocPpm: 0.22, pressureHpa: 1016.5, scenarioNote: 'Dry high pressure' },
      { dayIndex: 4, dayLabel: 'Fri', temperatureC: 16.9, humidityPct: 44, vocPpm: 0.27, pressureHpa: 1015.7, scenarioNote: 'Cool steady state' },
      { dayIndex: 5, dayLabel: 'Sat', temperatureC: 17.2, humidityPct: 46, vocPpm: 0.30, pressureHpa: 1014.2, scenarioNote: 'Weekend restock' },
      { dayIndex: 6, dayLabel: 'Sun', temperatureC: 16.3, humidityPct: 42, vocPpm: 0.21, pressureHpa: 1017.1, scenarioNote: 'Overnight low temp' },
    ],
  },
];
