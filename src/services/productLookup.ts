import { FoodCategory, PackagingType } from '../types/sensor';

export interface ProductLookupSpecs {
  canonicalName: string;
  category: FoodCategory;
  recommendedPackaging: PackagingType;
  nominalShelfLifeDays: number;
  optimalTempC: number;
  optimalRhMin: number;
  optimalRhMax: number;
  vocRiskNote: string;
}

export async function lookupProductSpecs(
  productName: string,
  packagingHint?: PackagingType,
): Promise<ProductLookupSpecs> {
  const response = await fetch('/api/products/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productName: productName.trim(),
      packagingHint,
    }),
  });

  const data = (await response.json()) as {
    specs?: ProductLookupSpecs;
    error?: string;
  };

  if (!response.ok || !data.specs) {
    throw new Error(data.error || 'Unable to retrieve product specifications.');
  }

  return data.specs;
}
