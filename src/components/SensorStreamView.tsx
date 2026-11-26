import { useState } from 'react';
import { Upload, Play, Square, BookmarkCheck } from 'lucide-react';
import { SENSOR_PRESETS } from '../data/presets';
import { parseBME688Payload } from '../engine/spoilageModel';
import { BME688Reading, PantryBaseline, PlanId } from '../types/sensor';
import { PLAN_TIERS } from './ExplorePlansView';

interface SensorStreamViewProps {
  reading: BME688Reading;
  baseline: PantryBaseline;
  history: BME688Reading[];
  isLiveStream: boolean;
  currentPlanId: PlanId;
  onToggleLiveStream: () => void;
  onUpdateChannel: (
    channel: 'temperatureC' | 'humidityPct' | 'vocPpm' | 'pressureHpa',
    value: number,
  ) => void;
  onApplyPreset: (presetId: string) => void;
  onSetCurrentAsDefault: () => void;
  onIngestReadings: (readings: BME688Reading[]) => void;
  onOpenPlansTab: () => void;
}

const SAMPLE_JSON_PAYLOAD = `{
  "sensor": "BME688",
  "temperature_c": 22.8,
  "humidity_pct": 61.5,
  "voc_ppm": 1.42,
  "pressure_hpa": 1009.4
}`;

const SAMPLE_CSV_PAYLOAD = `temperature_c,humidity_pct,voc_ppm,pressure_hpa
20.6,48.5,0.34,1013.2
21.4,52.0,0.48,1012.6
22.9,58.4,0.95,1011.1
24.1,64.2,1.76,1009.8`;

