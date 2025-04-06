import { PrismaClient } from '@prisma/client';
import { PrismaDeviceRepository } from '../models/device';
import { PrismaPackageRepository } from '../models/package';
import { PrismaUpdateRepository } from '../models/update';
import { PrismaPlanRepository } from '../models/plan';
import { PrismaBatchRepository } from '../models/batch';

// Create a singleton PrismaClient instance
const prisma = new PrismaClient();

// Create singleton repository instances
const deviceRepository = new PrismaDeviceRepository(prisma);
const packageRepository = new PrismaPackageRepository(prisma);
const updateRepository = new PrismaUpdateRepository(prisma);
const planRepository = new PrismaPlanRepository(prisma);
const batchRepository = new PrismaBatchRepository(prisma);

export {
  prisma,           // Export the prisma client for direct access when needed
  deviceRepository,
  packageRepository,
  updateRepository,
  planRepository,
  batchRepository
}; 