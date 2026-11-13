import React, { useState, useEffect } from 'react';
import { Car } from 'lucide-react';
import { cn } from '../../lib/utils';

const CAR_LOGOS_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/thumb';

export const FIPE_BRAND_LOGO_SLUGS: Record<string, string> = {
  'acura': 'acura',
  'alfa romeo': 'alfa-romeo',
  'am gen': 'hummer',
  'aston martin': 'aston-martin',
  'audi': 'audi',
  'bmw': 'bmw',
  'byd': 'byd',
  'cadillac': 'cadillac',
  'caoa changan': 'changan',
  'caoa chery': 'chery',
  'caoa chery/chery': 'chery',
  'chana': 'changan',
  'changan': 'changan',
  'chrysler': 'chrysler',
  'citroen': 'citroen',
  'citroën': 'citroen',
  'daewoo': 'daewoo',
  'daihatsu': 'daihatsu',
  'dfsk': 'dongfeng',
  'dodge': 'dodge',
  'ferrari': 'ferrari',
  'fiat': 'fiat',
  'ford': 'ford',
  'foton': 'foton',
  'gac': 'gac-group',
  'geely': 'geely',
  'gm - chevrolet': 'chevrolet',
  'great wall': 'great-wall',
  'gwm': 'great-wall',
  'hafei': 'hafei',
  'honda': 'honda',
  'hyundai': 'hyundai',
  'isuzu': 'isuzu',
  'iveco': 'iveco',
  'jac': 'jac',
  'jaguar': 'jaguar',
  'jeep': 'jeep',
  'jetour': 'jetour',
  'kia motors': 'kia',
  'lada': 'lada',
  'lamborghini': 'lamborghini',
  'land rover': 'land-rover',
  'leapmotor': 'leapmotor',
  'lexus': 'lexus',
  'lifan': 'lifan',
  'lobini': 'lobini',
  'lotus': 'lotus',
  'mahindra': 'mahindra',
  'maserati': 'maserati',
  'mazda': 'mazda',
  'mclaren': 'mclaren',
  'mercedes-benz': 'mercedes-benz',
  'mercury': 'mercury',
  'mg': 'mg',
  'mini': 'mini',
  'mitsubishi': 'mitsubishi',
  'nissan': 'nissan',
  'omoda': 'omoda',
  'peugeot': 'peugeot',
  'plymouth': 'plymouth',
  'pontiac': 'pontiac',
  'porsche': 'porsche',
  'ram': 'ram',
  'renault': 'renault',
  'rolls-royce': 'rolls-royce',
  'rover': 'rover',
  'saab': 'saab',
  'saturn': 'saturn',
  'seat': 'seat',
  'smart': 'smart',
  'ssangyong': 'ssangyong',
  'subaru': 'subaru',
  'suzuki': 'suzuki',
  'toyota': 'toyota',
  'troller': 'troller',
  'volvo': 'volvo',
  'vw - volkswagen': 'volkswagen',
  'zeekr': 'zeekr',
};

export function getBrandLogoUrl(brandName?: string | null): string | null {
  if (!brandName) return null;
  const normalized = brandName.trim().toLowerCase();
  const slug = FIPE_BRAND_LOGO_SLUGS[normalized];
  if (!slug) return null;
  return `${CAR_LOGOS_CDN_BASE}/${slug}.png`;
}

export interface BrandLogoProps {
  brand?: string | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  iconClassName?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-4 h-4 sm:w-5 sm:h-5',
};

const PIXEL_DIMS: Record<NonNullable<BrandLogoProps['size']>, number> = {
  xs: 14,
  sm: 16,
  md: 20,
};

export default function BrandLogo({
  brand,
  size = 'md',
  className,
  iconClassName,
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = getBrandLogoUrl(brand);

  useEffect(() => {
    setImgError(false);
  }, [brand]);

  if (logoUrl && !imgError) {
    const dim = PIXEL_DIMS[size];
    return (
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        width={dim}
        height={dim}
        onError={() => setImgError(true)}
        className={cn(
          'object-contain select-none shrink-0',
          SIZE_CLASSES[size],
          className
        )}
      />
    );
  }

  return (
    <Car
      aria-hidden="true"
      className={cn(
        'text-[#171717] dark:text-[#ededed] shrink-0',
        size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5',
        iconClassName,
        className
      )}
    />
  );
}
