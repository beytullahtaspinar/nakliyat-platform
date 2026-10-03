import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getCityByCode, getDistanceKm, getDistrict } from '@nakliyat/locations';
import type { MovingRequest } from '../generated/prisma/client.js';
import { MediaService } from '../media/media.service.js';
import { DomainEvents } from '../events/domain-events.js';
import { RequestStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRequestDto } from './dto/create-request.dto.js';
import type { PaginationDto } from './dto/list-requests.dto.js';
import type { UpdateRequestDto } from './dto/update-request.dto.js';
import { VerificationService } from '../verification/verification.service.js';
import { estimateMove } from './estimate.js';
import { RouteService, type Point, type Route } from './route-service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Teklif toplama süresi: taşınma tarihine kadar, en fazla 30 gün */
const MAX_OPEN_DAYS = 30;

/** Türkiye saatine göre bugünün tarihi, YYYY-MM-DD */
const todayInTurkey = (now: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now);

/** Açık talep ya da doğrulama bekleyen taslak */
const isEditable = (status: RequestStatus) => status === RequestStatus.OPEN || status === RequestStatus.DRAFT;

type LocationFields = Pick<
  CreateRequestDto,
  'fromCityCode' | 'fromDistrict' | 'toCityCode' | 'toDistrict'
>;

type PinFields = { fromLat?: number | null; fromLng?: number | null; toLat?: number | null; toLng?: number | null };

/** Enlem ve boylam birlikte gelmeli; ikisi de yoksa nokta işaretlenmemiştir. */
function pin(lat: number | null | undefined, lng: number | null | undefined, label: string): Point | undefined {
  if (lat == null && lng == null) return undefined;
  if (lat == null || lng == null) throw new BadRequestException(`${label} konumu için enlem ve boylam birlikte gönderilmeli`);
  return { lat, lng };
}

const pins = (dto: PinFields) => ({ from: pin(dto.fromLat, dto.fromLng, 'Çıkış'), to: pin(dto.toLat, dto.toLng, 'Varış') });

