import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service.js';
import type { Prisma, Vehicle, VehicleFile } from '../generated/prisma/client.js';
import { VehicleFileKind, VerificationStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateVehicleDto, CreateVehicleUploadDto, UpdateVehicleDto, VehicleFilesDto } from './dto/company-vehicles.dto.js';
import { EXTENSIONS } from './media-rules.js';
import { MediaService } from './media.service.js';
import { FILE_STORAGE, type MediaStorage } from './storage.js';
import { formatPlate, rulesFor, VEHICLE_FILE_KINDS, VEHICLE_FILE_LABELS, VEHICLE_RULES } from './vehicle-rules.js';

type VehicleWithFiles = Vehicle & { files: VehicleFile[] };

const WITH_FILES = { files: true } as const;

/**
 * Firma araçları. Dosya akışı belgelerle aynı: createUpload ile kısa süreli yükleme adresi alınır, tarayıcı
 * dosyayı yükler, araç kaydedilirken dosyalar depoda doğrulanır. Araç ruhsat ve üç fotoğrafla birlikte
 * tek seferde kaydedilir; yönetici onaylayana ya da reddedene kadar "inceleniyor" görünür.
 *
 * Onaylanmamış araç düzeltilebilir (plaka, tip, yetki belgesi, tek tek dosyalar); düzeltilen araç yeniden
 * incelemeye girer. Onaylı araç değişmez: yanlışlık varsa yenisi eklenir, eskisi silinir.
 */
