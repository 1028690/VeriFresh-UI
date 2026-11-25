import { useMemo, useState } from 'react';
import { Check, RotateCcw, FastForward, Rewind } from 'lucide-react';
import { WEEKLY_SCHEDULE_PRESETS } from '../data/presets';
import {
  assessFoodItem,
  runWeeklyCalibration,
  simulateItemOverDays,
} from '../engine/spoilageModel';
import { BME688Reading, FoodItem, PantryBaseline, WeeklyDaySchedule } from '../types/sensor';

interface CalibrationLabViewProps {
  reading: BME688Reading;
  schedule: WeeklyDaySchedule[];
  onChangeSchedule: (next: WeeklyDaySchedule[]) => void;
  simulatedDays: number;
  onChangeSimulatedDays: (nextDays: number) => void;
  items: FoodItem[];
  baseline: PantryBaseline;
  onApplyCalibration: (nextBaseline: PantryBaseline, syncReading: boolean) => void;
  onResetStandardBaseline: () => void;
}

const OBSERVED_PRESETS = [
  { label: 'Still Fresh (8%)', value: 8 },
  { label: 'Early Staling (35%)', value: 35 },
  { label: 'Borderline (60%)', value: 60 },
  { label: 'Visibly Spoiled (88%)', value: 88 },
];

const WEEK_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function resizeScheduleWeeks(current: WeeklyDaySchedule[], weeks: number): WeeklyDaySchedule[] {
  const targetDays = Math.max(7, Math.min(28, weeks * 7));
  const basePattern = current.slice(0, 7);
  const next: WeeklyDaySchedule[] = [];

  for (let i = 0; i < targetDays; i++) {
    const existing = current[i];
    if (existing) {
      const weekNum = Math.floor(i / 7) + 1;
      const dayName = WEEK_DAY_NAMES[i % 7];
      next.push({
        ...existing,
        dayIndex: i,
        dayLabel: targetDays > 7 ? `W${weekNum} ${dayName}` : dayName,
      });
    } else {
      const template = basePattern[i % basePattern.length] ?? current[0];
      const weekNum = Math.floor(i / 7) + 1;
      const dayName = WEEK_DAY_NAMES[i % 7];
      next.push({
        ...template,
        dayIndex: i,
        dayLabel: targetDays > 7 ? `W${weekNum} ${dayName}` : dayName,
      });
    }
  }
  return next;
}

