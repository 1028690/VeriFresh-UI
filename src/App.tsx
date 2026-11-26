import { useEffect, useMemo, useState } from 'react';
import { AddFoodModal } from './components/AddFoodModal';
import { CalibrationLabView } from './components/CalibrationLabView';
import { CustomerFoodGrid } from './components/CustomerFoodGrid';
import { ExplorePlansView, PLAN_TIERS } from './components/ExplorePlansView';
import { InventoryManagerView } from './components/InventoryManagerView';
import { PantryVisualHero } from './components/PantryVisualHero';
import { SensorStreamView } from './components/SensorStreamView';
import { TopBar } from './components/TopBar';
import {
  DEFAULT_FOOD_ITEMS,
  DEFAULT_WEEKLY_SCHEDULE,
  SENSOR_PRESETS,
  STANDARD_PANTRY_BASELINE,
} from './data/presets';
import {
  buildReading,
  getScheduleReadingAtDay,
  hoursAgoToLocalTimestamp,
  simulateItemOverDays,
} from './engine/spoilageModel';
import {
  BME688Reading,
  FoodItem,
  PantryBaseline,
  PlanId,
  WeeklyDaySchedule,
  WorkspaceTab,
} from './types/sensor';

const STORAGE_KEYS = {
  items: 'pantrysense_bme688_items_v1',
  baseline: 'pantrysense_bme688_baseline_v1',
  schedule: 'pantrysense_bme688_schedule_v1',
  simulatedDays: 'pantrysense_bme688_sim_days_v1',
  plan: 'pantrysense_bme688_plan_v1',
};

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadItemsWithTimestamps(): FoodItem[] {
  const loaded = loadStored<FoodItem[]>(STORAGE_KEYS.items, DEFAULT_FOOD_ITEMS);
  return loaded.map((item) => ({
    ...item,
    addedAt: item.addedAt || hoursAgoToLocalTimestamp(item.storedHours || 0),
  }));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('monitor');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [baseline, setBaseline] = useState<PantryBaseline>(() =>
    loadStored(STORAGE_KEYS.baseline, STANDARD_PANTRY_BASELINE),
  );
  const [items, setItems] = useState<FoodItem[]>(loadItemsWithTimestamps);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyDaySchedule[]>(() =>
    loadStored(STORAGE_KEYS.schedule, DEFAULT_WEEKLY_SCHEDULE),
  );
  const [simulatedDays, setSimulatedDays] = useState<number>(() =>
    loadStored(STORAGE_KEYS.simulatedDays, 0),
  );
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>(() =>
    loadStored<PlanId>(STORAGE_KEYS.plan, 'free'),
  );

  const [reading, setReading] = useState<BME688Reading>(() =>
    buildReading(
      baseline.temperatureC,
      baseline.humidityPct,
      baseline.vocPpm,
      baseline.pressureHpa,
    ),
  );
  const [history, setHistory] = useState<BME688Reading[]>(() => [
    buildReading(
      baseline.temperatureC,
      baseline.humidityPct,
      baseline.vocPpm,
      baseline.pressureHpa,
    ),
  ]);
  const [isLiveStream, setIsLiveStream] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
    } catch {
      // Ignore storage quota errors
    }
  }, [items]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.baseline, JSON.stringify(baseline));
    } catch {
      // Ignore storage quota errors
    }
  }, [baseline]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.schedule, JSON.stringify(weeklySchedule));
    } catch {
      // Ignore storage quota errors
    }
  }, [weeklySchedule]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.simulatedDays, JSON.stringify(simulatedDays));
    } catch {
      // Ignore storage quota errors
    }
  }, [simulatedDays]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(currentPlanId));
    } catch {
      // Ignore storage quota errors
    }
  }, [currentPlanId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isLiveStream) return;
    const timer = window.setInterval(() => {
      setReading((prev) => {
        const jitterTemp = prev.temperatureC + (Math.random() - 0.5) * 0.14;
        const jitterRh = prev.humidityPct + (Math.random() - 0.5) * 0.45;
        const jitterVoc = Math.max(0.08, prev.vocPpm + (Math.random() - 0.5) * 0.04);
        const jitterPress = prev.pressureHpa + (Math.random() - 0.5) * 0.18;
        const next = buildReading(jitterTemp, jitterRh, jitterVoc, jitterPress, Date.now());
        setHistory((hist) => [...hist.slice(-59), next]);
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLiveStream]);

  useEffect(() => {
    if (!toastNotice) return;
    const id = window.setTimeout(() => setToastNotice(null), 4200);
    return () => window.clearTimeout(id);
  }, [toastNotice]);

  // Global simulated reading & global spoilage assessment across the entire UI
  const activeDisplayReading = useMemo(
    () => getScheduleReadingAtDay(weeklySchedule, simulatedDays, reading),
    [weeklySchedule, simulatedDays, reading],
  );

  const assessedRows = useMemo(
    () =>
      items.map((item) => ({
        item,
        assessment: simulateItemOverDays(
          item,
          weeklySchedule,
          reading,
          baseline,
          simulatedDays,
          baseline.decaySensitivityGain,
          baseline.vocDriftOffsetPpm,
          nowMs,
        ),
      })),
    [items, weeklySchedule, reading, baseline, simulatedDays, nowMs],
  );

  const syncSimulatedDayIfActive = (next: BME688Reading) => {
    if (simulatedDays <= 0) return;
    setWeeklySchedule((prev) => {
      if (prev.length === 0) return prev;
      const targetIdx = (simulatedDays - 1) % prev.length;
      return prev.map((day, idx) =>
        idx === targetIdx
          ? {
              ...day,
              temperatureC: next.temperatureC,
              humidityPct: next.humidityPct,
              vocPpm: next.vocPpm,
              pressureHpa: next.pressureHpa,
            }
          : day,
      );
    });
  };

  const pushReading = (next: BME688Reading) => {
    setReading(next);
    setHistory((hist) => [...hist.slice(-59), next]);
  };

  const handleUpdateChannel = (
    channel: 'temperatureC' | 'humidityPct' | 'vocPpm' | 'pressureHpa',
    value: number,
  ) => {
    if (!Number.isFinite(value)) return;
    const baseSource = simulatedDays > 0 ? activeDisplayReading : reading;
    const next = buildReading(
      channel === 'temperatureC' ? value : baseSource.temperatureC,
      channel === 'humidityPct' ? value : baseSource.humidityPct,
      channel === 'vocPpm' ? value : baseSource.vocPpm,
      channel === 'pressureHpa' ? value : baseSource.pressureHpa,
    );
    pushReading(next);
    syncSimulatedDayIfActive(next);
  };

  const handleApplyPreset = (presetId: string) => {
    if (presetId === 'pantry-normal') {
      const next = buildReading(
        baseline.temperatureC,
        baseline.humidityPct,
        baseline.vocPpm,
        baseline.pressureHpa,
      );
      pushReading(next);
      syncSimulatedDayIfActive(next);
      return;
    }
    const preset = SENSOR_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const next = buildReading(
      preset.temperatureC,
      preset.humidityPct,
      preset.vocPpm,
      preset.pressureHpa,
    );
    pushReading(next);
    syncSimulatedDayIfActive(next);
  };

  const handleSetCurrentAsDefault = () => {
    const source = activeDisplayReading;
    const nowLabel = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setBaseline((prev) => ({
      ...prev,
      temperatureC: source.temperatureC,
      humidityPct: source.humidityPct,
      vocPpm: source.vocPpm,
      pressureHpa: source.pressureHpa,
      calibratedAt: nowLabel,
      label: 'Custom Kitchen Pantry Default',
    }));
    setToastNotice(
      `Saved ${source.temperatureC.toFixed(1)} °C, ${source.humidityPct.toFixed(0)}% humidity as your normal kitchen pantry default.`,
    );
  };

  const handleIngestReadings = (newReadings: BME688Reading[]) => {
    if (newReadings.length === 0) return;
    const latest = newReadings[newReadings.length - 1];
    setHistory((prev) => [...prev, ...newReadings].slice(-60));
    setReading(latest);
    syncSimulatedDayIfActive(latest);
  };

  const handleAddItem = (newItem: FoodItem) => {
    setItems((prev) => [newItem, ...prev]);
    setToastNotice(`Added "${newItem.name}" to your pantry.`);
  };

  const handleUpdateItem = (updated: FoodItem) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleClearExpired = () => {
    const expiredIds = new Set(
      assessedRows
        .filter((r) => r.assessment.status === 'Likely Expired')
        .map((r) => r.item.id),
    );
    setItems((prev) => prev.filter((it) => !expiredIds.has(it.id)));
    setToastNotice(
      `Removed ${expiredIds.size} expired item${expiredIds.size === 1 ? '' : 's'} from inventory.`,
    );
  };

  const handleResetDefaultInventory = () => {
    const freshDefaults = DEFAULT_FOOD_ITEMS.map((item) => ({
      ...item,
      addedAt: hoursAgoToLocalTimestamp(item.storedHours),
    }));
    setItems(freshDefaults);
    setToastNotice('Restored sample pantry inventory.');
  };

  const maxScheduleDays = Math.max(28, weeklySchedule.length);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {simulatedDays > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-blue-950 font-medium">
              Simulation Active: <span className="font-mono font-semibold">+{simulatedDays} {simulatedDays === 1 ? 'Day' : 'Days'}</span>{' '}
              ({(simulatedDays / 7).toFixed(1)} wks) ahead · Showing {activeDisplayReading.temperatureC.toFixed(1)} °C,{' '}
              {activeDisplayReading.humidityPct.toFixed(0)}% RH from your calibration schedule
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSimulatedDays((d) => Math.max(0, d - 1))}
                className="px-2 py-1 font-mono bg-white border border-blue-200 rounded text-blue-900 hover:bg-blue-100"
              >
                -1d
              </button>
              <button
                type="button"
                disabled={simulatedDays >= maxScheduleDays}
                onClick={() => setSimulatedDays((d) => Math.min(maxScheduleDays, d + 1))}
                className="px-2 py-1 font-mono bg-white border border-blue-200 rounded text-blue-900 hover:bg-blue-100 disabled:opacity-40"
              >
                +1d
              </button>
              <button
                type="button"
                disabled={simulatedDays >= maxScheduleDays}
                onClick={() => setSimulatedDays((d) => Math.min(maxScheduleDays, d + 7))}
                className="px-2 py-1 font-mono bg-white border border-blue-200 rounded text-blue-900 hover:bg-blue-100 disabled:opacity-40"
              >
                +1w
              </button>
              <button
                type="button"
                onClick={() => setSimulatedDays(0)}
                className="px-2.5 py-1 font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reset to Today
              </button>
            </div>
          </div>
        </div>
      )}

      {toastNotice && (
        <div className="max-w-[1440px] w-full mx-auto px-6 pt-4">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-md px-4 py-2.5 flex items-center justify-between">
            <span>{toastNotice}</span>
            <button
              type="button"
              onClick={() => setToastNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 font-medium ml-4"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {activeTab === 'monitor' && (
          <div className="space-y-8">
            <PantryVisualHero
              reading={activeDisplayReading}
              baseline={baseline}
              isLiveStream={isLiveStream}
              onUpdateChannel={handleUpdateChannel}
              onApplyPreset={handleApplyPreset}
              onSetCurrentAsDefault={handleSetCurrentAsDefault}
              onToggleLiveStream={() => setIsLiveStream((v) => !v)}
            />

            <CustomerFoodGrid
              rows={assessedRows}
              baseline={baseline}
              simulatedDays={simulatedDays}
              nowMs={nowMs}
              onUpdateItem={handleUpdateItem}
              onRemoveItem={handleRemoveItem}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onOpenInventoryTab={() => setActiveTab('inventory')}
            />
          </div>
        )}

        {activeTab === 'inventory' && (
          <InventoryManagerView
            rows={assessedRows}
            simulatedDays={simulatedDays}
            nowMs={nowMs}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            onClearExpired={handleClearExpired}
            onResetDefaults={handleResetDefaultInventory}
            onInspectInMonitor={() => setActiveTab('monitor')}
          />
        )}

        {activeTab === 'stream' && (
          <SensorStreamView
            reading={activeDisplayReading}
            baseline={baseline}
            history={history}
            isLiveStream={isLiveStream}
            currentPlanId={currentPlanId}
            onToggleLiveStream={() => setIsLiveStream((v) => !v)}
            onUpdateChannel={handleUpdateChannel}
            onApplyPreset={handleApplyPreset}
            onSetCurrentAsDefault={handleSetCurrentAsDefault}
            onIngestReadings={handleIngestReadings}
            onOpenPlansTab={() => setActiveTab('plans')}
          />
        )}

        {activeTab === 'calibration' && (
          <CalibrationLabView
            reading={reading}
            schedule={weeklySchedule}
            onChangeSchedule={setWeeklySchedule}
            simulatedDays={simulatedDays}
            onChangeSimulatedDays={setSimulatedDays}
            items={items}
            baseline={baseline}
            onApplyCalibration={(next, syncReading) => {
              setBaseline(next);
              if (syncReading) {
                pushReading(
                  buildReading(
                    next.temperatureC,
                    next.humidityPct,
                    next.vocPpm,
                    next.pressureHpa,
                  ),
                );
              }
              setToastNotice(
                `Calibration applied (${next.decaySensitivityGain.toFixed(2)}x gain · ${next.calibrationAccuracyPct.toFixed(1)}% accuracy)${syncReading ? ' and pantry readings synced.' : '.'}`,
              );
            }}
            onResetStandardBaseline={() => setBaseline(STANDARD_PANTRY_BASELINE)}
          />
        )}

        {activeTab === 'plans' && (
          <ExplorePlansView
            currentPlanId={currentPlanId}
            onSelectPlan={(planId) => {
              setCurrentPlanId(planId);
              const selected = PLAN_TIERS.find((p) => p.id === planId);
              if (selected) {
                setToastNotice(
                  `Switched active workspace plan to ${selected.name} (${selected.sensorRangeLabel}).`,
                );
              }
            }}
            onOpenSensorsTab={() => setActiveTab('stream')}
          />
        )}
      </main>

      <AddFoodModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={(item) => {
          handleAddItem(item);
          setActiveTab('monitor');
        }}
      />
    </div>
  );
}