@Injectable()
export class CompanyVehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly media: MediaService,
    @Inject(FILE_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async listOwn(ownerId: string) {
    const company = await this.companies.requireCompany(ownerId);
    return this.summary(company.id);
  }

  async createUpload(ownerId: string, { kind, mimeType, sizeBytes }: CreateVehicleUploadDto) {
    const company = await this.companies.requireCompany(ownerId);
    const rules = rulesFor(kind);
    if (!(rules.mimeTypes as readonly string[]).includes(mimeType)) {
      throw new BadRequestException(
        kind === VehicleFileKind.REGISTRATION ? 'Ruhsat PDF, JPG, PNG ya da WebP olmalı' : 'Fotoğraf JPG, PNG ya da WebP olmalı',
      );
    }
    if (sizeBytes > rules.maxBytes) {
      throw new BadRequestException(`${VEHICLE_FILE_LABELS[kind]} en fazla ${rules.maxBytes / 1024 / 1024} MB olabilir`);
    }
    await this.media.checkQuota(sizeBytes, 'Dosya yükleme şu an kullanılamıyor, lütfen daha sonra tekrar dene.');
    const key = `firmalar/${company.id}/${randomBytes(16).toString('hex')}.${EXTENSIONS[mimeType]}`;
    return { key, ...this.storage.createUpload(key, mimeType, sizeBytes) };
  }

  async create(ownerId: string, dto: CreateVehicleDto) {
    const company = await this.companies.requireCompany(ownerId);
    const missing = VEHICLE_FILE_KINDS.filter((kind) => !dto.files[kind]);
    if (missing.length) {
      throw new BadRequestException(`Eksik dosya: ${missing.map((kind) => VEHICLE_FILE_LABELS[kind]).join(', ')}`);
    }
    if ((await this.prisma.vehicle.count({ where: { companyId: company.id } })) >= VEHICLE_RULES.maxVehicles) {
      throw new BadRequestException(`En fazla ${VEHICLE_RULES.maxVehicles} araç eklenebilir`);
    }
    if (await this.prisma.vehicle.findUnique({ where: { companyId_plate: { companyId: company.id, plate: dto.plate } } })) {
      throw new ConflictException(`${formatPlate(dto.plate)} plakalı araç zaten ekli`);
    }
    await this.assertPlateFree(company.id, dto.plate);
    const files = await this.checkFiles(company.id, dto.files);

    await this.prisma.$transaction([
      this.prisma.vehicle.create({
        data: {
          companyId: company.id,
          plate: dto.plate,
          type: dto.type,
          authorization: dto.authorization,
          files: { create: files },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: ownerId,
          action: 'company.vehicle.upload',
          entityType: 'Company',
          entityId: company.id,
          details: { plate: dto.plate },
        },
      }),
      ...this.reopenIfRejected(company),
    ]);
    return this.summary(company.id);
  }

  async update(ownerId: string, vehicleId: string, dto: UpdateVehicleDto) {
    const company = await this.companies.requireCompany(ownerId);
    const vehicle = await this.findOwn(company.id, vehicleId);
    if (vehicle.status === VerificationStatus.VERIFIED) {
      throw new ConflictException('Onaylanmış araç değiştirilemez. Bilgisi yanlışsa aracı yeniden ekleyin.');
    }
    if (dto.plate && dto.plate !== vehicle.plate) {
      const sameOwn = await this.prisma.vehicle.findUnique({
        where: { companyId_plate: { companyId: company.id, plate: dto.plate } },
      });
      if (sameOwn) throw new ConflictException(`${formatPlate(dto.plate)} plakalı araç zaten ekli`);
      await this.assertPlateFree(company.id, dto.plate);
    }
    const files = await this.checkFiles(company.id, dto.files ?? {});
    const replaced = vehicle.files.filter((f) => files.some((n) => n.kind === f.kind));

    await this.prisma.$transaction([
      this.prisma.vehicleFile.deleteMany({ where: { id: { in: replaced.map((f) => f.id) } } }),
      this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          plate: dto.plate,
          type: dto.type,
          authorization: dto.authorization,
          status: VerificationStatus.PENDING,
          reviewNote: null,
          reviewedAt: null,
          files: { create: files },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: ownerId,
          action: 'company.vehicle.update',
          entityType: 'Company',
          entityId: company.id,
          details: { plate: dto.plate ?? vehicle.plate },
        },
      }),
      ...this.reopenIfRejected(company),
    ]);
    await this.media.deleteObjects(replaced);
    return this.summary(company.id);
  }

  async remove(ownerId: string, vehicleId: string) {
    const company = await this.companies.requireCompany(ownerId);
    const vehicle = await this.findOwn(company.id, vehicleId);
    if (vehicle.status === VerificationStatus.VERIFIED && company.verificationStatus === VerificationStatus.VERIFIED) {
      const others = await this.prisma.vehicle.count({
        where: { companyId: company.id, status: VerificationStatus.VERIFIED, id: { not: vehicle.id } },
      });
      if (!others) {
        throw new ConflictException('Onaylı tek aracın silinemez. Önce yeni aracını ekle; onaylanınca bunu silebilirsin.');
      }
    }
    await this.prisma.$transaction([
      this.prisma.vehicle.delete({ where: { id: vehicle.id } }),
      this.prisma.auditLog.create({
        data: {
          actorId: ownerId,
          action: 'company.vehicle.delete',
          entityType: 'Company',
          entityId: company.id,
          details: { plate: vehicle.plate },
        },
      }),
    ]);
    await this.media.deleteObjects(vehicle.files);
  }

  /** Araçlar (dosyaların görüntüleme adresleriyle) ve onaylı araç sayısı */
  async summary(companyId: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { companyId },
      include: WITH_FILES,
      orderBy: { createdAt: 'desc' },
    });
    return {
      vehicles: vehicles.map((v) => this.toView(v)),
      verifiedCount: vehicles.filter((v) => v.status === VerificationStatus.VERIFIED).length,
    };
  }

  /** Firma onayı için en az bir onaylı araç gerekir */
  async hasVerifiedVehicle(companyId: string) {
    return (await this.prisma.vehicle.count({ where: { companyId, status: VerificationStatus.VERIFIED } })) > 0;
  }

  /** Yönetimdeki araç listesi (varsayılan: onay bekleyenler, en eski önce) */
  async listForAdmin({ status, q, page, limit }: { status?: VerificationStatus; q?: string; page: number; limit: number }) {
    const plate = q?.replace(/[İı]/g, 'I').replace(/[\s.\-_]/g, '').toUpperCase();
    const where: Prisma.VehicleWhereInput = {
      company: { deletedAt: null },
      ...(status && { status }),
      ...(q && {
        OR: [
          { plate: { contains: plate } },
          { company: { OR: [{ displayName: { contains: q } }, { legalName: { contains: q } }, { taxNumber: { contains: q } }] } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        orderBy: { updatedAt: status === VerificationStatus.PENDING ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ...WITH_FILES,
          company: { select: { id: true, displayName: true, legalName: true, verificationStatus: true } },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return {
      items: rows.map(({ company, ...v }) => ({ ...this.toView(v), company })),
      total,
      page,
      limit,
    };
  }

  /** Yönetici kararı: ruhsattaki plaka fotoğraflardaki plakayla aynıysa onay, değilse gerekçeyle ret */
  async review(adminId: string, companyId: string, vehicleId: string, status: VerificationStatus, note?: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, companyId, company: { deletedAt: null } },
    });
    if (!vehicle) throw new NotFoundException('Araç bulunamadı');
    const approved = status === VerificationStatus.VERIFIED;
    if (approved) {
      const elsewhere = await this.prisma.vehicle.findFirst({
        where: { plate: vehicle.plate, status: VerificationStatus.VERIFIED, companyId: { not: companyId }, company: { deletedAt: null } },
        include: { company: { select: { displayName: true } } },
      });
      if (elsewhere) {
        throw new ConflictException(
          `${formatPlate(vehicle.plate)} plakalı araç ${elsewhere.company.displayName} firmasında onaylı. Önce o kaydı inceleyin.`,
        );
      }
    }
    await this.prisma.$transaction([
      this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { status, reviewNote: note ?? null, reviewedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: approved ? 'company.vehicle.approve' : 'company.vehicle.reject',
          entityType: 'Company',
          entityId: companyId,
          details: { vehicleId: vehicle.id, plate: vehicle.plate, note: note ?? null },
        },
      }),
    ]);
    return this.summary(companyId);
  }

  /** Hesap silinirken araçlar ve dosyaları kalıcı olarak silinir (KVKK) */
  async deleteForCompany(companyId: string) {
    const files = await this.prisma.vehicleFile.findMany({
      where: { vehicle: { companyId } },
      select: { storageKey: true, storage: true },
    });
    await this.prisma.vehicle.deleteMany({ where: { companyId } });
    await this.media.deleteObjects(files);
  }

  toView(vehicle: VehicleWithFiles) {
    return {
      id: vehicle.id,
      plate: vehicle.plate,
      type: vehicle.type,
      authorization: vehicle.authorization,
      status: vehicle.status,
      reviewNote: vehicle.reviewNote,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
      reviewedAt: vehicle.reviewedAt,
      files: VEHICLE_FILE_KINDS.flatMap((kind) => {
        const file = vehicle.files.find((f) => f.kind === kind);
        return file
          ? [
              {
                kind,
                fileName: file.fileName,
                mimeType: file.mimeType,
                sizeBytes: file.sizeBytes,
                url: this.storage.viewUrl(file.storageKey, file.storage),
              },
            ]
          : [];
      }),
    };
  }

  private async findOwn(companyId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, companyId }, include: WITH_FILES });
    if (!vehicle) throw new NotFoundException('Araç bulunamadı');
    return vehicle;
  }

  /** Aynı plaka başka bir firmada onaylı ya da incelemedeyse eklenemez (reddedilmiş kayıt engellemez) */
  private async assertPlateFree(companyId: string, plate: string) {
    const taken = await this.prisma.vehicle.count({
      where: { plate, companyId: { not: companyId }, status: { not: VerificationStatus.REJECTED }, company: { deletedAt: null } },
    });
    if (taken) {
      throw new ConflictException(
        `${formatPlate(plate)} plakalı araç başka bir firmada kayıtlı. Araç senin firmana aitse destek@evdenevenakliyat.app adresine yaz.`,
      );
    }
  }

  /** Dosyalar firmaya ait, yüklenmiş, türü ve boyutu uygun olmalı; uygunsuz dosya depodan silinir */
  private async checkFiles(companyId: string, files: VehicleFilesDto) {
    const entries = VEHICLE_FILE_KINDS.flatMap((kind) => (files[kind] ? [{ kind, ...files[kind] }] : []));
    const keys = entries.map((e) => e.key);
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Her dosya ayrı yüklenmeli');
    if (keys.some((key) => !key.startsWith(`firmalar/${companyId}/`))) throw new BadRequestException('Dosya bu firmaya ait değil');
    if (keys.length && (await this.prisma.vehicleFile.count({ where: { storageKey: { in: keys } } }))) {
      throw new BadRequestException('Dosya zaten kullanılmış, yeniden yükleyin');
    }

    const checked: Prisma.VehicleFileCreateWithoutVehicleInput[] = [];
    for (const entry of entries) {
      const object = await this.storage.stat(entry.key);
      if (!object) {
        throw new BadRequestException(`${VEHICLE_FILE_LABELS[entry.kind]} yüklenmemiş ya da yükleme yarıda kalmış, tekrar deneyin`);
      }
      const rules = rulesFor(entry.kind);
      if (!(rules.mimeTypes as readonly string[]).includes(object.mimeType) || object.sizeBytes > rules.maxBytes) {
        await this.media.deleteObjects([{ storageKey: entry.key, storage: object.location }]);
        throw new BadRequestException(`${VEHICLE_FILE_LABELS[entry.kind]}: dosya türü veya boyutu uygun değil`);
      }
      checked.push({
        kind: entry.kind,
        storageKey: entry.key,
        storage: object.location,
        mimeType: object.mimeType,
        sizeBytes: object.sizeBytes,
        fileName: entry.fileName,
      });
    }
    return checked;
  }

  /** Reddedilmiş firma araç eklediğinde ya da düzelttiğinde yeniden incelemeye girer (belgelerdeki gibi) */
  private reopenIfRejected(company: { id: string; verificationStatus: VerificationStatus }) {
    return company.verificationStatus === VerificationStatus.REJECTED
      ? [
          this.prisma.company.update({
            where: { id: company.id },
            data: { verificationStatus: VerificationStatus.PENDING },
          }),
        ]
      : [];
  }
}
