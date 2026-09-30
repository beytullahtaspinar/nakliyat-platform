import { HomeType } from '../generated/prisma/enums.js';

/**
 * Talep standardı: firmaların aynı bilgiyle teklif verebilmesi için sistemin ürettiği tahmin.
 * Kaba bir başlangıç modelidir; gerçek iş verisi biriktikçe katsayılar güncellenecek.
 */
const VOLUME_M3: Record<HomeType, number> = {
  STUDIO: 10,
  ONE_PLUS_ONE: 15,
  TWO_PLUS_ONE: 25,
  THREE_PLUS_ONE: 35,
  FOUR_PLUS_ONE: 45,
  VILLA: 60,
  OFFICE: 30,
};

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
}

export interface Estimate {
  estimatedVolumeM3: number;
  estimatedCrew: number;
  estimatedHours: number;
}

const stairsFactor = (floor: number, hasElevator: boolean) =>
  1 + (hasElevator ? 0 : Math.max(0, floor) * STAIRS_PENALTY_PER_FLOOR);

export function estimateMove(input: EstimateInput): Estimate {
  const volume = VOLUME_M3[input.homeType];
  const crew = volume <= 15 ? 2 : volume <= 30 ? 3 : volume <= 45 ? 4 : 5;

  const handlingHours = volume / (crew * M3_PER_PERSON_HOUR);
  const loading = handlingHours * stairsFactor(input.fromFloor, input.fromHasElevator);
  const unloading = handlingHours * stairsFactor(input.toFloor, input.toHasElevator);
  const packing = input.needsPacking ? handlingHours * 0.5 : 0;
  const assembly = input.needsAssembly ? 1.5 : 0;
  const road = input.distanceKm ? input.distanceKm / AVERAGE_ROAD_SPEED_KMH : 1;

  return {
    estimatedVolumeM3: volume,
    estimatedCrew: crew,
    estimatedHours: Math.ceil(loading + unloading + packing + assembly + road),
  };
}
