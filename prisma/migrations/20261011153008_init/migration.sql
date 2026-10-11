-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'admin', 'staff');

-- CreateEnum
CREATE TYPE "PriceMode" AS ENUM ('exact', 'from', 'hidden');

-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('house', 'room', 'venue', 'whole');

-- CreateEnum
CREATE TYPE "ExtraPriceType" AS ENUM ('per_stay', 'per_night', 'per_person', 'per_item');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'proposal', 'booked', 'done', 'lost');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('site', 'phone', 'messenger', 'other');

-- CreateEnum
CREATE TYPE "ContactVia" AS ENUM ('call', 'telegram', 'viber');

-- CreateEnum
CREATE TYPE "LeadEventType" AS ENUM ('created', 'status', 'note', 'call', 'proposal_sent', 'proposal_viewed', 'proposal_accepted', 'contribution');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('pledged', 'marked_paid', 'confirmed');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "tagline" TEXT,
    "description" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "instagram" TEXT,
    "heroPhoto" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'linen',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
    "checkInTime" TEXT NOT NULL DEFAULT '15:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '12:00',
    "bookingTerms" TEXT,
    "holidays" TEXT[],
    "showAvailability" BOOLEAN NOT NULL DEFAULT true,
    "priceMode" "PriceMode" NOT NULL DEFAULT 'exact',
    "depositPercent" INTEGER NOT NULL DEFAULT 30,
    "callbackMinutes" INTEGER NOT NULL DEFAULT 60,
    "paymentDetails" TEXT,
    "telegramChatId" TEXT,
    "proposalsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "UnitKind" NOT NULL DEFAULT 'house',
    "summary" TEXT,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "photos" TEXT[],
    "amenities" TEXT[],
    "longStayFromNight" INTEGER,
    "longStayPercent" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "icalToken" TEXT NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "holidaysOnly" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE,
    "endDate" DATE,
    "minGuests" INTEGER NOT NULL DEFAULT 1,
    "maxGuests" INTEGER,
    "includedGuests" INTEGER NOT NULL,
    "pricePerNight" INTEGER NOT NULL,
    "extraGuestPrice" INTEGER NOT NULL DEFAULT 0,
    "bookableWithinDays" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extra" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceType" "ExtraPriceType" NOT NULL,
    "price" INTEGER NOT NULL,
    "unitLabel" TEXT,
    "maxQty" INTEGER NOT NULL DEFAULT 1,
    "group" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "source" "LeadSource" NOT NULL DEFAULT 'site',
    "occasion" TEXT,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "guests" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactVia" "ContactVia" NOT NULL DEFAULT 'call',
    "comment" TEXT,
    "extras" JSONB NOT NULL DEFAULT '[]',
    "quote" JSONB,
    "estimate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "LeadEventType" NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "chosenOptionId" TEXT,
    "message" TEXT,
    "prepaymentAmount" INTEGER NOT NULL,
    "splitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'pledged',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,
    "reason" TEXT,
    "feedId" TEXT,
    "externalId" TEXT,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarFeed" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "CalendarFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_icalToken_key" ON "Unit"("icalToken");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_propertyId_slug_key" ON "Unit"("propertyId", "slug");

-- CreateIndex
CREATE INDEX "Lead_propertyId_status_idx" ON "Lead"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Lead_unitId_checkIn_idx" ON "Lead"("unitId", "checkIn");

-- CreateIndex
CREATE INDEX "LeadEvent_leadId_createdAt_idx" ON "LeadEvent"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_leadId_key" ON "Proposal"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_token_key" ON "Proposal"("token");

-- CreateIndex
CREATE INDEX "Block_unitId_start_idx" ON "Block"("unitId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "Block_feedId_externalId_key" ON "Block"("feedId", "externalId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extra" ADD CONSTRAINT "Extra_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "CalendarFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarFeed" ADD CONSTRAINT "CalendarFeed_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Защита от двойной брони на уровне БД.
-- Две заявки со статусом booked/done на один объект не могут пересекаться по датам,
-- даже если два администратора нажмут «Подтвердить» одновременно.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_no_double_booking"
  EXCLUDE USING gist (
    "unitId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  ) WHERE ("status" IN ('booked', 'done') AND "unitId" IS NOT NULL);
