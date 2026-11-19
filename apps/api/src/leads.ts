import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  Inject,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Prisma, PrismaClient } from '@lead-finder/db';
import { requireSourceRights } from '@lead-finder/data-sources';
import { z } from 'zod';
import { hash, parse } from './security.js';
import type { OwnerRequest } from './security.js';

const uuid = z.uuid();
const profileInput = z.strictObject({
  city: z.string().trim().min(1).max(100),
  query: z.string().trim().min(1).max(80),
});
const crmInput = z.strictObject({
  revision: z.number().int().positive(),
  crm: z.enum([
    'new',
    'planned',
    'contacted',
    'replied',
    'interested',
    'negotiation',
    'won',
    'lost',
    'do_not_contact',
  ]),
  priority: z.enum(['Звичайний', 'Високий']),
  notes: z.string().max(3000),
  website: z.string().trim().max(500),
  websiteLocked: z.boolean(),
});
const createInput = z.strictObject({
  profileId: uuid,
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(300),
  website: z.string().trim().max(500).default(''),
  instagram: z.string().trim().max(200).default(''),
  independentObservation: z.literal(true),
});
const includeBusiness = { business: { include: { crm: true } } } as const;
const provenance = (field: string, actorId: string) => ({
  sourceType: 'manual' as const,
  sourceRef: `owner:${actorId}`,
  field,
  license: 'owner-original-v1',
  observedAt: new Date().toISOString(),
  confidence: 1,
  storageRights: 'allowed' as const,
  exportRights: 'allowed' as const,
  attribution: 'Власна незалежна перевірка користувача Lead Finder',
  dataset: 'independent-user-observation',
});
const normalized = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase('uk');
function present(
  b: Prisma.BusinessGetPayload<{ include: { crm: true } }>,
  discovery = 'unchecked',
) {
  return {
    id: b.id,
    name: b.canonicalName,
    address: b.address,
    website: b.website,
    instagram: b.instagram,
    discovery,
    operating: b.operatingStatus,
    crm: b.crm?.status ?? 'new',
    priority: b.crm?.priority ?? 'Звичайний',
    notes: b.crm?.notes ?? '',
    websiteLocked: b.websiteLocked,
    firstSeen: b.firstSeenAt.toISOString(),
    lastSeen: b.lastSeenAt.toISOString(),
    revision: b.revision,
  };
}
@Controller()
export class LeadController {
  constructor(@Inject('DB') private readonly db: PrismaClient) {}
  @Get('health/live')
  live() {
    return { status: 'ok' };
  }
  @Get('health/ready')
  async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
  @Get('countries')
  countries() {
    return this.db.country.findMany({ orderBy: { iso2: 'asc' } });
  }
  @Get('cities')
  cities() {
    return this.db.city.findMany({ include: { country: true }, orderBy: { name: 'asc' } });
  }

