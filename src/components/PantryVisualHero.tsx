import { useState } from 'react';
import { SlidersHorizontal, BookmarkCheck } from 'lucide-react';
import { SENSOR_PRESETS } from '../data/presets';
import { BME688Reading, PantryBaseline } from '../types/sensor';
import { PANTRY_HERO_IMAGE, ResilientImage } from './CategoryVisual';

interface PantryVisualHeroProps {
  reading: BME688Reading;
  baseline: PantryBaseline;
  isLiveStream: boolean;
  onUpdateChannel: (
    channel: 'temperatureC' | 'humidityPct' | 'vocPpm' | 'pressureHpa',
    value: number,
  ) => void;
  onApplyPreset: (presetId: string) => void;
  onSetCurrentAsDefault: () => void;
  onToggleLiveStream: () => void;
}

interface MeterSpec {
  label: string;
  valueText: string;
  min: number;
  max: number;
  current: number;
  idealMin: number;
  idealMax: number;
  statusLabel: string;
  isAlert: boolean;
}

export function PantryVisualHero({
  reading,
  baseline,
  isLiveStream,
  onUpdateChannel,
  onApplyPreset,
  onSetCurrentAsDefault,
  onToggleLiveStream,
}: PantryVisualHeroProps) {
  const [showSliders, setShowSliders] = useState(false);

  const tempDiff = reading.temperatureC - baseline.temperatureC;
  const rhDiff = reading.humidityPct - baseline.humidityPct;
  const vocHigh = reading.vocPpm > Math.max(0.85, baseline.vocPpm * 2.2);

  const overallHealthy =
    Math.abs(tempDiff) <= 3 &&
    reading.humidityPct >= 35 &&
    reading.humidityPct <= 62 &&
    !vocHigh;

  const meters: MeterSpec[] = [
    {
      label: 'Temperature',
      valueText: `${reading.temperatureC.toFixed(1)} °C`,
      min: 5,
      max: 38,
      current: reading.temperatureC,
      idealMin: Math.max(5, baseline.temperatureC - 2.5),
      idealMax: Math.min(38, baseline.temperatureC + 2.5),
      statusLabel:
        tempDiff > 2.5 ? 'Warm' : tempDiff < -2.5 ? 'Cool' : 'Normal Pantry',
      isAlert: tempDiff > 2.5,
    },
    {
      label: 'Humidity',
      valueText: `${reading.humidityPct.toFixed(0)}%`,
      min: 15,
      max: 95,
      current: reading.humidityPct,
      idealMin: Math.max(15, baseline.humidityPct - 10),
      idealMax: Math.min(95, baseline.humidityPct + 10),
      statusLabel:
        rhDiff > 10
          ? 'Humid'
          : rhDiff < -10
          ? 'Dry'
          : 'Normal Pantry',
      isAlert: Math.abs(rhDiff) > 12,
    },
    {
      label: 'Air Freshness (VOC)',
      valueText: `${reading.vocPpm.toFixed(2)} ppm`,
      min: 0.1,
      max: 4.5,
      current: Math.min(4.5, reading.vocPpm),
      idealMin: 0.1,
      idealMax: Math.max(0.65, baseline.vocPpm * 1.8),
      statusLabel: vocHigh
        ? 'Spoilage Gas Detected'
        : reading.vocPpm > Math.max(0.7, baseline.vocPpm * 1.5)
        ? 'Elevated'
        : 'Clean Air',
      isAlert: vocHigh,
    },
    {
      label: 'Air Pressure',
      valueText: `${reading.pressureHpa.toFixed(0)} hPa`,
      min: 975,
      max: 1040,
      current: reading.pressureHpa,
      idealMin: Math.max(975, baseline.pressureHpa - 10),
      idealMax: Math.min(1040, baseline.pressureHpa + 10),
      statusLabel:
        Math.abs(reading.pressureHpa - baseline.pressureHpa) > 10
          ? 'Weather Shift'
          : 'Steady',
      isAlert: false,
    },
  ];

  return (
    <section className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-5 relative min-h-[240px] bg-slate-100">
          <ResilientImage
            src={PANTRY_HERO_IMAGE}
            alt="Kitchen pantry shelf with fresh bread, strawberries, jars, and environmental sensor"
            label="Pantry Sensor Overview"
            className="w-full h-full lg:h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent flex flex-col justify-end p-5 text-white">
            <div className="text-xs font-medium text-slate-200">
              {overallHealthy
                ? '● Ideal Kitchen Pantry Conditions'
                : '▲ Pantry Conditions Need Attention'}
            </div>
            <h1 className="text-xl font-semibold tracking-tight mt-1 text-balance">
              {overallHealthy
                ? 'Your pantry air is fresh and steady.'
                : vocHigh
                ? 'Elevated spoilage gases detected in pantry air.'
                : 'Warmth or humidity is speeding up food aging.'}
            </h1>
            <p className="text-xs text-slate-200 mt-1">
              Default: {baseline.temperatureC.toFixed(1)} °C ·{' '}
              {baseline.humidityPct.toFixed(0)}% humidity ·{' '}
              Calibration: {baseline.decaySensitivityGain.toFixed(2)}x{' '}
              {baseline.calibratedAt ? `(Updated ${baseline.calibratedAt})` : '(Standard)'}
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 p-6 flex flex-col justify-between gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Current Pantry Environment
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live readings from your BME688 sensor compared to ideal kitchen storage
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSliders((s) => !s)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200/70 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              {showSliders ? 'Hide Controls' : 'Adjust Conditions'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {meters.map((m) => {
              const pct = Math.max(
                2,
                Math.min(98, ((m.current - m.min) / (m.max - m.min)) * 100),
              );
              const idealLeft = Math.max(
                0,
                ((m.idealMin - m.min) / (m.max - m.min)) * 100,
              );
              const idealWidth = Math.min(
                100 - idealLeft,
                ((m.idealMax - m.idealMin) / (m.max - m.min)) * 100,
              );

              return (
                <div
                  key={m.label}
                  className="border border-slate-200 rounded-md p-3.5 bg-slate-50/50"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">
                      {m.label}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        m.isAlert ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {m.statusLabel}
                    </span>
                  </div>

                  <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
                    {m.valueText}
                  </div>

                  <div className="mt-2.5 relative h-2 bg-slate-200 rounded-sm overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 bg-emerald-200"
                      style={{
                        left: `${idealLeft}%`,
                        width: `${idealWidth}%`,
                      }}
                      title="Ideal kitchen pantry zone"
                    />
                    <div
                      className={`absolute top-0 bottom-0 w-1.5 -ml-0.5 rounded-sm ${
                        m.isAlert ? 'bg-amber-600' : 'bg-blue-600'
                      }`}
                      style={{ left: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              {SENSOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyPreset(preset.id)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:border-blue-400 hover:bg-blue-50/40 transition-colors whitespace-nowrap"
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onSetCurrentAsDefault}
              className="px-3 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1 whitespace-nowrap"
            >
              <BookmarkCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Save as Pantry Default
            </button>
          </div>

          {showSliders && (
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="simple-temp" className="font-medium text-slate-700">
                    Temperature (°C)
                  </label>
                  <span className="font-mono tabular-nums text-slate-900">
                    {reading.temperatureC.toFixed(1)} °C
                  </span>
                </div>
                <input
                  id="simple-temp"
                  type="range"
                  min={0}
                  max={38}
                  step={0.5}
                  value={reading.temperatureC}
                  onChange={(e) => onUpdateChannel('temperatureC', Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="simple-rh" className="font-medium text-slate-700">
                    Humidity (%)
                  </label>
                  <span className="font-mono tabular-nums text-slate-900">
                    {reading.humidityPct.toFixed(0)}%
                  </span>
                </div>
                <input
                  id="simple-rh"
                  type="range"
                  min={15}
                  max={95}
                  step={1}
                  value={reading.humidityPct}
                  onChange={(e) => onUpdateChannel('humidityPct', Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="simple-voc" className="font-medium text-slate-700">
                    Air Freshness / VOC (ppm)
                  </label>
                  <span className="font-mono tabular-nums text-slate-900">
                    {reading.vocPpm.toFixed(2)} ppm
                  </span>
                </div>
                <input
                  id="simple-voc"
                  type="range"
                  min={0.1}
                  max={5.0}
                  step={0.05}
                  value={Math.min(5.0, reading.vocPpm)}
                  onChange={(e) => onUpdateChannel('vocPpm', Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="simple-press" className="font-medium text-slate-700">
                    Air Pressure (hPa)
                  </label>
                  <span className="font-mono tabular-nums text-slate-900">
                    {reading.pressureHpa.toFixed(0)} hPa
                  </span>
                </div>
                <input
                  id="simple-press"
                  type="range"
                  min={975}
                  max={1040}
                  step={1}
                  value={reading.pressureHpa}
                  onChange={(e) => onUpdateChannel('pressureHpa', Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={onToggleLiveStream}
                  className="text-xs font-medium text-slate-700 underline hover:text-slate-900"
                >
                  {isLiveStream ? 'Pause live 1Hz sensor jitter' : 'Simulate live 1Hz sensor readings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
