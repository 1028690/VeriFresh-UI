import { useState, type FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  CATEGORY_PROFILES,
  computeElapsedHours,
  hoursAgoToLocalTimestamp,
  toLocalDateTimeInput,
} from '../engine/spoilageModel';
import { lookupProductSpecs } from '../services/productLookup';
import { FoodCategory, FoodItem, PackagingType } from '../types/sensor';

interface AddFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: FoodItem) => void;
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

export function AddFoodModal({ isOpen, onClose, onAdd }: AddFoodModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Produce');
  const [packaging, setPackaging] = useState<PackagingType>('Resealable');
  const [nominalShelfLifeDays, setNominalShelfLifeDays] = useState<number>(
    CATEGORY_PROFILES.Produce.defaultShelfLifeDays,
  );
  const [addedAt, setAddedAt] = useState<string>(() => toLocalDateTimeInput(new Date()));
  const [notes, setNotes] = useState('');

  const [optimalTempC, setOptimalTempC] = useState<number | undefined>(undefined);
  const [optimalRhMin, setOptimalRhMin] = useState<number | undefined>(undefined);
  const [optimalRhMax, setOptimalRhMax] = useState<number | undefined>(undefined);
  const [vocRiskNote, setVocRiskNote] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleCategoryChange = (nextCategory: FoodCategory) => {
    setCategory(nextCategory);
    setNominalShelfLifeDays(CATEGORY_PROFILES[nextCategory].defaultShelfLifeDays);
  };

  const handleLookupSpecs = async () => {
    const query = name.trim();
    if (!query) {
      setLookupFeedback({ type: 'err', text: 'Enter a product name first.' });
      return;
    }

    setIsLookingUp(true);
    setLookupFeedback(null);
    try {
      const specs = await lookupProductSpecs(query, packaging);
      setName(specs.canonicalName);
      setCategory(specs.category);
      setPackaging(specs.recommendedPackaging);
      setNominalShelfLifeDays(specs.nominalShelfLifeDays);
      setOptimalTempC(specs.optimalTempC);
      setOptimalRhMin(specs.optimalRhMin);
      setOptimalRhMax(specs.optimalRhMax);
      setVocRiskNote(specs.vocRiskNote);
      setLookupFeedback({
        type: 'ok',
        text: `AI specs loaded: ${specs.nominalShelfLifeDays}d life · ${specs.optimalTempC}°C · ${specs.optimalRhMin}–${specs.optimalRhMax}% RH — ${specs.vocRiskNote}`,
      });
    } catch (error) {
      setLookupFeedback({
        type: 'err',
        text: error instanceof Error ? error.message : 'Unable to look up product specs.',
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

    onAdd({
      id: `item-${Date.now()}`,
      name: trimmed,
      category,
      packaging,
      nominalShelfLifeDays: Math.max(0.25, nominalShelfLifeDays),
      storedHours: elapsed,
      addedAt: cleanTimestamp,
      notes: notes.trim() || undefined,
      specs:
        vocRiskNote || optimalTempC !== undefined
          ? {
              optimalTempC,
              optimalRhMin,
              optimalRhMax,
              vocRiskNote: vocRiskNote || undefined,
              source: lookupFeedback?.type === 'ok' ? 'AI Lookup' : 'Manual',
            }
          : undefined,
    });

    setName('');
    setNotes('');
    setVocRiskNote('');
    setOptimalTempC(undefined);
    setOptimalRhMin(undefined);
    setOptimalRhMax(undefined);
    setLookupFeedback(null);
    setAddedAt(toLocalDateTimeInput(new Date()));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-food-title"
    >
      <div className="bg-white border border-slate-200 rounded-md w-full max-w-lg p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h2 id="add-food-title" className="text-base font-semibold text-slate-900">
            Add Pantry Food Item
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label htmlFor="food-name" className="block font-medium text-slate-700 mb-1">
              Product Name
            </label>
            <div className="flex gap-2">
              <input
                id="food-name"
                type="text"
                required
                placeholder="e.g., Fresh Blueberries, Almond Butter, Baguette"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 border border-slate-200 rounded px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={handleLookupSpecs}
                disabled={isLookingUp}
                className="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-60 transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                {isLookingUp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Lookup…
                  </>
                ) : (
                  'Lookup Specs (AI)'
                )}
              </button>
            </div>
          </div>

          {lookupFeedback && (
            <div
              className={`rounded border px-3 py-2 ${
                lookupFeedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {lookupFeedback.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="food-category" className="block font-medium text-slate-700 mb-1">
                Food Category
              </label>
              <select
                id="food-category"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as FoodCategory)}
                className="w-full border border-slate-200 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="food-packaging" className="block font-medium text-slate-700 mb-1">
                Packaging State
              </label>
              <select
                id="food-packaging"
                value={packaging}
                onChange={(e) => setPackaging(e.target.value as PackagingType)}
                className="w-full border border-slate-200 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {PACKAGINGS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="food-life" className="block font-medium text-slate-700 mb-1">
                Baseline Shelf Life (days)
              </label>
              <input
                id="food-life"
                type="number"
                step={0.25}
                min={0.25}
                max={1095}
                value={nominalShelfLifeDays}
                onChange={(e) => setNominalShelfLifeDays(Number(e.target.value))}
                className="w-full font-mono tabular-nums border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="food-timestamp" className="block font-medium text-slate-700 mb-1">
                Stored / Opened Timestamp
              </label>
              <input
                id="food-timestamp"
                type="datetime-local"
                value={addedAt}
                onChange={(e) => setAddedAt(e.target.value)}
                className="w-full font-mono tabular-nums border border-slate-200 rounded px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded">
            {[
              { label: 'Now', hours: 0 },
              { label: '6h ago', hours: 6 },
              { label: '24h ago', hours: 24 },
              { label: '3d ago', hours: 72 },
              { label: '7d ago', hours: 168 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setAddedAt(hoursAgoToLocalTimestamp(preset.hours))}
                className="flex-1 py-1 text-[11px] font-mono text-slate-700 hover:bg-white rounded transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="food-notes" className="block font-medium text-slate-700 mb-1">
              Storage Location Note (optional)
            </label>
            <input
              id="food-notes"
              type="text"
              placeholder="e.g., Top pantry shelf, opened Tuesday"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Add to Pantry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
