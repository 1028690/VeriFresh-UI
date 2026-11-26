import { useMemo, useState } from 'react';
import { Trash2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import {
  computeElapsedHours,
  formatDuration,
  formatTimestampLabel,
  getEffectiveStoredHours,
} from '../engine/spoilageModel';
import {
  FoodItem,
  PackagingType,
  PantryBaseline,
  SpoilageAssessment,
  SpoilageStatus,
} from '../types/sensor';
import { CategoryImage } from './CategoryVisual';

interface FoodCardRow {
  item: FoodItem;
  assessment: SpoilageAssessment;
}

interface CustomerFoodGridProps {
  rows: FoodCardRow[];
  baseline: PantryBaseline;
  simulatedDays: number;
  nowMs: number;
  onUpdateItem: (item: FoodItem) => void;
  onRemoveItem: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenInventoryTab: () => void;
}

const STATUS_DISPLAY: Record<
  SpoilageStatus,
  { glyph: string; label: string; colorClass: string; ringColor: string }
> = {
  Fresh: {
    glyph: '●',
    label: 'Fresh',
    colorClass: 'text-emerald-700',
    ringColor: '#059669',
  },
  Watch: {
    glyph: '▲',
    label: 'Use Soon',
    colorClass: 'text-amber-700',
    ringColor: '#d97706',
  },
  'High Risk': {
    glyph: '◆',
    label: 'Check Today',
    colorClass: 'text-orange-700',
    ringColor: '#ea580c',
  },
  'Likely Expired': {
    glyph: '✖',
    label: 'Likely Expired',
    colorClass: 'text-rose-700',
    ringColor: '#e11d48',
  },
};

function friendlyReason(assessment: SpoilageAssessment, packaging: PackagingType): string {
  if (assessment.status === 'Likely Expired') {
    if (assessment.dominantDriver === 'VOC') {
      return 'Elevated spoilage gases detected around this item.';
    }
    return 'Stored longer than expected safe window for current pantry conditions.';
  }
  if (assessment.dominantDriver === 'Temperature') {
    return 'Warm pantry temperature is speeding up aging.';
  }
  if (assessment.dominantDriver === 'Humidity') {
    return packaging === 'Airtight'
      ? 'Airtight seal is helping protect against room humidity.'
      : 'Room humidity is affecting freshness—consider airtight storage.';
  }
  if (assessment.dominantDriver === 'VOC') {
    return 'Higher VOC air gases are accelerating ripening or spoilage.';
  }
  return packaging === 'Airtight'
    ? 'Well sealed in normal pantry conditions.'
    : 'Aging at normal pace for your kitchen pantry.';
}

function ExpiryRing({ pct, color }: { pct: number; color: string }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);

  return (
    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="5"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-xs font-semibold font-mono tabular-nums text-slate-900">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

const PACKAGINGS: PackagingType[] = ['Unsealed', 'Resealable', 'Airtight'];

export function CustomerFoodGrid({
  rows,
  baseline,
  simulatedDays,
  nowMs,
  onUpdateItem,
  onRemoveItem,
  onOpenAddModal,
  onOpenInventoryTab,
}: CustomerFoodGridProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'attention' | 'fresh'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedRows = useMemo(() => {
    const filtered = rows.filter(({ assessment }) => {
      if (filterStatus === 'attention') {
        return assessment.status !== 'Fresh';
      }
      if (filterStatus === 'fresh') {
        return assessment.status === 'Fresh';
      }
      return true;
    });

    return [...filtered].sort(
      (a, b) => b.assessment.expirationLikelihoodPct - a.assessment.expirationLikelihoodPct,
    );
  }, [rows, filterStatus]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Your Pantry Food ({rows.length})
          </h2>
          <p className="text-xs text-slate-500">
            Expiration likelihood updates automatically from your pantry air readings and item timestamps
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'attention', label: 'Needs Attention' },
              { id: 'fresh', label: 'Fresh Only' },
            ].map((tab) => {
              const active = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id as typeof filterStatus)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenInventoryTab}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-slate-200 rounded hover:border-blue-400 transition-colors whitespace-nowrap"
          >
            AI Spec Lookup &amp; Manage
          </button>
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-md p-10 text-center">
          <p className="text-sm text-slate-600">No food items match this view.</p>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="mt-3 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Add Food Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sortedRows.map(({ item, assessment }) => {
            const status = STATUS_DISPLAY[assessment.status];
            const elapsedHours = getEffectiveStoredHours(item, nowMs) + simulatedDays * 24;
            const isExpanded = expandedId === item.id;

            const timelinePct = Math.min(
              100,
              Math.max(
                4,
                (assessment.effectiveAgeHours /
                  Math.max(4, item.nominalShelfLifeDays * 24 * 0.91)) *
                  100,
              ),
            );

            return (
              <article
                key={item.id}
                className="bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col"
              >
                <div className="aspect-[16/9] bg-slate-100 relative overflow-hidden">
                  <CategoryImage
                    category={item.category}
                    alt={`${item.name} (${item.category})`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => onRemoveItem(item.id)}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-white/90 hover:bg-white text-slate-600 hover:text-rose-600 rounded border border-slate-200/80 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">
                        {item.category} · {item.packaging} · {assessment.effectiveDecayRate.toFixed(2)}x pace
                        {baseline.calibratedAt ? ' (Calibrated)' : ''}
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 truncate mt-0.5">
                        {item.name}
                      </h3>
                      <div className={`text-xs font-medium mt-1 ${status.colorClass}`}>
                        {status.glyph} {status.label} ·{' '}
                        {assessment.remainingSafeHours >= 0
                          ? `~${formatDuration(assessment.remainingSafeHours)} left`
                          : `Past best window by ${formatDuration(assessment.remainingSafeHours)}`}
                      </div>
                    </div>

                    <div className="flex flex-col items-center shrink-0">
                      <ExpiryRing
                        pct={assessment.expirationLikelihoodPct}
                        color={status.ringColor}
                      />
                      <span className="text-[11px] text-slate-500 mt-1">
                        Expiry risk
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${timelinePct}%`,
                          backgroundColor: status.ringColor,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.specs?.vocRiskNote ||
                        friendlyReason(assessment, item.packaging)}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-mono tabular-nums truncate">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      {formatTimestampLabel(item.addedAt)} ({formatDuration(elapsedHours)})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : item.id)
                      }
                      className="text-blue-700 hover:text-blue-900 font-medium flex items-center gap-0.5 whitespace-nowrap shrink-0"
                    >
                      Edit
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                      <div>
                        <label
                          htmlFor={`card-ts-${item.id}`}
                          className="block font-medium text-slate-700 mb-1"
                        >
                          Stored / Opened Timestamp
                        </label>
                        <input
                          id={`card-ts-${item.id}`}
                          type="datetime-local"
                          value={item.addedAt}
                          onChange={(e) => {
                            const nextTs = e.target.value;
                            if (!nextTs) return;
                            onUpdateItem({
                              ...item,
                              addedAt: nextTs,
                              storedHours: computeElapsedHours(nextTs),
                            });
                          }}
                          className="w-full font-mono tabular-nums border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <div className="font-medium text-slate-700 mb-1">
                          Container Seal
                        </div>
                        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded">
                          {PACKAGINGS.map((pkg) => (
                            <button
                              key={pkg}
                              type="button"
                              onClick={() => onUpdateItem({ ...item, packaging: pkg })}
                              className={`py-1 px-2 text-xs font-medium rounded transition-colors ${
                                item.packaging === pkg
                                  ? 'bg-white text-slate-900'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {pkg}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