export function CalibrationLabView({
  reading,
  schedule,
  onChangeSchedule,
  simulatedDays,
  onChangeSimulatedDays,
  items,
  baseline,
  onApplyCalibration,
  onResetStandardBaseline,
}: CalibrationLabViewProps) {
  const [testItemId, setTestItemId] = useState<string>(items[0]?.id ?? '');
  const [observedPct, setObservedPct] = useState<number>(60);
  const [syncActiveReading, setSyncActiveReading] = useState<boolean>(true);
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const activeWeeks = Math.max(1, Math.round(schedule.length / 7));

  const testItem: FoodItem = useMemo(() => {
    const found = items.find((i) => i.id === testItemId);
    if (found) {
      return { ...found, storedHours: 0, addedAt: '' };
    }
    return {
      id: 'bench-loaf',
      name: 'Calibration Test Specimen',
      category: 'Bakery',
      packaging: 'Resealable',
      nominalShelfLifeDays: 5,
      storedHours: 0,
      addedAt: '',
    };
  }, [items, testItemId]);

  const result = useMemo(
    () => runWeeklyCalibration(schedule, testItem, baseline, observedPct),
    [schedule, testItem, baseline, observedPct],
  );

  const updateDay = (
    dayIndex: number,
    field: 'temperatureC' | 'humidityPct' | 'vocPpm' | 'pressureHpa' | 'scenarioNote',
    value: number | string,
  ) => {
    setSavedMessage(null);
    const next = schedule.map((d) =>
      d.dayIndex === dayIndex ? { ...d, [field]: value } : d,
    );
    onChangeSchedule(next);
  };

  const applyWeekPreset = (presetId: string) => {
    const preset = WEEKLY_SCHEDULE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setSavedMessage(null);
      const expanded = resizeScheduleWeeks(preset.days, activeWeeks);
      onChangeSchedule(expanded);
    }
  };

  const handleSetWeeks = (weeks: number) => {
    setSavedMessage(null);
    const nextSchedule = resizeScheduleWeeks(schedule, weeks);
    onChangeSchedule(nextSchedule);
    if (simulatedDays > nextSchedule.length) {
      onChangeSimulatedDays(nextSchedule.length);
    }
  };

  const handleSaveCalibrationAndDefault = (updatePantryDefault: boolean) => {
    const nowLabel = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const nextBaseline: PantryBaseline = {
      ...baseline,
      ...(updatePantryDefault
        ? {
            temperatureC: result.meanConditions.temperatureC,
            humidityPct: result.meanConditions.humidityPct,
            vocPpm: result.meanConditions.vocPpm,
            pressureHpa: result.meanConditions.pressureHpa,
            label: 'Calibrated Kitchen Pantry',
          }
        : {}),
      decaySensitivityGain: result.fittedGain,
      vocDriftOffsetPpm: result.fittedVocOffsetPpm,
      calibrationAccuracyPct: result.accuracyPct,
      calibratedAt: nowLabel,
    };

    const shouldSyncReading = updatePantryDefault && syncActiveReading;
    onApplyCalibration(nextBaseline, shouldSyncReading);
    setSavedMessage(
      updatePantryDefault
        ? `Applied ${result.fittedGain.toFixed(2)}x decay gain & saved ${result.totalDays}-day mean (${result.meanConditions.temperatureC.toFixed(1)} °C, ${result.meanConditions.humidityPct.toFixed(0)}% RH) as pantry default${shouldSyncReading ? ' and synced active readings' : ''}.`
        : `Updated sensor decay gain (${result.fittedGain.toFixed(2)}x) and VOC drift offset (${result.fittedVocOffsetPpm >= 0 ? '+' : ''}${result.fittedVocOffsetPpm.toFixed(2)} ppm).`,
    );
  };

  const foodImpactPreview = useMemo(() => {
    const targetReading = syncActiveReading ? result.meanConditions : reading;
    return items.slice(0, 5).map((item) => {
      const before = assessFoodItem(item, reading, baseline);
      const after = simulateItemOverDays(
        item,
        schedule,
        targetReading,
        baseline,
        simulatedDays,
        result.fittedGain,
        result.fittedVocOffsetPpm,
      );
      return { item, before, after };
    });
  }, [items, reading, schedule, baseline, result, syncActiveReading, simulatedDays]);

  const maxScheduleDays = Math.max(28, schedule.length);
  const totalHours = result.totalHours;
  const skippedHour = Math.min(totalHours, Math.max(0, simulatedDays * 24));
  const skippedPoint =
    result.hourlyPoints[Math.min(result.hourlyPoints.length - 1, skippedHour)] ??
    result.hourlyPoints[0];

  // Chart dimensions
  const width = 760;
  const height = 250;
  const pad = { top: 20, right: 48, bottom: 34, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const toX = (h: number) => pad.left + (h / Math.max(24, totalHours)) * plotW;
  const toYProb = (pct: number) => pad.top + ((100 - pct) / 100) * plotH;
  const toYTemp = (t: number) => pad.top + ((35 - Math.max(10, Math.min(35, t))) / 25) * plotH;

  const sampleStep = Math.max(2, Math.floor(result.hourlyPoints.length / 90));
  const sampledPoints = result.hourlyPoints.filter(
    (_, idx) => idx % sampleStep === 0 || idx === result.hourlyPoints.length - 1,
  );

  const uncalPath = sampledPoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(pt.hour).toFixed(1)} ${toYProb(pt.uncalibratedProbPct).toFixed(1)}`)
    .join(' ');

  const calPath = sampledPoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(pt.hour).toFixed(1)} ${toYProb(pt.calibratedProbPct).toFixed(1)}`)
    .join(' ');

  const tempPath = sampledPoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(pt.hour).toFixed(1)} ${toYTemp(pt.temperatureC).toFixed(1)}`)
    .join(' ');

  const activePoint =
    hoverHour !== null
      ? result.hourlyPoints[Math.min(result.hourlyPoints.length - 1, Math.max(0, hoverHour))]
      : null;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-md p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-mono text-blue-700 font-medium">
              Beta Testing Module · {result.totalDays}-Day ({result.totalHours}h) Decay Calibration
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mt-1">
              Multi-Week Pantry Condition Schedule &amp; Sensor Calibration
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Configure a 1 to 4 week schedule of kitchen conditions, skip forward by +1 day or +1 week to preview and drive the entire UI, calibrate BME688 decay gain, and save the schedule mean as your pantry default.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {[1, 2, 3, 4].map((weeks) => {
                const active = activeWeeks === weeks;
                return (
                  <button
                    key={weeks}
                    type="button"
                    onClick={() => handleSetWeeks(weeks)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {weeks} {weeks === 1 ? 'Week' : 'Weeks'} ({weeks * 7}d)
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {WEEKLY_SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyWeekPreset(preset.id)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Active Kitchen Pantry Default
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onResetStandardBaseline();
                    setSavedMessage('Reset kitchen pantry defaults to standard 20.5 °C / 48% RH.');
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                <div>
                  <span className="text-slate-500">Temp:</span>{' '}
                  <strong className="text-slate-900">{baseline.temperatureC.toFixed(1)} °C</strong>
                </div>
                <div>
                  <span className="text-slate-500">RH:</span>{' '}
                  <strong className="text-slate-900">{baseline.humidityPct.toFixed(1)}%</strong>
                </div>
                <div>
                  <span className="text-slate-500">VOC:</span>{' '}
                  <strong className="text-slate-900">{baseline.vocPpm.toFixed(2)} ppm</strong>
                </div>
                <div>
                  <span className="text-slate-500">Press:</span>{' '}
                  <strong className="text-slate-900">{baseline.pressureHpa.toFixed(1)} hPa</strong>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 text-xs font-mono tabular-nums text-slate-600">
                Gain: <strong className="text-slate-900">{baseline.decaySensitivityGain.toFixed(2)}x</strong> · VOC Offset:{' '}
                <strong className="text-slate-900">
                  {baseline.vocDriftOffsetPpm >= 0 ? '+' : ''}
                  {baseline.vocDriftOffsetPpm.toFixed(2)} ppm
                </strong>
              </div>
            </div>

            <div className="border border-slate-200 rounded-md p-4 space-y-4">
              <div>
                <label htmlFor="cal-specimen" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Benchmark Food Specimen (Fresh at Day 0)
                </label>
                <select
                  id="cal-specimen"
                  value={testItemId}
                  onChange={(e) => setTestItemId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded px-2.5 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category} · {item.nominalShelfLifeDays}d nominal)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="cal-observed" className="font-semibold text-slate-700">
                    Observed Day-{result.totalDays} Spoilage Outcome
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-blue-700">
                    {observedPct}%
                  </span>
                </div>
                <input
                  id="cal-observed"
                  type="range"
                  min={2}
                  max={98}
                  step={1}
                  value={observedPct}
                  onChange={(e) => {
                    setSavedMessage(null);
                    setObservedPct(Number(e.target.value));
                  }}
                  className="w-full cursor-pointer"
                />
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {OBSERVED_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setSavedMessage(null);
                        setObservedPct(preset.value);
                      }}
                      className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                        observedPct === preset.value
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500">Uncalibrated Error</div>
                  <div className="font-mono tabular-nums text-base font-semibold text-amber-700 mt-0.5">
                    ±{result.rawErrorPct.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Calibrated Accuracy</div>
                  <div className="font-mono tabular-nums text-base font-semibold text-emerald-700 mt-0.5">
                    {result.accuracyPct.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Fitted Decay Gain</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {result.fittedGain.toFixed(2)}x
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">VOC Offset Fit</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {result.fittedVocOffsetPpm >= 0 ? '+' : ''}
                    {result.fittedVocOffsetPpm.toFixed(2)} ppm
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncActiveReading}
                    onChange={(e) => setSyncActiveReading(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>
                    Sync active pantry sensor readings to schedule mean ({result.meanConditions.temperatureC.toFixed(1)} °C, {result.meanConditions.humidityPct.toFixed(0)}% RH)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => handleSaveCalibrationAndDefault(true)}
                  className="w-full px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  Apply Calibration &amp; Set Mean as Pantry Default
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCalibrationAndDefault(false)}
                  className="w-full px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200/70 transition-colors"
                >
                  Apply Calibration Gain Only
                </button>
              </div>

              {foodImpactPreview.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
                      Global UI Effect ({simulatedDays === 0 ? 'Today' : `+${simulatedDays}d`})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={simulatedDays >= maxScheduleDays}
                        onClick={() => onChangeSimulatedDays(Math.min(maxScheduleDays, simulatedDays + 1))}
                        className="px-2 py-1 text-[11px] font-mono font-medium border border-blue-200 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                      >
                        +1d
                      </button>
                      <button
                        type="button"
                        disabled={simulatedDays >= maxScheduleDays}
                        onClick={() => onChangeSimulatedDays(Math.min(maxScheduleDays, simulatedDays + 7))}
                        className="px-2 py-1 text-[11px] font-mono font-medium border border-blue-200 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                      >
                        +1w
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {foodImpactPreview.map(({ item, before, after }) => {
                      const diff = after.expirationLikelihoodPct - before.expirationLikelihoodPct;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200/80 rounded px-2.5 py-1.5"
                        >
                          <span className="truncate text-slate-700">{item.name}</span>
                          <span className="font-mono tabular-nums whitespace-nowrap text-slate-900">
                            {before.expirationLikelihoodPct.toFixed(0)}% →{' '}
                            <strong>{after.expirationLikelihoodPct.toFixed(0)}%</strong>{' '}
                            <span
                              className={
                                diff > 0.5
                                  ? 'text-amber-700'
                                  : diff < -0.5
                                  ? 'text-emerald-700'
                                  : 'text-slate-400'
                              }
                            >
                              ({diff >= 0 ? '+' : ''}
                              {diff.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {savedMessage && (
                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2.5">
                  {savedMessage}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-md px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Global UI Time-Skip — Day {simulatedDays} of {result.totalDays} ({simulatedDays * 24}h ahead)
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-600 mt-0.5">
                  {skippedPoint.dayLabel} · {skippedPoint.temperatureC.toFixed(1)} °C ·{' '}
                  {skippedPoint.humidityPct.toFixed(0)}% RH · {skippedPoint.vocPpm.toFixed(2)} ppm ·
                  Specimen Spoilage: <strong className="text-slate-900">{skippedPoint.calibratedProbPct.toFixed(1)}%</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={simulatedDays <= 0}
                  onClick={() => onChangeSimulatedDays(Math.max(0, simulatedDays - 7))}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap"
                >
                  -1 Week
                </button>
                <button
                  type="button"
                  disabled={simulatedDays <= 0}
                  onClick={() => onChangeSimulatedDays(Math.max(0, simulatedDays - 1))}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 flex items-center gap-1 whitespace-nowrap"
                >
                  <Rewind className="w-3 h-3" aria-hidden="true" />
                  -1 Day
                </button>
                <button
                  type="button"
                  disabled={simulatedDays >= maxScheduleDays}
                  onClick={() => onChangeSimulatedDays(Math.min(maxScheduleDays, simulatedDays + 1))}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1 whitespace-nowrap"
                >
                  <FastForward className="w-3 h-3" aria-hidden="true" />
                  Skip +1 Day
                </button>
                <button
                  type="button"
                  disabled={simulatedDays >= maxScheduleDays}
                  onClick={() => onChangeSimulatedDays(Math.min(maxScheduleDays, simulatedDays + 7))}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
                >
                  +1 Week
                </button>
                <button
                  type="button"
                  disabled={simulatedDays === 0}
                  onClick={() => onChangeSimulatedDays(0)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-md p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {result.totalHours}-Hour ({result.totalDays}-Day) Spoilage Calibration Curve
                  </h2>
                  <p className="text-xs text-slate-500">
                    Schedule Mean: {result.meanConditions.temperatureC.toFixed(1)} °C ·{' '}
                    {result.meanConditions.humidityPct.toFixed(1)}% RH ·{' '}
                    {result.meanConditions.vocPpm.toFixed(2)} ppm VOC ·{' '}
                    {result.meanConditions.pressureHpa.toFixed(1)} hPa
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5 bg-blue-600" aria-hidden="true" />
                    Calibrated ({result.calibratedEndProbPct.toFixed(1)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 border-t-2 border-dashed border-slate-400" aria-hidden="true" />
                    Raw Model ({result.uncalibratedEndProbPct.toFixed(1)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5 bg-amber-500" aria-hidden="true" />
                    Temp °C
                  </span>
                </div>
              </div>

              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto cursor-crosshair select-none"
                onMouseLeave={() => setHoverHour(null)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = ((e.clientX - rect.left) / rect.width) * width;
                  const ratio = Math.max(0, Math.min(1, (relX - pad.left) / plotW));
                  setHoverHour(Math.round(ratio * totalHours));
                }}
              >
                {[0, 25, 50, 75, 100].map((pct) => (
                  <g key={pct}>
                    <line
                      x1={pad.left}
                      y1={toYProb(pct)}
                      x2={width - pad.right}
                      y2={toYProb(pct)}
                      stroke="#f1f5f9"
                    />
                    <text
                      x={pad.left - 8}
                      y={toYProb(pct) + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono tabular-nums"
                    >
                      {pct}%
                    </text>
                  </g>
                ))}

                {[15, 25, 35].map((tempTick) => (
                  <text
                    key={tempTick}
                    x={width - pad.right + 8}
                    y={toYTemp(tempTick) + 3}
                    textAnchor="start"
                    className="fill-amber-600 text-[10px] font-mono tabular-nums"
                  >
                    {tempTick}°C
                  </text>
                ))}

                {schedule.map((d) => {
                  const h = d.dayIndex * 24;
                  const showLabel =
                    result.totalDays <= 7 || d.dayIndex % 7 === 0 || d.dayIndex === result.totalDays - 1;
                  return (
                    <g key={d.dayIndex}>
                      <line
                        x1={toX(h)}
                        y1={pad.top}
                        x2={toX(h)}
                        y2={height - pad.bottom}
                        stroke={d.dayIndex % 7 === 0 ? '#e2e8f0' : '#f8fafc'}
                      />
                      {showLabel && (
                        <text
                          x={toX(h + 12)}
                          y={height - pad.bottom + 16}
                          textAnchor="middle"
                          className="fill-slate-500 text-[10px] font-mono"
                        >
                          {result.totalDays <= 7 ? d.dayLabel : `Day ${d.dayIndex + 1}`}
                        </text>
                      )}
                    </g>
                  );
                })}

                {simulatedDays > 0 && (
                  <rect
                    x={pad.left}
                    y={pad.top}
                    width={Math.max(0, toX(skippedHour) - pad.left)}
                    height={plotH}
                    fill="#2563eb"
                    opacity={0.06}
                  />
                )}

                <circle
                  cx={toX(totalHours)}
                  cy={toYProb(observedPct)}
                  r={5}
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />

                <path d={tempPath} fill="none" stroke="#f59e0b" strokeWidth={1.25} opacity={0.75} />
                <path
                  d={uncalPath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.75}
                  strokeDasharray="5 4"
                />
                <path d={calPath} fill="none" stroke="#2563eb" strokeWidth={2.25} />

                <line
                  x1={toX(skippedHour)}
                  y1={pad.top}
                  x2={toX(skippedHour)}
                  y2={height - pad.bottom}
                  stroke="#1d4ed8"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={toX(skippedHour)}
                  cy={toYProb(skippedPoint.calibratedProbPct)}
                  r={4.5}
                  fill="#1d4ed8"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />

                {activePoint && (
                  <g>
                    <line
                      x1={toX(activePoint.hour)}
                      y1={pad.top}
                      x2={toX(activePoint.hour)}
                      y2={height - pad.bottom}
                      stroke="#64748b"
                      strokeWidth={1}
                    />
                    <circle
                      cx={toX(activePoint.hour)}
                      cy={toYProb(activePoint.calibratedProbPct)}
                      r={4}
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  </g>
                )}
              </svg>

              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-600 px-1">
                {activePoint ? (
                  <>
                    <span>
                      {activePoint.dayLabel} · Hour {activePoint.hour} ({activePoint.temperatureC.toFixed(1)} °C,{' '}
                      {activePoint.humidityPct.toFixed(0)}% RH, {activePoint.vocPpm.toFixed(2)} ppm)
                    </span>
                    <span>
                      Calibrated: <strong className="text-slate-900">{activePoint.calibratedProbPct.toFixed(1)}%</strong> ·
                      Raw: <strong>{activePoint.uncalibratedProbPct.toFixed(1)}%</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <span>Green endpoint marker = Observed ground truth ({observedPct}%) at Day {result.totalDays}</span>
                    <span>Hover across the {result.totalDays}-day timeline to inspect hourly fit</span>
                  </>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  {result.totalDays}-Day Schedule Conditions Editor
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Edit daily setpoints across {activeWeeks} {activeWeeks === 1 ? 'week' : 'weeks'}
                </span>
              </div>
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500">
                      <th className="py-2.5 px-3 font-medium">Day</th>
                      <th className="py-2.5 px-2 font-medium">Temp (°C)</th>
                      <th className="py-2.5 px-2 font-medium">Humidity (%)</th>
                      <th className="py-2.5 px-2 font-medium">VOC (ppm)</th>
                      <th className="py-2.5 px-2 font-medium">Pressure (hPa)</th>
                      <th className="py-2.5 px-3 font-medium">Condition Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedule.map((d) => {
                      const isCurrentSkippedDay =
                        simulatedDays > 0 && d.dayIndex === (simulatedDays - 1) % schedule.length;
                      return (
                        <tr
                          key={d.dayIndex}
                          className={isCurrentSkippedDay ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'}
                        >
                          <td className="py-2 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {d.dayLabel}
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step={0.1}
                              min={0}
                              max={45}
                              value={d.temperatureC}
                              onChange={(e) =>
                                updateDay(d.dayIndex, 'temperatureC', Number(e.target.value))
                              }
                              aria-label={`${d.dayLabel} temperature`}
                              className="w-20 font-mono tabular-nums border border-slate-200 rounded px-2 py-1 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step={1}
                              min={10}
                              max={98}
                              value={d.humidityPct}
                              onChange={(e) =>
                                updateDay(d.dayIndex, 'humidityPct', Number(e.target.value))
                              }
                              aria-label={`${d.dayLabel} humidity`}
                              className="w-20 font-mono tabular-nums border border-slate-200 rounded px-2 py-1 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step={0.05}
                              min={0.05}
                              max={15}
                              value={d.vocPpm}
                              onChange={(e) =>
                                updateDay(d.dayIndex, 'vocPpm', Number(e.target.value))
                              }
                              aria-label={`${d.dayLabel} VOC`}
                              className="w-20 font-mono tabular-nums border border-slate-200 rounded px-2 py-1 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step={0.5}
                              min={950}
                              max={1050}
                              value={d.pressureHpa}
                              onChange={(e) =>
                                updateDay(d.dayIndex, 'pressureHpa', Number(e.target.value))
                              }
                              aria-label={`${d.dayLabel} pressure`}
                              className="w-24 font-mono tabular-nums border border-slate-200 rounded px-2 py-1 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={d.scenarioNote}
                              onChange={(e) =>
                                updateDay(d.dayIndex, 'scenarioNote', e.target.value)
                              }
                              aria-label={`${d.dayLabel} condition note`}
                              className="w-full min-w-[140px] border border-slate-200 rounded px-2 py-1 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
