import {
  BME688Reading,
  CalibrationResult,
  CategoryProfile,
  FactorMultipliers,
  FoodCategory,
  FoodItem,
  PackagingType,
  PantryBaseline,
  SpoilageAssessment,
  SpoilageStatus,
  TrajectoryPoint,
  WeeklyDaySchedule,
  WeeklySimulationPoint,
} from '../types/sensor';

export const CATEGORY_PROFILES: Record<FoodCategory, CategoryProfile> = {
  Produce: {
    q10: 2.35,
    rhOptimalMin: 55,
    rhOptimalMax: 78,
    rhHighSensitivity: 1.4,
    rhLowSensitivity: 1.15,
    vocSensitivity: 0.95,
    pressureSensitivity: 0.25,
    defaultShelfLifeDays: 5,
    description: 'High respiration rate; sensitive to ethylene/VOC spikes and moisture loss or mold.',
  },
  Bakery: {
    q10: 1.85,
    rhOptimalMin: 40,
    rhOptimalMax: 58,
    rhHighSensitivity: 1.75,
    rhLowSensitivity: 0.75,
    vocSensitivity: 0.85,
    pressureSensitivity: 0.2,
    defaultShelfLifeDays: 4.5,
    description: 'Mold growth accelerates sharply above 60% RH; stales in dry air.',
  },
  'Dairy & Chilled': {
    q10: 2.8,
    rhOptimalMin: 35,
    rhOptimalMax: 65,
    rhHighSensitivity: 0.7,
    rhLowSensitivity: 0.25,
    vocSensitivity: 1.35,
    pressureSensitivity: 0.35,
    defaultShelfLifeDays: 2,
    description: 'Steep Arrhenius thermal decay at room temperatures; rapid souring VOC emission.',
  },
  'Dry Goods': {
    q10: 1.35,
    rhOptimalMin: 25,
    rhOptimalMax: 52,
    rhHighSensitivity: 1.9,
    rhLowSensitivity: 0.1,
    vocSensitivity: 0.45,
    pressureSensitivity: 0.15,
    defaultShelfLifeDays: 90,
    description: 'Low baseline water activity; primary spoilage risk is ambient humidity ingress.',
  },
  'Oils & Condiments': {
    q10: 1.65,
    rhOptimalMin: 30,
    rhOptimalMax: 60,
    rhHighSensitivity: 0.35,
    rhLowSensitivity: 0.1,
    vocSensitivity: 0.65,
    pressureSensitivity: 0.4,
    defaultShelfLifeDays: 60,
    description: 'Lipid oxidation driven by heat, VOC exposure, and barometric headspace exchange.',
  },
  'Meat & Protein': {
    q10: 3.1,
    rhOptimalMin: 40,
    rhOptimalMax: 65,
    rhHighSensitivity: 0.9,
    rhLowSensitivity: 0.2,
    vocSensitivity: 1.65,
    pressureSensitivity: 0.3,
    defaultShelfLifeDays: 1,
    description: 'Extreme thermal acceleration and early biogenic amine / sulfur VOC off-gassing.',
  },
};

export const PACKAGING_SHIELDING: Record<
  PackagingType,
  { rh: number; voc: number; pressure: number; label: string }
> = {
  Unsealed: { rh: 1.0, voc: 1.0, pressure: 1.0, label: 'Direct ambient exposure' },
  Resealable: { rh: 0.52, voc: 0.6, pressure: 0.65, label: 'Partial vapor & gas barrier' },
  Airtight: { rh: 0.16, voc: 0.22, pressure: 0.3, label: 'Dampens RH/VOC & pressure swings' },
};

export function vocPpmToIaq(vocPpm: number): number {
  const clamped = Math.max(0.05, Math.min(25, vocPpm));
  const iaq = 22 + 128 * Math.log10(1 + clamped * 3.8);
  return Math.round(Math.min(500, Math.max(10, iaq)));
}

export function vocPpmToGasResistanceKOhm(vocPpm: number): number {
  const clamped = Math.max(0.05, Math.min(25, vocPpm));
  const kOhm = 280 / (1 + Math.pow(clamped / 0.42, 0.85));
  return Number(Math.max(4.5, Math.min(350, kOhm)).toFixed(1));
}