/** Tahmini sürede kullanılacak yol: gerçek güzergâh varsa o, yoksa il merkezleri arası */
const routeFields = (route: Route | null) => ({ routeKm: route?.km ?? null, routeMinutes: route?.minutes ?? null });

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly media: MediaService,
    private readonly verification: VerificationService,
    private readonly routes: RouteService,
  ) {}

  async create(customerId: string, dto: CreateRequestDto) {
    const now = new Date();
    const { distanceKm } = this.validateLocations(dto);
    this.validateMoveDate(dto.moveDate, now);
    const route = await this.computeRoute(pins(dto));
    // Doğrulanmamış hesabın talebi taslak kalır; doğrulama bitince yayına alınır (VerificationService)
    const verified = await this.verification.isUserComplete(customerId);

    const request = await this.prisma.movingRequest.create({
      data: {
        ...dto,
        status: verified ? RequestStatus.OPEN : RequestStatus.DRAFT,
        publishedAt: verified ? now : null,
        specialItems: dto.specialItems ?? [],
        customerId,
        distanceKm: distanceKm ?? null,
        ...routeFields(route),
        ...estimateMove({
          ...dto,
          needsPacking: dto.needsPacking ?? false,
          needsAssembly: dto.needsAssembly ?? false,
          distanceKm,
          routeMinutes: route?.minutes,
        }),
        expiresAt: new Date(Math.min(dto.moveDate.getTime(), now.getTime() + MAX_OPEN_DAYS * DAY_MS)),
      },
    });
    if (verified) this.events.emit('request.created', { requestId: request.id });
    return toRequestResponse(request, 0);
  }

  async list(customerId: string, { page, limit }: PaginationDto) {
    const where = { customerId, deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.movingRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { quotes: true } } },
      }),
      this.prisma.movingRequest.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...r }) => toRequestResponse(r, _count.quotes)),
      total,
      page,
      limit,
    };
  }

  async get(customerId: string, id: string) {
    const { _count, ...request } = await this.findOwned(customerId, id);
    return { ...toRequestResponse(request, _count.quotes), media: await this.media.listForRequest(id) };
  }

  async update(customerId: string, id: string, dto: UpdateRequestDto) {
    const { _count, ...current } = await this.findOwned(customerId, id);
    if (!isEditable(current.status)) {
      throw new ConflictException('Yalnızca açık talepler düzenlenebilir');
    }
    if (_count.quotes > 0) {
      throw new ConflictException('Teklif gelmiş bir talep düzenlenemez; iptal edip yeni talep oluşturun');
    }

    // Adres değişip yeni işaret gelmediyse eski işaret artık o adresi göstermez
    const pinData: PinFields = {};
    for (const side of ['from', 'to'] as const) {
      const moved = (['CityCode', 'District', 'Address'] as const).some((f) => dto[`${side}${f}`] !== undefined);
      if (moved && dto[`${side}Lat`] === undefined && dto[`${side}Lng`] === undefined) {
        pinData[`${side}Lat`] = null;
        pinData[`${side}Lng`] = null;
      }
    }
    const merged = { ...current, ...dto, ...pinData };
    const { distanceKm } = this.validateLocations(merged);
    if (dto.moveDate) this.validateMoveDate(dto.moveDate, new Date());

    const nextPins = pins(merged);
    const pinsChanged = (['fromLat', 'fromLng', 'toLat', 'toLng'] as const).some((f) => merged[f] !== current[f]);
    const route = pinsChanged
      ? await this.computeRoute(nextPins)
      : current.routeKm != null && current.routeMinutes != null
        ? { km: current.routeKm, minutes: current.routeMinutes }
        : null;

    const request = await this.prisma.movingRequest.update({
      where: { id },
      data: {
        ...dto,
        ...pinData,
        distanceKm: distanceKm ?? null,
        ...routeFields(route),
        ...estimateMove({ ...merged, distanceKm, routeMinutes: route?.minutes }),
      },
    });
    return toRequestResponse(request, 0);
  }

  async cancel(customerId: string, id: string) {
    const { _count, ...current } = await this.findOwned(customerId, id);
    if (!isEditable(current.status)) {
      throw new ConflictException('Yalnızca açık talepler iptal edilebilir');
    }
    const request = await this.prisma.movingRequest.update({
      where: { id },
      data: { status: RequestStatus.CANCELLED },
    });
    return toRequestResponse(request, _count.quotes);
  }

  /** Başkasının talebi de "bulunamadı" döner; talep kimlikleri tahmin edilerek bilgi sızdırılamaz. */
  private async findOwned(customerId: string, id: string) {
    const request = await this.prisma.movingRequest.findFirst({
      where: { id, customerId, deletedAt: null },
      include: { _count: { select: { quotes: true } } },
    });
    if (!request) throw new NotFoundException('Talep bulunamadı');
    return request;
  }

  /** Yalnızca iki uç da işaretliyse hesaplanır; servis yoksa ya da yanıt vermezse null */
  private computeRoute({ from, to }: { from?: Point; to?: Point }) {
    return from && to ? this.routes.route(from, to) : Promise.resolve(null);
  }

  private validateLocations(dto: LocationFields): { distanceKm?: number } {
    const from = getCityByCode(dto.fromCityCode);
    const to = getCityByCode(dto.toCityCode);
    if (!from) throw new BadRequestException('Çıkış ili geçersiz');
    if (!to) throw new BadRequestException('Varış ili geçersiz');
    if (!getDistrict(from, dto.fromDistrict)) {
      throw new BadRequestException(`Çıkış ilçesi ${from.name} iline ait değil`);
    }
    if (!getDistrict(to, dto.toDistrict)) {
      throw new BadRequestException(`Varış ilçesi ${to.name} iline ait değil`);
    }
    return { distanceKm: from === to ? undefined : getDistanceKm(from, to) };
  }

  private validateMoveDate(moveDate: Date, now: Date) {
    const day = moveDate.toISOString().slice(0, 10);
    if (day <= todayInTurkey(now)) {
      throw new BadRequestException('Taşınma tarihi en erken yarın olabilir');
    }
    if (moveDate.getTime() > now.getTime() + 366 * DAY_MS) {
      throw new BadRequestException('Taşınma tarihi en fazla 1 yıl sonrası olabilir');
    }
  }
}

export function toRequestResponse(request: MovingRequest, quoteCount: number) {
  const from = getCityByCode(request.fromCityCode);
  const to = getCityByCode(request.toCityCode);
  const { deletedAt: _deletedAt, ...rest } = request;
  return {
    ...rest,
    fromCityName: from?.name ?? null,
    fromDistrictName: (from && getDistrict(from, request.fromDistrict)?.name) ?? null,
    toCityName: to?.name ?? null,
    toDistrictName: (to && getDistrict(to, request.toDistrict)?.name) ?? null,
    quoteCount,
  };
}
