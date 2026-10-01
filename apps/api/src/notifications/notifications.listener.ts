import { Injectable, OnModuleInit } from '@nestjs/common';
import { getCityByCode, getDistrict } from '@nakliyat/locations';
import { DomainEvents } from '../events/domain-events.js';
import type { MovingRequest } from '../generated/prisma/client.js';
import { UserStatus, VerificationStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { templates } from './templates.js';

const HOME_TYPE_LABELS: Record<string, string> = {
  STUDIO: 'Stüdyo (1+0)',
  ONE_PLUS_ONE: '1+1 ev',
  TWO_PLUS_ONE: '2+1 ev',
  THREE_PLUS_ONE: '3+1 ev',
  FOUR_PLUS_ONE: '4+1 ve üzeri ev',
  VILLA: 'Villa',
  OFFICE: 'Ofis',
};

/** "Kadıköy, İstanbul" biçiminde yer adı. Müşterinin açık adresi bildirimlere hiç girmez. */
const place = (cityCode: string, districtSlug: string) => {
  const city = getCityByCode(cityCode);
  if (!city) return cityCode;
  const district = getDistrict(city, districtSlug);
  return district ? `${district.name}, ${city.name}` : city.name;
};
const route = (r: MovingRequest) => ({
  from: place(r.fromCityCode, r.fromDistrict),
  to: place(r.toCityCode, r.toDistrict),
  moveDate: r.moveDate,
});

/** İş olaylarını dinleyip ilgili kişilere bildirim gönderir. */
@Injectable()
export class NotificationsListener implements OnModuleInit {
  constructor(
    private readonly events: DomainEvents,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.events.on('request.created', ({ requestId }) => this.onRequestCreated(requestId));
    this.events.on('quote.created', ({ quoteId }) => this.onQuoteCreated(quoteId));
    this.events.on('quote.accepted', ({ quoteId }) => this.onQuoteAccepted(quoteId));
    this.events.on('company.verification_changed', ({ companyId }) => this.onVerificationChanged(companyId));
  }

  /** Talebin çıkış veya varış iline hizmet veren doğrulanmış firmalara haber ver. */
  async onRequestCreated(requestId: string) {
    const request = await this.prisma.movingRequest.findUnique({ where: { id: requestId } });
    if (!request) return;
    const cities = [...new Set([request.fromCityCode, request.toCityCode])];
    const companies = await this.prisma.company.findMany({
      where: {
        verificationStatus: VerificationStatus.VERIFIED,
        deletedAt: null,
        owner: { status: UserStatus.ACTIVE, deletedAt: null },
        OR: [{ cityCode: { in: cities } }, { serviceCities: { some: { cityCode: { in: cities } } } }],
      },
      select: { ownerId: true },
    });
    await this.notifications.notifyMany(
      companies.map((c) => c.ownerId),
      templates.newRequest({
        ...route(request),
        requestId,
        homeTypeLabel: HOME_TYPE_LABELS[request.homeType] ?? request.homeType,
      }),
    );
  }

  async onQuoteCreated(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { request: true, company: { select: { displayName: true } } },
    });
    if (!quote) return;
    await this.notifications.notify(
      quote.request.customerId,
      templates.newQuote({
        ...route(quote.request),
        requestId: quote.requestId,
        companyName: quote.company.displayName,
        priceTry: quote.priceTry.toString(),
      }),
    );
  }

  async onQuoteAccepted(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { request: true, company: { select: { displayName: true, ownerId: true } } },
    });
    if (!quote) return;
    const common = { ...route(quote.request), priceTry: quote.priceTry.toString() };
    await this.notifications.notify(
      quote.request.customerId,
      templates.quoteAcceptedForCustomer({ ...common, requestId: quote.requestId, companyName: quote.company.displayName }),
    );
    await this.notifications.notify(quote.company.ownerId, templates.quoteAcceptedForCompany(common));
  }

  async onVerificationChanged(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return;
    if (company.verificationStatus === VerificationStatus.VERIFIED) {
      await this.notifications.notify(company.ownerId, templates.companyVerified({ companyName: company.displayName }));
    } else if (company.verificationStatus === VerificationStatus.REJECTED) {
      await this.notifications.notify(
        company.ownerId,
        templates.companyRejected({ companyName: company.displayName, reason: company.verificationNote }),
      );
    }
  }
}
