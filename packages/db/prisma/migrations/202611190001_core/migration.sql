-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CrmStatus" AS ENUM ('new', 'planned', 'contacted', 'replied', 'interested', 'negotiation', 'won', 'lost', 'do_not_contact');

-- CreateEnum
CREATE TYPE "OperatingStatus" AS ENUM ('unknown', 'operational', 'temporarily_closed', 'permanently_closed');

-- CreateEnum
CREATE TYPE "DiscoveryStatus" AS ENUM ('unchecked', 'seen', 'missing_once', 'missing_multiple', 'reappeared');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "activeProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" UUID NOT NULL,
    "iso2" CHAR(2) NOT NULL,
    "nameUk" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" UUID NOT NULL,
    "countryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "geonamesId" INTEGER,
    "boundaryVersion" TEXT NOT NULL DEFAULT 'unverified',

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "taxonomyCode" TEXT,
    "synonyms" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchProfile" (
    "id" UUID NOT NULL,
    "cityId" UUID NOT NULL,
    "queryOriginal" TEXT NOT NULL,
    "queryNormalized" TEXT NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "boundaryVersion" TEXT NOT NULL,
    "profileHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalDomain" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL,
    "cityId" UUID NOT NULL,
    "brandId" UUID,
    "canonicalName" TEXT NOT NULL,
    "creationKey" TEXT,
    "creationHash" TEXT,
    "normalizedName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "website" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "websiteLocked" BOOLEAN NOT NULL DEFAULT false,
    "operatingStatus" "OperatingStatus" NOT NULL DEFAULT 'unknown',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEntry" (
    "businessId" UUID NOT NULL,
    "status" "CrmStatus" NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'Звичайний',
    "notes" TEXT NOT NULL DEFAULT '',
    "ownerId" UUID NOT NULL,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowupAt" TIMESTAMP(3),

    CONSTRAINT "CrmEntry_pkey" PRIMARY KEY ("businessId")
);

-- CreateTable
CREATE TABLE "ProfileBusiness" (
    "profileId" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConfirmedAt" TIMESTAMP(3),
    "discoveryStatus" "DiscoveryStatus" NOT NULL DEFAULT 'unchecked',

    CONSTRAINT "ProfileBusiness_pkey" PRIMARY KEY ("profileId","businessId")
);

-- CreateTable
CREATE TABLE "LicenseRegistry" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "licenseCode" TEXT NOT NULL,
    "attributionText" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "version" TEXT NOT NULL,
    "allowStorage" BOOLEAN NOT NULL DEFAULT false,
    "allowExport" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "LicenseRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSource" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceRef" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "releaseId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessFact" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BusinessFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRun" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "triggeredBy" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "mode" TEXT NOT NULL DEFAULT 'refresh',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "counts" JSONB NOT NULL DEFAULT '{}',
    "sourceVersions" JSONB NOT NULL DEFAULT '{}',
    "errorSummary" TEXT,

    CONSTRAINT "SearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRunStatus" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "scopeHash" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "itemsScanned" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SourceRunStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceObservation" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "businessId" UUID NOT NULL,
    "observedPresent" BOOLEAN NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeEvent" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "runId" UUID,
    "eventType" TEXT NOT NULL,
    "fieldName" TEXT,
    "before" JSONB,
    "after" JSONB,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapsManualCheck" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapsManualCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Export" (
    "id" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "filters" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "City_geonamesId_key" ON "City"("geonamesId");

-- CreateIndex
CREATE INDEX "City_countryId_idx" ON "City"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "City_countryId_region_slug_key" ON "City"("countryId", "region", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_taxonomyCode_key" ON "Category"("taxonomyCode");

-- CreateIndex
CREATE UNIQUE INDEX "SearchProfile_profileHash_key" ON "SearchProfile"("profileHash");

-- CreateIndex
CREATE UNIQUE INDEX "Business_creationKey_key" ON "Business"("creationKey");

-- CreateIndex
CREATE INDEX "Business_cityId_normalizedName_idx" ON "Business"("cityId", "normalizedName");

-- CreateIndex
CREATE INDEX "Business_website_idx" ON "Business"("website");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSource_sourceType_externalId_key" ON "BusinessSource"("sourceType", "externalId");

-- CreateIndex
CREATE INDEX "BusinessFact_businessId_fieldName_isCurrent_idx" ON "BusinessFact"("businessId", "fieldName", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "SearchRun_idempotencyKey_key" ON "SearchRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SearchRun_profileId_startedAt_idx" ON "SearchRun"("profileId", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SourceRunStatus_runId_sourceType_key" ON "SourceRunStatus"("runId", "sourceType");

-- CreateIndex
CREATE INDEX "SourceObservation_businessId_sourceType_idx" ON "SourceObservation"("businessId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "SourceObservation_runId_sourceType_businessId_key" ON "SourceObservation"("runId", "sourceType", "businessId");

-- CreateIndex
CREATE INDEX "ChangeEvent_businessId_createdAt_idx" ON "ChangeEvent"("businessId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchProfile" ADD CONSTRAINT "SearchProfile_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEntry" ADD CONSTRAINT "CrmEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileBusiness" ADD CONSTRAINT "ProfileBusiness_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SearchProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileBusiness" ADD CONSTRAINT "ProfileBusiness_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSource" ADD CONSTRAINT "BusinessSource_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSource" ADD CONSTRAINT "BusinessSource_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "LicenseRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessFact" ADD CONSTRAINT "BusinessFact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessFact" ADD CONSTRAINT "BusinessFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BusinessSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SearchProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRunStatus" ADD CONSTRAINT "SourceRunStatus_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SearchRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObservation" ADD CONSTRAINT "SourceObservation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SearchRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObservation" ADD CONSTRAINT "SourceObservation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SearchRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapsManualCheck" ADD CONSTRAINT "MapsManualCheck_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX "BusinessFact_one_current" ON "BusinessFact" ("businessId", "fieldName") WHERE "isCurrent" = true;
