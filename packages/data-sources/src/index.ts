import type { FactProvenance, SourceOperation } from '@lead-finder/shared';

/** Grants are maintained by the server. Provider responses never define grants. */
export interface SourceGrant {
  sourceType: 'manual' | 'overture' | 'osm' | 'official_website' | 'licensed_search';
  license: string;
  dataset: string;
  releaseId?: string;
  fields: readonly string[];
  canStore: boolean;
  canExport: boolean;
  /** null explicitly permits retention without a contractual expiry. */
  expiresAt: string | null;
}

const manualGrant: SourceGrant = {
  sourceType: 'manual',
  license: 'owner-original-v1',
  dataset: 'independent-user-observation',
  fields: ['business_name', 'address', 'website_url', 'instagram_url', 'maps_manual_check_status'],
  canStore: true,
  canExport: true,
  expiresAt: null,
};

const supportedSources = new Set(['manual', 'overture', 'osm', 'official_website', 'licensed_search']);

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

type Decision =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'restricted_source' | 'invalid_provenance' | 'missing_rights' | 'no_active_grant';
    };

/** Evaluate every contributing source before a durable write and again before delivery. */
export function createSourcePolicy(grants: readonly SourceGrant[]) {
  return function evaluate(
    operation: SourceOperation,
    fact: Readonly<FactProvenance>,
    now = new Date(),
  ): Decision {
    if (!fact || !supportedSources.has(fact.sourceType)) {
      return { allowed: false, reason: 'restricted_source' };
    }

    if (
      ![fact.sourceRef, fact.field, fact.license, fact.dataset, fact.attribution].every(isText) ||
      !isText(fact.observedAt) ||
      !Number.isFinite(Date.parse(fact.observedAt)) ||
      !Number.isFinite(fact.confidence) ||
      fact.confidence < 0 ||
      fact.confidence > 1 ||
      (fact.sourceType === 'overture' && !isText(fact.releaseId))
    ) {
      return { allowed: false, reason: 'invalid_provenance' };
    }

    if (
      (operation !== 'store' && operation !== 'export') ||
      fact.storageRights !== 'allowed' ||
      (operation === 'export' && fact.exportRights !== 'allowed')
    ) {
      return { allowed: false, reason: 'missing_rights' };
    }

    const allowed = grants.some(
      (grant) =>
        grant.sourceType === fact.sourceType &&
        grant.license === fact.license &&
        grant.dataset === fact.dataset &&
        grant.releaseId === fact.releaseId &&
        grant.fields.includes(fact.field) &&
        grant.canStore === true &&
        (operation === 'store' || grant.canExport === true) &&
        (grant.expiresAt === null || Date.parse(grant.expiresAt) > now.getTime()),
    );
    return allowed ? { allowed: true } : { allowed: false, reason: 'no_active_grant' };
  };
}

export const evaluateSourcePolicy = createSourcePolicy([manualGrant]);

export function requireSourceRights(
  operation: SourceOperation,
  contributors: readonly FactProvenance[],
): void {
  if (contributors.length === 0) throw new Error('missing_provenance');
  for (const contributor of contributors) {
    const decision = evaluateSourcePolicy(operation, contributor);
    if (!decision.allowed) throw new Error(decision.reason);
  }
}