export function SensorStreamView({
  reading,
  baseline,
  history,
  isLiveStream,
  currentPlanId,
  onToggleLiveStream,
  onUpdateChannel,
  onApplyPreset,
  onSetCurrentAsDefault,
  onIngestReadings,
  onOpenPlansTab,
}: SensorStreamViewProps) {
  const activePlan = PLAN_TIERS.find((p) => p.id === currentPlanId) ?? PLAN_TIERS[0];
  const [rawText, setRawText] = useState(SAMPLE_JSON_PAYLOAD);
  const [parseMessage, setParseMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );

  const handleApplyPayload = () => {
    const { readings, error } = parseBME688Payload(rawText);
    if (error) {
      setParseMessage({ type: 'err', text: error });
      return;
    }
    onIngestReadings(readings);
    const latest = readings[readings.length - 1];
    setParseMessage({
      type: 'ok',
      text: `Loaded ${readings.length} sensor reading${readings.length > 1 ? 's' : ''}: ${latest.temperatureC.toFixed(1)} °C, ${latest.humidityPct.toFixed(1)}% RH, ${latest.vocPpm.toFixed(2)} ppm VOC, ${latest.pressureHpa.toFixed(1)} hPa.`,
    });
  };

  const width = 760;
  const height = 190;
  const pad = { top: 16, right: 20, bottom: 26, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const slice = history.slice(-40);
  const count = Math.max(1, slice.length - 1);
  const toX = (idx: number) => pad.left + (idx / count) * plotW;

  const makeLine = (values: number[], min: number, max: number) =>
    values
      .map((v, idx) => {
        const norm = Math.max(0, Math.min(1, (v - min) / Math.max(0.01, max - min)));
        const y = pad.top + (1 - norm) * plotH;
        return `${idx === 0 ? 'M' : 'L'} ${toX(idx).toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  const tempLine = makeLine(slice.map((r) => r.temperatureC), 10, 35);
  const rhLine = makeLine(slice.map((r) => r.humidityPct), 20, 90);
  const vocLine = makeLine(slice.map((r) => r.vocPpm), 0.1, 4.0);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-md p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Bosch BME688 Sensor Input &amp; Live Feed
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Adjust room sensor values manually, pick an environment preset, or paste JSON/CSV readings from your BME688 hardware.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>
                Active Tier: <strong className="text-slate-900">{activePlan.name}</strong> ({activePlan.sensorRangeLabel})
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenPlansTab}
                className="text-blue-700 hover:underline font-medium whitespace-nowrap"
              >
                Explore Plans for more sensors
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSetCurrentAsDefault}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200/70 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
              Save as Pantry Default
            </button>
            <button
              type="button"
              onClick={onToggleLiveStream}
              className={`px-4 py-2 text-xs font-medium rounded border transition-colors flex items-center gap-2 whitespace-nowrap ${
                isLiveStream
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isLiveStream ? (
                <>
                  <Square className="w-3.5 h-3.5" aria-hidden="true" />
                  Stop 1Hz Sampling
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  Start 1Hz Sampling
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-200 rounded p-3.5 bg-slate-50/60">
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="stream-temp" className="font-medium text-slate-700">
                Temperature (°C)
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {reading.temperatureC.toFixed(1)} °C
              </span>
            </div>
            <input
              id="stream-temp"
              type="range"
              min={0}
              max={40}
              step={0.1}
              value={reading.temperatureC}
              onChange={(e) => onUpdateChannel('temperatureC', Number(e.target.value))}
              className="w-full cursor-pointer"
            />
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Default: {baseline.temperatureC.toFixed(1)} °C
            </div>
          </div>

          <div className="border border-slate-200 rounded p-3.5 bg-slate-50/60">
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="stream-rh" className="font-medium text-slate-700">
                Humidity (% RH)
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {reading.humidityPct.toFixed(1)}%
              </span>
            </div>
            <input
              id="stream-rh"
              type="range"
              min={15}
              max={95}
              step={0.5}
              value={reading.humidityPct}
              onChange={(e) => onUpdateChannel('humidityPct', Number(e.target.value))}
              className="w-full cursor-pointer"
            />
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Default: {baseline.humidityPct.toFixed(0)}% RH
            </div>
          </div>

          <div className="border border-slate-200 rounded p-3.5 bg-slate-50/60">
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="stream-voc" className="font-medium text-slate-700">
                VOC Gas (ppm)
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {reading.vocPpm.toFixed(2)} ppm
              </span>
            </div>
            <input
              id="stream-voc"
              type="range"
              min={0.1}
              max={6.0}
              step={0.05}
              value={Math.min(6.0, reading.vocPpm)}
              onChange={(e) => onUpdateChannel('vocPpm', Number(e.target.value))}
              className="w-full cursor-pointer"
            />
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              IAQ {reading.iaqIndex} · {reading.gasResistanceKOhm} kΩ
            </div>
          </div>

          <div className="border border-slate-200 rounded p-3.5 bg-slate-50/60">
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="stream-press" className="font-medium text-slate-700">
                Pressure (hPa)
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {reading.pressureHpa.toFixed(1)} hPa
              </span>
            </div>
            <input
              id="stream-press"
              type="range"
              min={970}
              max={1040}
              step={0.25}
              value={reading.pressureHpa}
              onChange={(e) => onUpdateChannel('pressureHpa', Number(e.target.value))}
              className="w-full cursor-pointer"
            />
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Default: {baseline.pressureHpa.toFixed(1)} hPa
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600 mr-1">Quick Presets:</span>
          {SENSOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset.id)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-100">
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="bme688-payload" className="text-xs font-semibold text-slate-800">
                Paste BME688 JSON / CSV Data
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRawText(SAMPLE_JSON_PAYLOAD);
                    setParseMessage(null);
                  }}
                  className="text-xs text-blue-700 hover:underline"
                >
                  JSON Sample
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setRawText(SAMPLE_CSV_PAYLOAD);
                    setParseMessage(null);
                  }}
                  className="text-xs text-blue-700 hover:underline"
                >
                  CSV Sample
                </button>
              </div>
            </div>

            <textarea
              id="bme688-payload"
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              spellCheck={false}
              className="w-full font-mono text-xs border border-slate-200 rounded-md p-3 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            <button
              type="button"
              onClick={handleApplyPayload}
              className="w-full px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              Apply Sensor Readings
            </button>

            {parseMessage && (
              <div
                className={`text-xs rounded border p-3 ${
                  parseMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {parseMessage.text}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="border border-slate-200 rounded-md p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-800">
                  Recent Sensor Readings ({slice.length} Samples)
                </span>
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 bg-blue-600" aria-hidden="true" />
                    Temp
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 bg-cyan-600" aria-hidden="true" />
                    Humidity
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 bg-amber-600" aria-hidden="true" />
                    VOC
                  </span>
                </div>
              </div>

              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                {[0.25, 0.5, 0.75].map((f) => (
                  <line
                    key={f}
                    x1={pad.left}
                    y1={pad.top + f * plotH}
                    x2={width - pad.right}
                    y2={pad.top + f * plotH}
                    stroke="#f1f5f9"
                  />
                ))}
                <path d={tempLine} fill="none" stroke="#2563eb" strokeWidth={1.75} />
                <path d={rhLine} fill="none" stroke="#0891b2" strokeWidth={1.75} />
                <path d={vocLine} fill="none" stroke="#d97706" strokeWidth={1.75} />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
