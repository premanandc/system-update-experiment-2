import { PrismaClient } from '@prisma/client';

// Define PackageStatus enum to match Prisma schema
export enum PackageStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  ARCHIVED = 'ARCHIVED'
}

export interface PackageCreateInput {
  name: string;
  version: string;
  vendor?: string;
  description?: string;
  status?: PackageStatus;
}

export interface PrismaPackage {
  id: string;
  name: string;
  version: string;
  vendor: string | null;
  description: string | null;
  status: PackageStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Package {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: PackageCreateInput): Promise<PrismaPackage> {
    return this.prisma.package.create({
      data,
    }) as Promise<PrismaPackage>;
  }

  async findById(id: string): Promise<PrismaPackage | null> {
    return this.prisma.package.findUnique({
      where: { id },
    }) as Promise<PrismaPackage | null>;
  }

  async findByNameAndVersion(name: string, version: string): Promise<PrismaPackage | null> {
    return this.prisma.package.findUnique({
      where: {
        name_version: {
          name,
          version
        }
      }
    }) as Promise<PrismaPackage | null>;
  }

  async findAll(): Promise<PrismaPackage[]> {
    return this.prisma.package.findMany() as Promise<PrismaPackage[]>;
  }

  async findByStatus(status: PackageStatus): Promise<PrismaPackage[]> {
    return this.prisma.package.findMany({
      where: { status },
    }) as Promise<PrismaPackage[]>;
  }

  async update(id: string, data: Partial<PackageCreateInput>): Promise<PrismaPackage> {
    return this.prisma.package.update({
      where: { id },
      data,
    }) as Promise<PrismaPackage>;
  }

  async delete(id: string): Promise<PrismaPackage> {
    return this.prisma.package.delete({
      where: { id },
    }) as Promise<PrismaPackage>;
  }

  async setStatus(id: string, status: PackageStatus): Promise<PrismaPackage> {
    return this.prisma.package.update({
      where: { id },
      data: { status },
    }) as Promise<PrismaPackage>;
  }

  async publishPackage(id: string): Promise<PrismaPackage> {
    return this.setStatus(id, PackageStatus.PUBLISHED);
  }

  async deprecatePackage(id: string): Promise<PrismaPackage> {
    return this.setStatus(id, PackageStatus.DEPRECATED);
  }

  async archivePackage(id: string): Promise<PrismaPackage> {
    return this.setStatus(id, PackageStatus.ARCHIVED);
  }
} 