export function buildReading(
  temperatureC: number,
  humidityPct: number,
  vocPpm: number,
  pressureHpa: number,
  timestamp = Date.now(),
): BME688Reading {
  const cleanTemp = Number(Math.max(-10, Math.min(50, temperatureC)).toFixed(2));
  const cleanRh = Number(Math.max(5, Math.min(99, humidityPct)).toFixed(1));
  const cleanVoc = Number(Math.max(0.05, Math.min(20, vocPpm)).toFixed(2));
  const cleanPressure = Number(Math.max(920, Math.min(1060, pressureHpa)).toFixed(2));

  return {
    temperatureC: cleanTemp,
    humidityPct: cleanRh,
    vocPpm: cleanVoc,
    pressureHpa: cleanPressure,
    iaqIndex: vocPpmToIaq(cleanVoc),
    gasResistanceKOhm: vocPpmToGasResistanceKOhm(cleanVoc),
    timestamp,
  };
}

export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function hoursAgoToLocalTimestamp(hoursAgo: number, nowMs = Date.now()): string {
  return toLocalDateTimeInput(new Date(nowMs - Math.max(0, hoursAgo) * 3600 * 1000));
}

export function computeElapsedHours(addedAt: string, nowMs = Date.now()): number {
  const parsed = Date.parse(addedAt);
  if (!Number.isFinite(parsed)) return 0;
  return Number(Math.max(0, (nowMs - parsed) / (3600 * 1000)).toFixed(1));
}

