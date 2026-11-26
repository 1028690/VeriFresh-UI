import { useMemo, useState, type FormEvent } from 'react';
import { Trash2, Plus, Search, Loader2 } from 'lucide-react';
import {
  CATEGORY_PROFILES,
  computeElapsedHours,
  formatDuration,
  formatTimestampLabel,
  getEffectiveStoredHours,
  hoursAgoToLocalTimestamp,
  toLocalDateTimeInput,
} from '../engine/spoilageModel';
import { lookupProductSpecs } from '../services/productLookup';
import {
  FoodCategory,
  FoodItem,
  PackagingType,
  SpoilageAssessment,
  SpoilageStatus,
} from '../types/sensor';
import { CategoryImage } from './CategoryVisual';

interface InventoryRow {
  item: FoodItem;
  assessment: SpoilageAssessment;
}

interface InventoryManagerViewProps {
  rows: InventoryRow[];
  simulatedDays: number;
  nowMs: number;
  onAddItem: (item: FoodItem) => void;
  onUpdateItem: (item: FoodItem) => void;
  onRemoveItem: (id: string) => void;
  onClearExpired: () => void;
  onResetDefaults: () => void;
  onInspectInMonitor: (id: string) => void;
}

const CATEGORIES: FoodCategory[] = [
  'Produce',
  'Bakery',
  'Dairy & Chilled',
  'Dry Goods',
  'Oils & Condiments',
  'Meat & Protein',
];

const PACKAGINGS: PackagingType[] = ['Unsealed', 'Resealable', 'Airtight'];

const TIMESTAMP_OFFSETS = [
  { label: 'Now', hoursAgo: 0 },
  { label: '-6h', hoursAgo: 6 },
  { label: '-24h', hoursAgo: 24 },
  { label: '-3d', hoursAgo: 72 },
  { label: '-7d', hoursAgo: 168 },
];

const STATUS_STYLE: Record<SpoilageStatus, { glyph: string; textClass: string }> = {
  Fresh: { glyph: '●', textClass: 'text-emerald-700' },
  Watch: { glyph: '▲', textClass: 'text-amber-700' },
  'High Risk': { glyph: '◆', textClass: 'text-orange-700' },
  'Likely Expired': { glyph: '✖', textClass: 'text-rose-700' },
};

