import { useState } from 'react';
import { Utensils } from 'lucide-react';
import { FoodCategory } from '../types/sensor';

export const PANTRY_HERO_IMAGE = '/src/assets/images/pantry_hero_sensor_1795643512497.jpg';

const CATEGORY_IMAGES: Record<FoodCategory, string> = {
  Produce: '/src/assets/images/food_produce_1795643511923.jpg',
  Bakery: '/src/assets/images/food_bakery_1795643512846.jpg',
  'Dairy & Chilled': '/src/assets/images/food_dairy_protein_1795643512866.jpg',
  'Meat & Protein': '/src/assets/images/food_dairy_protein_1795643512866.jpg',
  'Dry Goods': '/src/assets/images/food_dry_oils_1795643513515.jpg',
  'Oils & Condiments': '/src/assets/images/food_dry_oils_1795643513515.jpg',
};

interface ResilientImageProps {
  src: string;
  alt: string;
  label: string;
  className?: string;
}

export function ResilientImage({ src, alt, label, className = '' }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center text-slate-500 p-4 ${className}`}
      >
        <Utensils className="w-6 h-6 mb-1.5 text-slate-400" aria-hidden="true" />
        <span className="text-xs font-medium text-slate-600 text-center">{label}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function CategoryImage({
  category,
  alt,
  className = '',
}: {
  category: FoodCategory;
  alt: string;
  className?: string;
}) {
  return (
    <ResilientImage
      src={CATEGORY_IMAGES[category]}
      alt={alt}
      label={category}
      className={className}
    />
  );
}
