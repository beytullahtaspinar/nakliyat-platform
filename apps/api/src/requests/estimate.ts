import { HOME_VOLUME_M3, crewForVolume } from '@nakliyat/pricing';
import { HomeType } from '../generated/prisma/enums.js';

/**
 * Talep standardı: firmaların aynı bilgiyle teklif verebilmesi için sistemin ürettiği tahmin.
 * Kaba bir başlangıç modelidir; ev tipi hacimleri fiyat hesaplayıcıyla ortaktır (@nakliyat/pricing).
 */

/** Bir kişinin saatte taşıyabildiği ortalama hacim (m³), asansörlü/zemin kat */
const M3_PER_PERSON_HOUR = 2.5;
/** Asansörsüz her kat için süre çarpanı artışı */
const STAIRS_PENALTY_PER_FLOOR = 0.1;
const AVERAGE_ROAD_SPEED_KMH = 70;

export interface EstimateInput {
  homeType: HomeType;
  fromFloor: number;
  fromHasElevator: boolean;
  toFloor: number;
  toHasElevator: boolean;
  needsPacking: boolean;
  needsAssembly: boolean;
  /** Şehirler arası ise karayolu mesafesi, şehir içi ise undefined */
  distanceKm?: number;
  /** Haritadaki iki nokta arası gerçek kamyon yolu süresi; varsa mesafe tahmininin yerine geçer */
  routeMinutes?: number;
}

export interface Estimate {
  estimatedVolumeM3: number;
  estimatedCrew: number;
  estimatedHours: number;
}

const stairsFactor = (floor: number, hasElevator: boolean) =>
  1 + (hasElevator ? 0 : Math.max(0, floor) * STAIRS_PENALTY_PER_FLOOR);

export function estimateMove(input: EstimateInput): Estimate {
  const volume = HOME_VOLUME_M3[input.homeType];
  const crew = crewForVolume(volume);

  const handlingHours = volume / (crew * M3_PER_PERSON_HOUR);
  const loading = handlingHours * stairsFactor(input.fromFloor, input.fromHasElevator);
  const unloading = handlingHours * stairsFactor(input.toFloor, input.toHasElevator);
  const packing = input.needsPacking ? handlingHours * 0.5 : 0;
  const assembly = input.needsAssembly ? 1.5 : 0;
  const road = input.routeMinutes
    ? Math.max(1, input.routeMinutes / 60)
    : input.distanceKm
      ? input.distanceKm / AVERAGE_ROAD_SPEED_KMH
      : 1;

  return {
    estimatedVolumeM3: volume,
    estimatedCrew: crew,
    estimatedHours: Math.ceil(loading + unloading + packing + assembly + road),
  };
}