export function InventoryManagerView({
  rows,
  simulatedDays,
  nowMs,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onClearExpired,
  onResetDefaults,
  onInspectInMonitor,
}: InventoryManagerViewProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Produce');
  const [packaging, setPackaging] = useState<PackagingType>('Resealable');
  const [nominalShelfLifeDays, setNominalShelfLifeDays] = useState<number>(
    CATEGORY_PROFILES.Produce.defaultShelfLifeDays,
  );
  const [addedAt, setAddedAt] = useState<string>(() => toLocalDateTimeInput(new Date()));
  const [optimalTempC, setOptimalTempC] = useState<string>('');
  const [optimalRhMin, setOptimalRhMin] = useState<string>('');
  const [optimalRhMax, setOptimalRhMax] = useState<string>('');
  const [vocRiskNote, setVocRiskNote] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(({ item }) => {
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.notes?.toLowerCase().includes(q) ?? false);
      const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesQuery && matchesCat;
    });
  }, [rows, searchQuery, categoryFilter]);

  const expiredCount = useMemo(
    () => rows.filter((r) => r.assessment.status === 'Likely Expired').length,
    [rows],
  );

  const handleCategoryChange = (nextCategory: FoodCategory) => {
    setCategory(nextCategory);
    setNominalShelfLifeDays(CATEGORY_PROFILES[nextCategory].defaultShelfLifeDays);
  };

  const handleLookupSpecs = async () => {
    const query = name.trim();
    if (!query) {
      setLookupStatus({ type: 'err', text: 'Enter a product name first to look up specs.' });
      return;
    }

    setIsLookingUp(true);
    setLookupStatus(null);
    try {
      const specs = await lookupProductSpecs(query, packaging);
      setName(specs.canonicalName);
      setCategory(specs.category);
      setPackaging(specs.recommendedPackaging);
      setNominalShelfLifeDays(specs.nominalShelfLifeDays);
      setOptimalTempC(String(specs.optimalTempC));
      setOptimalRhMin(String(specs.optimalRhMin));
      setOptimalRhMax(String(specs.optimalRhMax));
      setVocRiskNote(specs.vocRiskNote);
      setLookupStatus({
        type: 'ok',
        text: `Loaded AI specs for "${specs.canonicalName}": ${specs.nominalShelfLifeDays}d pantry life, optimal ${specs.optimalTempC}°C / ${specs.optimalRhMin}–${specs.optimalRhMax}% RH.`,
      });
    } catch (error) {
      setLookupStatus({
        type: 'err',
        text: error instanceof Error ? error.message : 'Failed to look up product specs.',
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const cleanTimestamp = addedAt || toLocalDateTimeInput(new Date());
    const elapsed = computeElapsedHours(cleanTimestamp);

    const parsedTemp = Number(optimalTempC);
    const parsedRhMin = Number(optimalRhMin);
    const parsedRhMax = Number(optimalRhMax);
    const hasSpecs =
      Boolean(vocRiskNote.trim()) ||
      Number.isFinite(parsedTemp) ||
      Number.isFinite(parsedRhMin);

    onAddItem({
      id: `item-${Date.now()}`,
      name: trimmed,
      category,
      packaging,
      nominalShelfLifeDays: Math.max(0.25, nominalShelfLifeDays),
      storedHours: elapsed,
      addedAt: cleanTimestamp,
      notes: notes.trim() || undefined,
      specs: hasSpecs
        ? {
            optimalTempC: Number.isFinite(parsedTemp) ? parsedTemp : undefined,
            optimalRhMin: Number.isFinite(parsedRhMin) ? parsedRhMin : undefined,
            optimalRhMax: Number.isFinite(parsedRhMax) ? parsedRhMax : undefined,
            vocRiskNote: vocRiskNote.trim() || undefined,
            source: lookupStatus?.type === 'ok' ? 'AI Lookup' : 'Manual',
          }
        : undefined,
    });

    setName('');
    setNotes('');
    setOptimalTempC('');
    setOptimalRhMin('');
    setOptimalRhMax('');
    setVocRiskNote('');
    setLookupStatus(null);
    setAddedAt(toLocalDateTimeInput(new Date()));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-md p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Pantry Inventory &amp; Product Spec Lookup
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Add food items with exact storage timestamps, look up realistic shelf-life and humidity/VOC specs with AI, or remove items from your pantry.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {expiredCount > 0 && (
              <button
                type="button"
                onClick={onClearExpired}
                className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 transition-colors whitespace-nowrap"
              >
                Remove Expired ({expiredCount})
              </button>
            )}
            <button
              type="button"
              onClick={onResetDefaults}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              Restore Sample Inventory
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-5">
              <label htmlFor="inv-name" className="block text-xs font-medium text-slate-700 mb-1">
                Product Name
              </label>
              <div className="flex gap-2">
                <input
                  id="inv-name"
                  type="text"
                  required
                  placeholder="e.g., Fresh Figs, Opened Almond Milk, Baguette"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 border border-slate-200 rounded px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={handleLookupSpecs}
                  disabled={isLookingUp}
                  className="px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-60 transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0"
                >
                  {isLookingUp ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      Looking up…
                    </>
                  ) : (
                    'Lookup Specs (AI)'
                  )}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="inv-category" className="block text-xs font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                id="inv-category"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as FoodCategory)}
                className="w-full text-xs border border-slate-200 rounded px-2.5 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="inv-packaging" className="block text-xs font-medium text-slate-700 mb-1">
                Packaging
              </label>
              <select
                id="inv-packaging"
                value={packaging}
                onChange={(e) => setPackaging(e.target.value as PackagingType)}
                className="w-full text-xs border border-slate-200 rounded px-2.5 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {PACKAGINGS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="inv-life" className="block text-xs font-medium text-slate-700 mb-1">
                Pantry Shelf Life (days)
              </label>
              <input
                id="inv-life"
                type="number"
                step={0.25}
                min={0.25}
                max={1095}
                value={nominalShelfLifeDays}
                onChange={(e) => setNominalShelfLifeDays(Number(e.target.value))}
                className="w-full font-mono tabular-nums text-xs border border-slate-200 rounded px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-4">
              <label htmlFor="inv-timestamp" className="block text-xs font-medium text-slate-700 mb-1">
                Stored / Opened Timestamp
              </label>
              <input
                id="inv-timestamp"
                type="datetime-local"
                value={addedAt}
                onChange={(e) => setAddedAt(e.target.value)}
                className="w-full font-mono tabular-nums text-xs border border-slate-200 rounded px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="lg:col-span-3">
              <div className="text-xs font-medium text-slate-700 mb-1">Quick Time Offset</div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded">
                {TIMESTAMP_OFFSETS.map((off) => (
                  <button
                    key={off.label}
                    type="button"
                    onClick={() => setAddedAt(hoursAgoToLocalTimestamp(off.hoursAgo))}
                    className="flex-1 py-1 px-1.5 text-[11px] font-mono text-slate-700 hover:bg-white rounded transition-colors"
                  >
                    {off.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="inv-notes" className="block text-xs font-medium text-slate-700 mb-1">
                Storage Note / Spec Detail
              </label>
              <input
                id="inv-notes"
                type="text"
                placeholder="Shelf location or opened note"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="lg:col-span-2">
              <button
                type="submit"
                className="w-full px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add to Inventory
              </button>
            </div>
          </div>

          {(optimalTempC || optimalRhMin || vocRiskNote) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div>
                <label htmlFor="inv-opt-temp" className="block text-[11px] text-slate-500 mb-1">
                  Spec Optimal Temp (°C)
                </label>
                <input
                  id="inv-opt-temp"
                  type="number"
                  step={0.5}
                  value={optimalTempC}
                  onChange={(e) => setOptimalTempC(e.target.value)}
                  className="w-full font-mono tabular-nums border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="inv-opt-rh-min" className="block text-[11px] text-slate-500 mb-1">
                  Spec Optimal RH Min (%)
                </label>
                <input
                  id="inv-opt-rh-min"
                  type="number"
                  step={1}
                  value={optimalRhMin}
                  onChange={(e) => setOptimalRhMin(e.target.value)}
                  className="w-full font-mono tabular-nums border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="inv-opt-rh-max" className="block text-[11px] text-slate-500 mb-1">
                  Spec Optimal RH Max (%)
                </label>
                <input
                  id="inv-opt-rh-max"
                  type="number"
                  step={1}
                  value={optimalRhMax}
                  onChange={(e) => setOptimalRhMax(e.target.value)}
                  className="w-full font-mono tabular-nums border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="inv-voc-note" className="block text-[11px] text-slate-500 mb-1">
                  Spoilage &amp; VOC Note
                </label>
                <input
                  id="inv-voc-note"
                  type="text"
                  value={vocRiskNote}
                  onChange={(e) => setVocRiskNote(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                />
              </div>
            </div>
          )}

          {lookupStatus && (
            <div
              className={`text-xs rounded border px-3 py-2 ${
                lookupStatus.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {lookupStatus.text}
            </div>
          )}
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm font-semibold text-slate-900">
            Active Pantry Inventory ({filteredRows.length} of {rows.length})
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search inventory products"
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by food category"
              className="text-xs border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No matching food items in inventory.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4 font-medium">Product &amp; Specs</th>
                  <th className="py-2.5 px-3 font-medium">Stored Timestamp</th>
                  <th className="py-2.5 px-3 font-medium">Elapsed / Time Left</th>
                  <th className="py-2.5 px-3 font-medium text-right">Expiry Risk</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map(({ item, assessment }) => {
                  const statusInfo = STATUS_STYLE[assessment.status];
                  const elapsedHours = getEffectiveStoredHours(item, nowMs) + simulatedDays * 24;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <CategoryImage
                            category={item.category}
                            alt={item.name}
                            className="w-12 h-9 rounded object-cover shrink-0 border border-slate-200"
                          />
                          <div>
                            <div className="font-medium text-slate-900">{item.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {item.category} · {item.packaging}
                              {item.specs?.optimalRhMin !== undefined &&
                              item.specs?.optimalRhMax !== undefined
                                ? ` · Optimal ${item.specs.optimalTempC ?? '–'}°C / ${item.specs.optimalRhMin}–${item.specs.optimalRhMax}% RH`
                                : ''}
                            </div>
                            {(item.specs?.vocRiskNote || item.notes) && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {item.specs?.vocRiskNote || item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <input
                          type="datetime-local"
                          value={item.addedAt}
                          aria-label={`Stored timestamp for ${item.name}`}
                          onChange={(e) => {
                            const nextTs = e.target.value;
                            if (!nextTs) return;
                            onUpdateItem({
                              ...item,
                              addedAt: nextTs,
                              storedHours: computeElapsedHours(nextTs),
                            });
                          }}
                          className="font-mono tabular-nums text-[11px] border border-slate-200 rounded px-2 py-1 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Logged {formatTimestampLabel(item.addedAt)}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        <div>
                          {formatDuration(elapsedHours)} ·{' '}
                          <span className="text-slate-900 font-semibold">
                            {assessment.effectiveDecayRate.toFixed(2)}x pace
                          </span>
                        </div>
                        <div className={`text-[11px] mt-0.5 ${assessment.remainingSafeHours >= 0 ? 'text-slate-500' : 'text-rose-700 font-medium'}`}>
                          {assessment.remainingSafeHours >= 0
                            ? `~${formatDuration(assessment.remainingSafeHours)} left`
                            : `Past best window by ${formatDuration(assessment.remainingSafeHours)}`}{' '}
                          (of {item.nominalShelfLifeDays}d base)
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums font-semibold text-slate-900 text-right whitespace-nowrap">
                        {assessment.expirationLikelihoodPct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`font-mono font-medium ${statusInfo.textClass}`}>
                          {statusInfo.glyph} {assessment.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onInspectInMonitor(item.id)}
                            className="px-2.5 py-1 text-[11px] font-medium text-blue-700 border border-blue-200 bg-blue-50/50 rounded hover:bg-blue-50 transition-colors"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${item.name}`}
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