  @Post('search-profiles')
  async profile(@Body() body: unknown, @Req() req: OwnerRequest) {
    const input = parse(profileInput, body);
    const city = await this.db.city.findFirst({ where: { name: input.city } });
    if (!city) throw new NotFoundException('Місто відсутнє у довіднику');
    const scope = hash(
      JSON.stringify(['UA', city.id, normalized(input.query), city.boundaryVersion]),
    );
    const profile = await this.db.searchProfile.upsert({
      where: { profileHash: scope },
      update: {},
      create: {
        cityId: city.id,
        queryOriginal: input.query,
        queryNormalized: normalized(input.query),
        boundaryVersion: city.boundaryVersion,
        profileHash: scope,
      },
    });
    await this.db.user.update({
      where: { id: req.ownerId },
      data: { activeProfileId: profile.id },
    });
    return { id: profile.id };
  }
  @Get('search-profiles')
  profiles() {
    return this.db.searchProfile.findMany({
      include: { city: true },
      orderBy: { createdAt: 'asc' },
    });
  }
  @Get('workspace')
  async workspace(@Req() req: OwnerRequest) {
    const owner = await this.db.user.findUniqueOrThrow({ where: { id: req.ownerId } });
    if (!owner.activeProfileId)
      await this.profile({ city: 'Івано-Франківськ', query: 'Стоматологія' }, req);
    const current = await this.db.user.findUniqueOrThrow({ where: { id: req.ownerId } });
    const profiles = await this.db.searchProfile.findMany({
      include: {
        city: true,
        memberships: { include: includeBusiness, take: 500, orderBy: { businessId: 'asc' } },
        runs: { take: 20, orderBy: { startedAt: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const workspaces: Record<string, unknown> = {};
    for (const p of profiles) {
      const ids = p.memberships.map((m) => m.businessId);
      const events = await this.db.changeEvent.findMany({
        where: { businessId: { in: ids } },
        include: { business: { select: { canonicalName: true } } },
        take: 100,
        orderBy: { createdAt: 'desc' },
      });
      workspaces[p.id] = {
        profile: { id: p.id, city: p.city.name, query: p.queryOriginal },
        businesses: p.memberships.map((m) => present(m.business, m.discoveryStatus)),
        changes: events.map((e) => ({
          id: e.id,
          businessId: e.businessId,
          name: e.business.canonicalName,
          at: e.createdAt.toISOString(),
          text:
            e.eventType === 'BUSINESS_CREATED'
              ? 'Бізнес додано вручну'
              : 'Збережено ручні зміни CRM та контактів',
        })),
        runs: p.runs.map((r) => ({
          id: r.id,
          at: r.startedAt.toISOString(),
          snapshot: 0,
          created: 0,
          changed: 0,
          missing: 0,
        })),
      };
    }
    return { version: 1, activeKey: current.activeProfileId, workspaces, mode: 'api' };
  }

  @Get('businesses')
  async businesses(@Query() query: Record<string, unknown>) {
    const input = parse(
      z.object({
        profileId: uuid,
        cursor: uuid.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        q: z.string().max(200).default(''),
      }),
      query,
    );
    const rows = await this.db.profileBusiness.findMany({
      where: {
        profileId: input.profileId,
        business: {
          archivedAt: null,
          OR: [
            { canonicalName: { contains: input.q, mode: 'insensitive' } },
            { website: { contains: input.q, mode: 'insensitive' } },
          ],
        },
        ...(input.cursor ? { businessId: { gt: input.cursor } } : {}),
      },
      include: includeBusiness,
      orderBy: { businessId: 'asc' },
      take: input.limit + 1,
    });
    const hasMore = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return {
      items: items.map((m) => present(m.business, m.discoveryStatus)),
      nextCursor: hasMore ? items.at(-1)?.businessId : null,
    };
  }
  @Get('businesses/:id')
  async business(@Param('id') raw: string) {
    const id = parse(uuid, raw);
    const b = await this.db.business.findUnique({
      where: { id },
      include: {
        crm: true,
        facts: {
          include: { source: { include: { license: true } } },
          orderBy: { observedAt: 'desc' },
        },
      },
    });
    if (!b) throw new NotFoundException();
    return { ...present(b), facts: b.facts };
  }
  @Get('businesses/:id/history')
  history(@Param('id') raw: string) {
    return this.db.changeEvent.findMany({
      where: { businessId: parse(uuid, raw) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  @Post('businesses')
  async create(@Body() body: unknown, @Req() req: OwnerRequest) {
    const input = parse(createInput, body);
    const requestKey = parse(z.string().uuid(), req.headers['idempotency-key']);
    const creationKey = `${req.ownerId}:${requestKey}`,
      creationHash = hash(JSON.stringify(input));
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${creationKey}, 0))`;
      const previous = await tx.business.findUnique({ where: { creationKey } });
      if (previous) {
        if (previous.creationHash !== creationHash)
          throw new ConflictException('Ключ повтору вже використано для іншого запиту');
        return { id: previous.id };
      }
      const profile = await tx.searchProfile.findUnique({ where: { id: input.profileId } });
      if (!profile) throw new NotFoundException();
      const license = await tx.licenseRegistry.findUniqueOrThrow({
        where: { id: 'owner-original-v1' },
      });
      if (
        !license.allowStorage ||
        license.revokedAt ||
        (license.expiresAt && license.expiresAt <= new Date())
      )
        throw new ConflictException('Права на зберігання відкликано');
      const facts = Object.entries({
        business_name: input.name,
        address: input.address,
        website_url: input.website,
        instagram_url: input.instagram,
      })
        .filter(([, value]) => value)
        .map(([field, value]) => ({ field, value, evidence: provenance(field, req.ownerId) }));
      for (const fact of facts) requireSourceRights('store', [fact.evidence]);
      const b = await tx.business.create({
        data: {
          cityId: profile.cityId,
          canonicalName: input.name,
          normalizedName: normalized(input.name),
          address: input.address,
          website: input.website,
          instagram: input.instagram,
          websiteLocked: Boolean(input.website),
          creationKey,
          creationHash,
          crm: { create: { ownerId: req.ownerId } },
          memberships: { create: { profileId: profile.id } },
        },
      });
      const source = await tx.businessSource.create({
        data: {
          businessId: b.id,
          sourceType: 'manual',
          sourceRef: `owner:${req.ownerId}`,
          licenseId: license.id,
        },
      });
      for (const fact of facts)
        await tx.businessFact.create({
          data: {
            businessId: b.id,
            sourceId: source.id,
            fieldName: fact.field,
            value: fact.value!,
            provenance: fact.evidence,
            isManual: true,
            isLocked: true,
          },
        });
      await tx.changeEvent.create({
        data: {
          businessId: b.id,
          actorId: req.ownerId,
          eventType: 'BUSINESS_CREATED',
          after: { name: b.canonicalName, address: b.address },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.ownerId,
          action: 'MANUAL_CREATE',
          entityType: 'business',
          entityId: b.id,
        },
      });
      return { id: b.id };
    });
  }
  @Patch('businesses/:id/crm')
  async update(@Param('id') raw: string, @Body() body: unknown, @Req() req: OwnerRequest) {
    const id = parse(uuid, raw),
      input = parse(crmInput, body);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      const b = await tx.business.findUnique({ where: { id }, include: { crm: true } });
      if (!b) throw new NotFoundException();
      if (b.revision !== input.revision)
        throw new ConflictException('Картку вже змінено. Оновіть сторінку перед збереженням.');
      const changed = await tx.business.updateMany({
        where: { id, revision: input.revision },
        data: {
          revision: { increment: 1 },
          website: input.website,
          websiteLocked: input.websiteLocked,
          lastChangedAt: new Date(),
        },
      });
      if (!changed.count) throw new ConflictException('Конкурентна зміна');
      await tx.crmEntry.upsert({
        where: { businessId: id },
        create: {
          businessId: id,
          ownerId: req.ownerId,
          status: input.crm,
          priority: input.priority,
          notes: input.notes,
          doNotContact: input.crm === 'do_not_contact',
        },
        update: {
          status: input.crm,
          priority: input.priority,
          notes: input.notes,
          doNotContact: input.crm === 'do_not_contact',
        },
      });
      if (b.website !== input.website || b.websiteLocked !== input.websiteLocked) {
        const evidence = provenance('website_url', req.ownerId);
        requireSourceRights('store', [evidence]);
        const source = await tx.businessSource.findFirstOrThrow({
          where: { businessId: id, sourceType: 'manual' },
          include: { license: true },
        });
        if (
          !source.license.allowStorage ||
          source.license.revokedAt ||
          (source.license.expiresAt && source.license.expiresAt <= new Date())
        )
          throw new ConflictException('Права джерела відкликано');
        await tx.businessFact.updateMany({
          where: { businessId: id, fieldName: 'website_url', isCurrent: true },
          data: { isCurrent: false },
        });
        await tx.businessFact.create({
          data: {
            businessId: id,
            sourceId: source.id,
            fieldName: 'website_url',
            value: input.website,
            provenance: evidence,
            isManual: true,
            isLocked: input.websiteLocked,
          },
        });
      }
      await tx.changeEvent.create({
        data: {
          businessId: id,
          actorId: req.ownerId,
          eventType: 'MANUAL_OVERRIDE',
          before: {
            website: b.website,
            crm: b.crm?.status ?? 'new',
            notes: b.crm?.notes ?? '',
            priority: b.crm?.priority ?? 'Звичайний',
            websiteLocked: b.websiteLocked,
          },
          after: {
            website: input.website,
            crm: input.crm,
            notes: input.notes,
            priority: input.priority,
            websiteLocked: input.websiteLocked,
          },
        },
      });
      await tx.auditLog.create({
        data: { actorId: req.ownerId, action: 'CRM_UPDATE', entityType: 'business', entityId: id },
      });
      return { id, revision: input.revision + 1 };
    });
  }
  @Post('search-runs')
  scan() {
    throw new ConflictException({
      code: 'SOURCE_NOT_CONFIGURED',
      message: 'Пошукове джерело ще не підключено. Додайте перевірений бізнес вручну.',
    });
  }

  @Post('exports/csv')
  async csv(@Body() body: unknown, @Req() req: OwnerRequest, @Res() res: Response) {
    const { ids } = parse(z.strictObject({ ids: z.array(uuid).min(1).max(500) }), body);
    const rows = await this.db.business.findMany({
      where: { id: { in: ids } },
      include: {
        crm: true,
        facts: { where: { isCurrent: true }, include: { source: { include: { license: true } } } },
      },
    });
    const data = [['ID', 'Назва', 'Адреса', 'Сайт', 'Instagram', 'CRM', 'Джерела та ліцензії']];
    for (const b of rows) {
      const fields: Record<string, string> = {};
      const sources = new Set<string>();
      for (const fact of b.facts) {
        const license = fact.source.license;
        if (
          !license.allowExport ||
          !license.allowStorage ||
          license.revokedAt ||
          (license.expiresAt && license.expiresAt <= new Date())
        )
          continue;
        // Never reconstruct rights for external data. Only our original manual facts qualify here.
        if (fact.source.sourceType !== 'manual' || fact.source.licenseId !== 'owner-original-v1')
          continue;
        const stored = fact.provenance as unknown as ReturnType<typeof provenance>;
        try {
          requireSourceRights('export', [stored]);
        } catch {
          continue;
        }
        if (typeof fact.value === 'string') fields[fact.fieldName] = fact.value;
        sources.add(license.attributionText + ' / ' + license.licenseCode);
      }
      data.push([
        b.id,
        fields.business_name ?? '',
        fields.address ?? '',
        fields.website_url ?? '',
        fields.instagram_url ?? '',
        b.crm?.status ?? 'new',
        [...sources].join(' | '),
      ]);
    }
    const cell = (s: string) =>
      '"' + (/^[=+@\-\t\r\n]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
    await this.db.export.create({
      data: { createdBy: req.ownerId, filters: { ids }, format: 'csv', rowCount: rows.length },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lead-finder.csv"');
    res.send('\uFEFF' + data.map((row) => row.map(cell).join(';')).join('\r\n'));
  }
}
