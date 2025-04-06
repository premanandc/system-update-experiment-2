import { PrismaClient } from '@prisma/client';

// Export a single instance to be used throughout the app
const prisma = new PrismaClient();

export default prisma; 