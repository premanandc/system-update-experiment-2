-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "vendor" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "updates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "device_packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "installedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "device_packages_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "device_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "updateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "plans_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "updates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "planId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "batches_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "device_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_batches_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "device_batches_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "batchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "logs" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "executions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "executions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "executions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "update_packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "updateId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'INSTALL',
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "requiresReboot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "update_packages_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "updates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "update_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "packages_name_version_key" ON "packages"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "device_packages_deviceId_packageId_key" ON "device_packages"("deviceId", "packageId");

-- CreateIndex
CREATE UNIQUE INDEX "device_batches_deviceId_batchId_key" ON "device_batches"("deviceId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "update_packages_updateId_packageId_key" ON "update_packages"("updateId", "packageId");
