import { PrismaClient } from '@prisma/client';
import { PrismaDeviceRepository } from '../models/device';
import { PrismaPackageRepository } from '../models/package';
import { PrismaUpdateRepository } from '../models/update';

// Create singleton instance of Prisma Client
const prisma = new PrismaClient();

// Create repository instances
export const deviceRepository = new PrismaDeviceRepository(prisma);
export const packageRepository = new PrismaPackageRepository(prisma);
export const updateRepository = new PrismaUpdateRepository(prisma);

// Export the prisma client for direct usage when needed
export default prisma; 