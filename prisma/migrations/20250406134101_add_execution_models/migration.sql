/*
  Warnings:

  - You are about to drop the column `batchId` on the `executions` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `executions` table. All the data in the column will be lost.
  - You are about to drop the column `deviceId` on the `executions` table. All the data in the column will be lost.
  - You are about to drop the column `logs` on the `executions` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `executions` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "execution_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "monitoringEndTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "execution_batches_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "executions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "execution_batches_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "execution_device_statuses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionBatchId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "updateSent" BOOLEAN NOT NULL DEFAULT false,
    "updateCompleted" BOOLEAN NOT NULL DEFAULT false,
    "succeeded" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "execution_device_statuses_executionBatchId_fkey" FOREIGN KEY ("executionBatchId") REFERENCES "execution_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "execution_device_statuses_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "executions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_executions" ("createdAt", "id", "planId", "status", "updatedAt") SELECT "createdAt", "id", "planId", "status", "updatedAt" FROM "executions";
DROP TABLE "executions";
ALTER TABLE "new_executions" RENAME TO "executions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "execution_device_statuses_executionBatchId_deviceId_key" ON "execution_device_statuses"("executionBatchId", "deviceId");
