import { useMemo, useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { PlanId } from '../types/sensor';

interface PlanTierSpec {
  id: PlanId;
  name: string;
  audience: string;
  sensorRangeLabel: string;
  minSensors: number;
  maxSensors: number | null;
  baseAnnualPriceUsd: number;
  extraPerSensorUsd: number;
  extraStartsAfter: number | null;
  priceDisplay: string;
  billingNote: string;
  calibrationWindow: string;
  zoneCapacity: string;
  summary: string;
}

export const PLAN_TIERS: PlanTierSpec[] = [
  {
    id: 'free',
    name: 'Free Plan',
    audience: 'For single-pantry testing',
    sensorRangeLabel: '1 sensor pairing',
    minSensors: 1,
    maxSensors: 1,
    baseAnnualPriceUsd: 0,
    extraPerSensorUsd: 0,
    extraStartsAfter: null,
    priceDisplay: '$0',
    billingNote: 'Free forever · 1 BME688 pairing',
    calibrationWindow: '7–28 day calibration',
    zoneCapacity: '1 kitchen pantry shelf',
    summary:
      'Includes 1 sensor pairing capability to track temperature, humidity, VOC, and barometric pressure in a single pantry.',
  },
  {
    id: 'consumer',
    name: 'Consumer',
    audience: 'For multi-zone home kitchens',
    sensorRangeLabel: '2–5 sensors',
    minSensors: 2,
    maxSensors: 5,
    baseAnnualPriceUsd: 10,
    extraPerSensorUsd: 0,
    extraStartsAfter: null,
    priceDisplay: '$10',
    billingNote: 'per year · up to 5 sensors',
    calibrationWindow: '28-day multi-zone profiles',
    zoneCapacity: 'Pantry, spice rack, cellar, bread box',
    summary:
      'Pair 2 to 5 BME688 sensors across pantry shelves, produce drawers, and cool larders under one household inventory.',
  },
  {
    id: 'small-business',
    name: 'Small Business',
    audience: 'For bakeries, cafes & prep rooms',
    sensorRangeLabel: '5–10 sensors',
    minSensors: 5,
    maxSensors: 10,
    baseAnnualPriceUsd: 50,
    extraPerSensorUsd: 0,
    extraStartsAfter: null,
    priceDisplay: '$50',
    billingNote: 'per year · 5–10 sensors',
    calibrationWindow: 'Custom store-room schedules',
    zoneCapacity: 'Up to 10 storage bays',
    summary:
      'Built for independent food shops and neighborhood kitchens monitoring 5 to 10 dry, bakery, and chilled prep areas.',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'For regional food operations',
    sensorRangeLabel: '10–50 sensors',
    minSensors: 10,
    maxSensors: 50,
    baseAnnualPriceUsd: 250,
    extraPerSensorUsd: 0,
    extraStartsAfter: null,
    priceDisplay: '$250',
    billingNote: 'per year · 10–50 sensors',
    calibrationWindow: 'Shared fleet calibration profiles',
    zoneCapacity: 'Up to 50 aisles or coolers',
    summary:
      'Coordinate 10 to 50 sensor pairings across commissary kitchens, multi-site restaurants, and specialty retail floors.',
  },
  {
    id: 'commercial',
    name: 'Commercial',
    audience: 'For large distribution centers',
    sensorRangeLabel: '50–100 sensors',
    minSensors: 50,
    maxSensors: 100,
    baseAnnualPriceUsd: 1000,
    extraPerSensorUsd: 0,
    extraStartsAfter: null,
    priceDisplay: '$1,000',
    billingNote: 'per year · 50–100 sensors',
    calibrationWindow: 'Facility-wide batch calibration',
    zoneCapacity: 'Up to 100 pallet & rack nodes',
    summary:
      'High-density spoilage monitoring for 50 to 100 sensors covering receiving docks, ambient aisles, and aging vaults.',
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    audience: 'For high-scale logistics fleets',
    sensorRangeLabel: '100+ sensors',
    minSensors: 100,
    maxSensors: null,
    baseAnnualPriceUsd: 1000,
    extraPerSensorUsd: 2,
    extraStartsAfter: 100,
    priceDisplay: '$1,000',
    billingNote: 'flat fee / yr + $2 / yr per extra sensor from 100',
    calibrationWindow: 'Unlimited multi-zone calibration',
    zoneCapacity: '100+ sensors (unbounded)',
    summary:
      'Flat $1,000/year base covering the first 100 sensors, plus $2/year for every additional sensor paired beyond 100.',
  },
];

export function recommendPlanForSensors(sensorCount: number): PlanTierSpec {
  if (sensorCount <= 1) return PLAN_TIERS[0];
  if (sensorCount <= 5) return PLAN_TIERS[1];
  if (sensorCount <= 10) return PLAN_TIERS[2];
  if (sensorCount <= 50) return PLAN_TIERS[3];
  if (sensorCount <= 100) return PLAN_TIERS[4];
  return PLAN_TIERS[5];
}

export function calculateAnnualCostUsd(plan: PlanTierSpec, sensorCount: number): number {
  if (plan.extraStartsAfter !== null) {
    const extraSensors = Math.max(0, sensorCount - plan.extraStartsAfter);
    return plan.baseAnnualPriceUsd + extraSensors * plan.extraPerSensorUsd;
  }
  return plan.baseAnnualPriceUsd;
}

interface ExplorePlansViewProps {
  currentPlanId: PlanId;
  onSelectPlan: (planId: PlanId) => void;
  onOpenSensorsTab: () => void;
}

export function ExplorePlansView({
  currentPlanId,
  onSelectPlan,
  onOpenSensorsTab,
}: ExplorePlansViewProps) {
  const [desiredSensors, setDesiredSensors] = useState<number>(1);
  const currentPlan =
    PLAN_TIERS.find((p) => p.id === currentPlanId) ?? PLAN_TIERS[0];

  const recommendedPlan = useMemo(
    () => recommendPlanForSensors(desiredSensors),
    [desiredSensors],
  );

  const estimatedAnnualCost = useMemo(
    () => calculateAnnualCostUsd(recommendedPlan, desiredSensors),
    [recommendedPlan, desiredSensors],
  );

  const warehouseExtraCount = Math.max(0, desiredSensors - 100);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-md p-6">
        <div className="flex flex-wrap items-start justify-between gap-6 pb-5 border-b border-slate-200">
          <div className="max-w-3xl">
            <div className="text-xs font-mono text-blue-700 font-medium">
              Current Plan: {currentPlan.name} · {currentPlan.sensorRangeLabel}
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mt-1 text-balance">
              Explore Sensor Pairing Plans
            </h1>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
              {currentPlanId === 'free' ? (
                <>
                  You are currently on the <strong className="text-slate-900">Free Plan</strong> with{' '}
                  <strong className="text-slate-900">1 sensor pairing capability</strong>. Upgrade to pair multiple Bosch BME688 sensors across additional pantry shelves, prep rooms, commercial kitchens, or warehouses.
                </>
              ) : (
                <>
                  Your workspace is currently set to the{' '}
                  <strong className="text-slate-900">{currentPlan.name}</strong> plan ({currentPlan.sensorRangeLabel} at{' '}
                  <span className="font-mono">{currentPlan.priceDisplay}/yr</span>). Compare capacities below or switch plans anytime.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenSensorsTab}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200/70 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              Manage Sensor Input
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="pt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="sensor-plan-count"
                className="text-xs font-semibold text-slate-800"
              >
                How many BME688 sensors do you want to pair?
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="sensor-plan-count-number"
                  type="number"
                  min={1}
                  max={1000}
                  value={desiredSensors}
                  onChange={(e) => {
                    const next = Math.max(1, Math.min(1000, Number(e.target.value) || 1));
                    setDesiredSensors(next);
                  }}
                  aria-label="Desired sensor count"
                  className="w-20 font-mono tabular-nums text-xs border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                  sensors
                </span>
              </div>
            </div>

            <input
              id="sensor-plan-count"
              type="range"
              min={1}
              max={250}
              step={1}
              value={Math.min(250, desiredSensors)}
              onChange={(e) => setDesiredSensors(Number(e.target.value))}
              className="w-full cursor-pointer"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: '1 (Free)', count: 1 },
                { label: '3 (Consumer)', count: 3 },
                { label: '8 (Small Biz)', count: 8 },
                { label: '25 (Enterprise)', count: 25 },
                { label: '75 (Commercial)', count: 75 },
                { label: '150 (Warehouse)', count: 150 },
              ].map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => setDesiredSensors(sample.count)}
                  className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap ${
                    desiredSensors === sample.count
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-md p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                Recommended for <span className="font-mono tabular-nums text-slate-800 font-semibold">{desiredSensors}</span>{' '}
                {desiredSensors === 1 ? 'sensor' : 'sensors'}
              </div>
              <div className="text-base font-semibold text-slate-900 mt-0.5">
                {recommendedPlan.name}
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-600 mt-1">
                {recommendedPlan.id === 'warehouse'
                  ? `$1,000 flat + ${warehouseExtraCount} extra × $2/yr`
                  : `${recommendedPlan.sensorRangeLabel} included`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
                ${estimatedAnnualCost.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">per year</div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Available sensor plans" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {PLAN_TIERS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isRecommended = plan.id === recommendedPlan.id && desiredSensors > 1;
          const warehouseSampleCost =
            plan.id === 'warehouse' && desiredSensors > 100
              ? calculateAnnualCostUsd(plan, desiredSensors)
              : null;

          return (
            <article
              key={plan.id}
              className={`bg-white rounded-md p-5 flex flex-col justify-between gap-5 border transition-colors ${
                isCurrent
                  ? 'border-blue-600 ring-1 ring-blue-600/20'
                  : isRecommended
                  ? 'border-slate-400'
                  : 'border-slate-200'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500">
                      {plan.audience}
                    </div>
                    <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                      {plan.name}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-700 whitespace-nowrap">
                    {plan.sensorRangeLabel}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
                      {plan.priceDisplay}
                    </span>
                    <span className="text-xs text-slate-500">
                      / year
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-mono mt-0.5">
                    {plan.billingNote}
                  </div>
                  {warehouseSampleCost !== null && (
                    <div className="text-xs font-mono tabular-nums text-blue-700 mt-1">
                      At {desiredSensors} sensors: ${warehouseSampleCost.toLocaleString()}/year
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {plan.summary}
                </p>

                <dl className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Sensor Pairing Limit</dt>
                    <dd className="font-mono tabular-nums font-medium text-slate-900">
                      {plan.sensorRangeLabel}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Calibration</dt>
                    <dd className="text-slate-800 text-right">{plan.calibrationWindow}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Coverage</dt>
                    <dd className="text-slate-800 text-right">{plan.zoneCapacity}</dd>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                disabled={isCurrent}
                onClick={() => onSelectPlan(plan.id)}
                className={`w-full px-4 py-2 text-xs font-medium rounded border transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isCurrent
                    ? 'bg-blue-50 border-blue-200 text-blue-800 cursor-default'
                    : plan.id === 'warehouse' || isRecommended
                    ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {isCurrent ? (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    Current Plan
                  </>
                ) : (
                  `Switch to ${plan.name}`
                )}
              </button>
            </article>
          );
        })}
      </section>

      <section className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Plan Capacity &amp; Pricing Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Exact annual rates and sensor pairing limits across all six tiers
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4 font-medium">Plan</th>
                <th className="py-2.5 px-3 font-medium">Sensor Pairings</th>
                <th className="py-2.5 px-3 font-medium text-right">Annual Base Fee</th>
                <th className="py-2.5 px-3 font-medium">Overage / Extra Sensor Rate</th>
                <th className="py-2.5 px-4 font-medium">Typical Deployment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PLAN_TIERS.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                return (
                  <tr
                    key={plan.id}
                    className={isCurrent ? 'bg-blue-50/50' : 'hover:bg-slate-50/70'}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {plan.name}
                      {isCurrent ? ' (Active)' : ''}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {plan.sensorRangeLabel}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums font-semibold text-slate-900 text-right whitespace-nowrap">
                      {plan.priceDisplay}/yr
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {plan.extraStartsAfter !== null
                        ? `+$${plan.extraPerSensorUsd}/yr per sensor after ${plan.extraStartsAfter}`
                        : 'Included within tier limit'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {plan.zoneCapacity}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