export function formatTimestampLabel(addedAt: string): string {
  const parsed = Date.parse(addedAt);
  if (!Number.isFinite(parsed)) return 'Unset';
  return new Date(parsed).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getEffectiveStoredHours(item: FoodItem, nowMs = Date.now()): number {
  if (item.addedAt) {
    return computeElapsedHours(item.addedAt, nowMs);
  }
  return item.storedHours;
}

const PHYSICAL_REFERENCE = {
  temperatureC: 20.5,
  humidityPct: 48.0,
  vocPpm: 0.35,
  pressureHpa: 1013.25,
};

export function computeFactorMultipliers(
  category: FoodCategory,
  packaging: PackagingType,
  reading: Pick<BME688Reading, 'temperatureC' | 'humidityPct' | 'vocPpm' | 'pressureHpa'>,
  baseline: PantryBaseline,
  vocOffsetOverride?: number,
  customRhBounds?: { min?: number; max?: number },
): FactorMultipliers {
  const profile = CATEGORY_PROFILES[category];
  const shield = PACKAGING_SHIELDING[packaging];

  // 1. Arrhenius / Q10 thermal acceleration relative to 20.5C food-science reference
  const deltaT = reading.temperatureC - PHYSICAL_REFERENCE.temperatureC;
  const thermal = Math.pow(profile.q10, deltaT / 10);

  // 2. Water activity / RH stress outside category's optimal pantry window
  const rhMin = customRhBounds?.min ?? profile.rhOptimalMin;
  const rhMax = customRhBounds?.max ?? profile.rhOptimalMax;
  let rawMoistureStress = 1.0;
  if (reading.humidityPct > rhMax) {
    const excess = (reading.humidityPct - rhMax) / 25;
    rawMoistureStress = 1 + profile.rhHighSensitivity * Math.pow(excess, 1.35);
  } else if (reading.humidityPct < rhMin) {
    const deficit = (rhMin - reading.humidityPct) / 25;
    rawMoistureStress = 1 + profile.rhLowSensitivity * Math.pow(deficit, 1.2);
  }
  const moisture = 1 + (rawMoistureStress - 1) * shield.rh;

  // 3. VOC off-gassing / ambient volatile load relative to reference + calibrated drift offset
  const vocOffset = vocOffsetOverride ?? baseline.vocDriftOffsetPpm;
  const effectiveVoc = Math.max(0.05, reading.vocPpm + vocOffset);
  const vocRatio = Math.max(0, effectiveVoc / PHYSICAL_REFERENCE.vocPpm - 1);
  const rawVocStress = 1 + profile.vocSensitivity * Math.pow(vocRatio, 0.9) * 0.42;
  const voc = 1 + (rawVocStress - 1) * shield.voc;

  // 4. Barometric pressure delta relative to standard 1013.25 hPa
  const pressureDelta = PHYSICAL_REFERENCE.pressureHpa - reading.pressureHpa;
  const absDeltaNorm = Math.abs(pressureDelta) / 20;
  const directionalBias = pressureDelta > 0 ? 1.15 : 0.75;
  const rawPressureStress = 1 + profile.pressureSensitivity * absDeltaNorm * directionalBias * 0.35;
  const pressure = 1 + (rawPressureStress - 1) * shield.pressure;

  return {
    thermal: Number(thermal.toFixed(3)),
    moisture: Number(moisture.toFixed(3)),
    voc: Number(voc.toFixed(3)),
    pressure: Number(pressure.toFixed(3)),
  };
}

export function ageRatioToExpirationPct(ageRatio: number): number {
  // Smooth calibrated Weibull-logistic hazard curve:
  // At 0.0 -> ~0.8%, at 0.5 -> ~6%, at 0.85 -> ~34%, at 1.0 -> ~63%, at 1.25 -> ~92%
  const clamped = Math.max(0, ageRatio);
  const logistic = 100 / (1 + Math.exp(-5.4 * (clamped - 0.91)));
  return Number(Math.min(99.9, Math.max(0.2, logistic)).toFixed(1));
}

export function statusFromLikelihood(pct: number): SpoilageStatus {
  if (pct >= 72) return 'Likely Expired';
  if (pct >= 42) return 'High Risk';
  if (pct >= 18) return 'Watch';
  return 'Fresh';
}

export function assessFoodItem(
  item: FoodItem,
  reading: Pick<BME688Reading, 'temperatureC' | 'humidityPct' | 'vocPpm' | 'pressureHpa'>,
  baseline: PantryBaseline,
  nowMs = Date.now(),
): SpoilageAssessment {
  const factors = computeFactorMultipliers(
    item.category,
    item.packaging,
    reading,
    baseline,
    undefined,
    item.specs
      ? { min: item.specs.optimalRhMin, max: item.specs.optimalRhMax }
      : undefined,
  );
  const combinedRawRate = factors.thermal * factors.moisture * factors.voc * factors.pressure;
  const effectiveDecayRate = Number(
    Math.max(0.1, combinedRawRate * baseline.decaySensitivityGain).toFixed(3),
  );

  const activeHours = getEffectiveStoredHours(item, nowMs);
  const nominalHours = Math.max(4, item.nominalShelfLifeDays * 24);
  const effectiveAgeHours = activeHours * effectiveDecayRate;
  const ageRatio = effectiveAgeHours / nominalHours;
  const expirationLikelihoodPct = ageRatioToExpirationPct(ageRatio);

  // Remaining hours until 50% watch/risk threshold (or 90% nominal threshold)
  const targetThresholdHours = nominalHours * 0.91;
  const remainingEffectiveHours = targetThresholdHours - effectiveAgeHours;
  const remainingSafeHours = remainingEffectiveHours / effectiveDecayRate;

  const deviations: Array<{
    driver: SpoilageAssessment['dominantDriver'];
    score: number;
  }> = [
    { driver: 'Temperature', score: Math.abs(factors.thermal - 1) },
    { driver: 'Humidity', score: Math.abs(factors.moisture - 1) },
    { driver: 'VOC', score: Math.abs(factors.voc - 1) },
    { driver: 'Pressure', score: Math.abs(factors.pressure - 1) },
  ];
  deviations.sort((a, b) => b.score - a.score);

  const dominantDriver =
    deviations[0].score < 0.06 ? 'Elapsed Time' : deviations[0].driver;

  return {
    expirationLikelihoodPct,
    effectiveDecayRate,
    effectiveAgeHours: Number(effectiveAgeHours.toFixed(1)),
    remainingSafeHours: Number(remainingSafeHours.toFixed(1)),
    status: statusFromLikelihood(expirationLikelihoodPct),
    factorMultipliers: factors,
    dominantDriver,
  };
}

export function generateTrajectory(
  item: FoodItem,
  reading: Pick<BME688Reading, 'temperatureC' | 'humidityPct' | 'vocPpm' | 'pressureHpa'>,
  baseline: PantryBaseline,
  pointsCount = 28,
): TrajectoryPoint[] {
  const currentAssessment = assessFoodItem(item, reading, baseline);
  const activeHours = getEffectiveStoredHours(item);
  const nominalHours = Math.max(4, item.nominalShelfLifeDays * 24);
  const horizonHours = Math.max(
    activeHours + 24,
    nominalHours * 1.45,
  );

  const points: TrajectoryPoint[] = [];
  for (let i = 0; i <= pointsCount; i++) {
    const hour = (horizonHours * i) / pointsCount;
    const currentRatio = (hour * currentAssessment.effectiveDecayRate) / nominalHours;
    const baselineRatio = (hour * baseline.decaySensitivityGain) / nominalHours;

    points.push({
      hour: Number(hour.toFixed(1)),
      day: Number((hour / 24).toFixed(2)),
      currentProbPct: ageRatioToExpirationPct(currentRatio),
      baselineProbPct: ageRatioToExpirationPct(baselineRatio),
    });
  }
  return points;
}

export function interpolateWeeklySchedule(
  schedule: WeeklyDaySchedule[],
  totalHours?: number,
): Array<{
  hour: number;
  dayLabel: string;
  temperatureC: number;
  humidityPct: number;
  vocPpm: number;
  pressureHpa: number;
}> {
  const safeSchedule = schedule.length > 0 ? schedule : [
    {
      dayIndex: 0,
      dayLabel: 'Mon',
      temperatureC: 20.5,
      humidityPct: 48,
      vocPpm: 0.35,
      pressureHpa: 1013.25,
      scenarioNote: 'Default',
    },
  ];
  const dayCount = safeSchedule.length;
  const horizonHours = totalHours ?? dayCount * 24;
  const out: Array<{
    hour: number;
    dayLabel: string;
    temperatureC: number;
    humidityPct: number;
    vocPpm: number;
    pressureHpa: number;
  }> = [];

  for (let h = 0; h <= horizonHours; h++) {
    const rawDayFloat = h / 24;
    const idx0 = Math.floor(rawDayFloat) % dayCount;
    const idx1 = (idx0 + 1) % dayCount;
    const frac = rawDayFloat - Math.floor(rawDayFloat);

    const d0 = safeSchedule[idx0];
    const d1 = safeSchedule[idx1];

    // Smooth diurnal wave (+/- 0.65C afternoon warming, inverse mild RH swing)
    const diurnal = Math.sin(((h % 24) - 8) * (Math.PI / 12));

    const temp = d0.temperatureC + (d1.temperatureC - d0.temperatureC) * frac + diurnal * 0.65;
    const rh = d0.humidityPct + (d1.humidityPct - d0.humidityPct) * frac - diurnal * 1.8;
    const voc = Math.max(
      0.08,
      d0.vocPpm + (d1.vocPpm - d0.vocPpm) * frac + Math.max(0, diurnal) * 0.06,
    );
    const pressure = d0.pressureHpa + (d1.pressureHpa - d0.pressureHpa) * frac;

    out.push({
      hour: h,
      dayLabel: d0.dayLabel,
      temperatureC: Number(temp.toFixed(2)),
      humidityPct: Number(Math.max(10, Math.min(98, rh)).toFixed(1)),
      vocPpm: Number(voc.toFixed(2)),
      pressureHpa: Number(pressure.toFixed(2)),
    });
  }

  return out;
}

export function getScheduleReadingAtDay(
  schedule: WeeklyDaySchedule[],
  daysSkipped: number,
  fallbackReading: BME688Reading,
): BME688Reading {
  if (daysSkipped <= 0 || schedule.length === 0) {
    return fallbackReading;
  }
  const idx = (daysSkipped - 1) % schedule.length;
  const day = schedule[idx];
  return buildReading(
    day.temperatureC,
    day.humidityPct,
    day.vocPpm,
    day.pressureHpa,
    fallbackReading.timestamp,
  );
}

export function runWeeklyCalibration(
  schedule: WeeklyDaySchedule[],
  testItem: FoodItem,
  currentBaseline: PantryBaseline,
  observedEndSpoilagePct: number,
): CalibrationResult {
  const totalDays = Math.max(1, schedule.length);
  const totalHours = totalDays * 24;
  const hourlyEnv = interpolateWeeklySchedule(schedule, totalHours);
  const nominalHours = Math.max(4, testItem.nominalShelfLifeDays * 24);

  const meanConditions = {
    temperatureC: Number(
      (schedule.reduce((sum, d) => sum + d.temperatureC, 0) / schedule.length).toFixed(2),
    ),
    humidityPct: Number(
      (schedule.reduce((sum, d) => sum + d.humidityPct, 0) / schedule.length).toFixed(1),
    ),
    vocPpm: Number(
      (schedule.reduce((sum, d) => sum + d.vocPpm, 0) / schedule.length).toFixed(2),
    ),
    pressureHpa: Number(
      (schedule.reduce((sum, d) => sum + d.pressureHpa, 0) / schedule.length).toFixed(2),
    ),
  };

  // Uncalibrated cumulative effective hours (gain = 1.0, vocOffset = 0)
  const uncalibratedCumulative: number[] = [testItem.storedHours];
  let accRaw = testItem.storedHours;
  for (let h = 1; h < hourlyEnv.length; h++) {
    const env = hourlyEnv[h];
    const factors = computeFactorMultipliers(
      testItem.category,
      testItem.packaging,
      env,
      currentBaseline,
      0,
    );
    const rate = factors.thermal * factors.moisture * factors.voc * factors.pressure;
    accRaw += rate;
    uncalibratedCumulative.push(accRaw);
  }

  const uncalibratedEndProbPct = ageRatioToExpirationPct(
    uncalibratedCumulative[uncalibratedCumulative.length - 1] / nominalHours,
  );
  const rawErrorPct = Number(Math.abs(uncalibratedEndProbPct - observedEndSpoilagePct).toFixed(1));

  // Grid + refinement search over (gain in [0.25, 3.5], vocOffset in [-0.35, 0.75])
  let bestGain = 1.0;
  let bestVocOffset = 0.0;
  let bestLoss = Number.POSITIVE_INFINITY;

  const evalCalibration = (gain: number, vocOffset: number) => {
    let acc = testItem.storedHours;
    for (let h = 1; h < hourlyEnv.length; h++) {
      const env = hourlyEnv[h];
      const factors = computeFactorMultipliers(
        testItem.category,
        testItem.packaging,
        env,
        currentBaseline,
        vocOffset,
      );
      const rate = Math.max(
        0.1,
        factors.thermal * factors.moisture * factors.voc * factors.pressure * gain,
      );
      acc += rate;
    }
    const endProb = ageRatioToExpirationPct(acc / nominalHours);
    const err = Math.abs(endProb - observedEndSpoilagePct);
    const reg = 0.04 * Math.abs(gain - 1.0) + 0.08 * Math.abs(vocOffset);
    return { err, loss: err + reg, endProb };
  };

  for (let g = 0.25; g <= 3.5; g += 0.08) {
    for (let v = -0.35; v <= 0.75; v += 0.08) {
      const res = evalCalibration(g, v);
      if (res.loss < bestLoss) {
        bestLoss = res.loss;
        bestGain = Number(g.toFixed(3));
        bestVocOffset = Number(v.toFixed(3));
      }
    }
  }

  // Local fine refinement around best grid candidate
  for (let dg = -0.08; dg <= 0.08; dg += 0.015) {
    for (let dv = -0.08; dv <= 0.08; dv += 0.015) {
      const g = Math.max(0.2, Math.min(3.8, bestGain + dg));
      const v = Math.max(-0.4, Math.min(0.8, bestVocOffset + dv));
      const res = evalCalibration(g, v);
      if (res.loss < bestLoss) {
        bestLoss = res.loss;
        bestGain = Number(g.toFixed(3));
        bestVocOffset = Number(v.toFixed(3));
      }
    }
  }

  const hourlyPoints: WeeklySimulationPoint[] = [];
  let accCal = testItem.storedHours;

  for (let h = 0; h < hourlyEnv.length; h++) {
    const env = hourlyEnv[h];
    if (h > 0) {
      const factors = computeFactorMultipliers(
        testItem.category,
        testItem.packaging,
        env,
        currentBaseline,
        bestVocOffset,
      );
      const calRate = Math.max(
        0.1,
        factors.thermal * factors.moisture * factors.voc * factors.pressure * bestGain,
      );
      accCal += calRate;
    }

    hourlyPoints.push({
      hour: env.hour,
      dayLabel: env.dayLabel,
      temperatureC: env.temperatureC,
      humidityPct: env.humidityPct,
      vocPpm: env.vocPpm,
      pressureHpa: env.pressureHpa,
      uncalibratedProbPct: ageRatioToExpirationPct(uncalibratedCumulative[h] / nominalHours),
      calibratedProbPct: ageRatioToExpirationPct(accCal / nominalHours),
    });
  }

  const calibratedEndProbPct = hourlyPoints[hourlyPoints.length - 1].calibratedProbPct;
  const calibratedErrorPct = Number(
    Math.abs(calibratedEndProbPct - observedEndSpoilagePct).toFixed(1),
  );
  const accuracyPct = Number(Math.max(0, Math.min(99.9, 100 - calibratedErrorPct)).toFixed(1));

  return {
    fittedGain: bestGain,
    fittedVocOffsetPpm: bestVocOffset,
    uncalibratedEndProbPct,
    calibratedEndProbPct,
    rawErrorPct,
    calibratedErrorPct,
    accuracyPct,
    totalDays,
    totalHours,
    meanConditions,
    hourlyPoints,
  };
}

export function simulateItemOverDays(
  item: FoodItem,
  schedule: WeeklyDaySchedule[],
  currentReading: Pick<BME688Reading, 'temperatureC' | 'humidityPct' | 'vocPpm' | 'pressureHpa'>,
  baseline: PantryBaseline,
  daysToSkip: number,
  fittedGain = baseline.decaySensitivityGain,
  fittedVocOffsetPpm = baseline.vocDriftOffsetPpm,
  nowMs = Date.now(),
): SpoilageAssessment {
  const candidateBaseline: PantryBaseline = {
    ...baseline,
    decaySensitivityGain: fittedGain,
    vocDriftOffsetPpm: fittedVocOffsetPpm,
  };

  if (daysToSkip <= 0) {
    return assessFoodItem(item, currentReading, candidateBaseline, nowMs);
  }

  const baseAssessment = assessFoodItem(item, currentReading, candidateBaseline, nowMs);
  const totalSkipHours = Math.min(720, Math.max(0, Math.round(daysToSkip * 24)));
  const hourlyEnv = interpolateWeeklySchedule(schedule, totalSkipHours);
  const nominalHours = Math.max(4, item.nominalShelfLifeDays * 24);

  let effectiveAgeHours = baseAssessment.effectiveAgeHours;
  let lastRate = baseAssessment.effectiveDecayRate;
  let lastFactors = baseAssessment.factorMultipliers;
  const targetThresholdHours = nominalHours * 0.91;
  let crossedAtHour: number | null =
    baseAssessment.effectiveAgeHours >= targetThresholdHours ? 0 : null;

  for (let h = 1; h <= totalSkipHours; h++) {
    const env = hourlyEnv[h];
    lastFactors = computeFactorMultipliers(
      item.category,
      item.packaging,
      env,
      candidateBaseline,
      fittedVocOffsetPpm,
      item.specs ? { min: item.specs.optimalRhMin, max: item.specs.optimalRhMax } : undefined,
    );
    lastRate = Math.max(
      0.1,
      lastFactors.thermal * lastFactors.moisture * lastFactors.voc * lastFactors.pressure * fittedGain,
    );
    const prevAge = effectiveAgeHours;
    effectiveAgeHours += lastRate;

    if (crossedAtHour === null && effectiveAgeHours >= targetThresholdHours) {
      const frac = (targetThresholdHours - prevAge) / Math.max(0.001, lastRate);
      crossedAtHour = h - 1 + Math.max(0, Math.min(1, frac));
    }
  }

  const ageRatio = effectiveAgeHours / nominalHours;
  const expirationLikelihoodPct = ageRatioToExpirationPct(ageRatio);

  let remainingSafeHours: number;
  if (baseAssessment.effectiveAgeHours >= targetThresholdHours) {
    remainingSafeHours = baseAssessment.remainingSafeHours - totalSkipHours;
  } else if (crossedAtHour !== null) {
    remainingSafeHours = -(totalSkipHours - crossedAtHour);
  } else {
    remainingSafeHours = (targetThresholdHours - effectiveAgeHours) / Math.max(0.1, lastRate);
  }

  const deviations: Array<{
    driver: SpoilageAssessment['dominantDriver'];
    score: number;
  }> = [
    { driver: 'Temperature', score: Math.abs(lastFactors.thermal - 1) },
    { driver: 'Humidity', score: Math.abs(lastFactors.moisture - 1) },
    { driver: 'VOC', score: Math.abs(lastFactors.voc - 1) },
    { driver: 'Pressure', score: Math.abs(lastFactors.pressure - 1) },
  ];
  deviations.sort((a, b) => b.score - a.score);
  const dominantDriver =
    deviations[0].score < 0.06 ? 'Elapsed Time' : deviations[0].driver;

  return {
    expirationLikelihoodPct,
    effectiveDecayRate: Number(lastRate.toFixed(3)),
    effectiveAgeHours: Number(effectiveAgeHours.toFixed(1)),
    remainingSafeHours: Number(remainingSafeHours.toFixed(1)),
    status: statusFromLikelihood(expirationLikelihoodPct),
    factorMultipliers: lastFactors,
    dominantDriver,
  };
}

export function formatDuration(hours: number): string {
  const abs = Math.abs(hours);
  if (abs < 24) {
    return `${Math.round(abs)}h`;
  }
  const days = Math.floor(abs / 24);
  const remHours = Math.round(abs % 24);
  if (remHours === 0) return `${days}d`;
  return `${days}d ${remHours}h`;
}

export function parseBME688Payload(rawInput: string): {
  readings: BME688Reading[];
  error: string | null;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { readings: [], error: 'Paste JSON or CSV sensor output first.' };
  }

  // Try JSON first (single object or array of objects)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const readings: BME688Reading[] = [];

      for (const obj of items) {
        if (!obj || typeof obj !== 'object') continue;
        const temp = Number(
          obj.temperature ?? obj.temperatureC ?? obj.temp ?? obj.temp_c ?? obj.t,
        );
        const rh = Number(
          obj.humidity ?? obj.humidityPct ?? obj.rh ?? obj.rh_pct ?? obj.h,
        );
        const voc = Number(
          obj.voc_ppm ?? obj.vocPpm ?? obj.voc ?? obj.bsec_voc ?? (obj.iaq ? obj.iaq / 120 : NaN),
        );
        const pressure = Number(
          obj.pressure ?? obj.pressureHpa ?? obj.pressure_hpa ?? obj.p ?? 1013.25,
        );

        if (
          Number.isFinite(temp) &&
          Number.isFinite(rh) &&
          Number.isFinite(voc) &&
          Number.isFinite(pressure)
        ) {
          readings.push(buildReading(temp, rh, voc, pressure));
        }
      }

      if (readings.length === 0) {
        return {
          readings: [],
          error:
            'JSON parsed, but required fields (temperature, humidity, voc_ppm, pressure_hpa) were not found.',
        };
      }
      return { readings, error: null };
    } catch {
      return { readings: [], error: 'Invalid JSON syntax in sensor payload.' };
    }
  }

  // Fallback to CSV / delimiter-separated rows
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const readings: BME688Reading[] = [];

  for (const line of lines) {
    // Skip header row if alphabetic
    if (/^[a-zA-Z_,\s;]+$/.test(line)) continue;
    const cols = line.split(/[,\t;]+/).map((c) => Number(c.trim()));
    if (cols.length >= 4 && cols.slice(0, 4).every(Number.isFinite)) {
      readings.push(buildReading(cols[0], cols[1], cols[2], cols[3]));
    }
  }

  if (readings.length === 0) {
    return {
      readings: [],
      error:
        'Could not parse CSV rows. Expected columns: temperature_c, humidity_pct, voc_ppm, pressure_hpa.',
    };
  }

  return { readings, error: null };
}
