export interface DistrictRecord {
  name: string;
  slug: string;
}

export interface CityRecord {
  /** Plaka kodu, iki haneli: "34" */
  code: string;
  name: string;
  slug: string;
  districts: DistrictRecord[];
}
