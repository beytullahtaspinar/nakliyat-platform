import { HomeType } from '../generated/prisma/enums.js';
import { estimateMove, type EstimateInput } from './estimate.js';

const base: EstimateInput = {
  homeType: HomeType.TWO_PLUS_ONE,
  fromFloor: 0,
  fromHasElevator: true,
  toFloor: 0,
  toHasElevator: true,
  needsPacking: false,
  needsAssembly: false,
};

describe('estimateMove', () => {
  it('2+1 için hacim ve ekip', () => {
    expect(estimateMove(base)).toMatchObject({ estimatedVolumeM3: 25, estimatedCrew: 3 });
  });

  it('asansörsüz yüksek kat süreyi uzatır', () => {
    const withElevator = estimateMove({ ...base, fromFloor: 5 });
    const stairs = estimateMove({ ...base, fromFloor: 5, fromHasElevator: false });
    expect(stairs.estimatedHours).toBeGreaterThan(withElevator.estimatedHours);
  });

  it('şehirler arası mesafe yol süresini ekler', () => {
    const local = estimateMove(base);
    const intercity = estimateMove({ ...base, distanceKm: 453 });
    expect(intercity.estimatedHours - local.estimatedHours).toBeGreaterThanOrEqual(5);
  });

  it('ek hizmetler süreyi uzatır', () => {
    const extra = estimateMove({ ...base, needsPacking: true, needsAssembly: true });
    expect(extra.estimatedHours).toBeGreaterThan(estimateMove(base).estimatedHours);
  });
});
