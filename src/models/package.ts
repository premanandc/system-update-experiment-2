import { PrismaClient } from '@prisma/client';

// Define PackageStatus enum to match Prisma schema
export enum PackageStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  ARCHIVED = 'ARCHIVED'
}

// Domain entity
export interface Package {
  id: string;
  name: string;
  version: string;
  vendor: string | null;
  description: string | null;
  status: PackageStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Input data for creating a package
export interface PackageCreateInput {
  name: string;
  version: string;
  vendor?: string;
  description?: string;
  status?: PackageStatus;
}

// Repository interface
export interface PackageRepository {
  create(data: PackageCreateInput): Promise<Package>;
  findById(id: string): Promise<Package | null>;
  findByNameAndVersion(name: string, version: string): Promise<Package | null>;
  findAll(): Promise<Package[]>;
  findByStatus(status: PackageStatus): Promise<Package[]>;
  update(id: string, data: Partial<PackageCreateInput>): Promise<Package>;
  delete(id: string): Promise<Package>;
  setStatus(id: string, status: PackageStatus): Promise<Package>;
  publishPackage(id: string): Promise<Package>;
  deprecatePackage(id: string): Promise<Package>;
  archivePackage(id: string): Promise<Package>;
}

// Prisma implementation of PackageRepository
export class PrismaPackageRepository implements PackageRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: PackageCreateInput): Promise<Package> {
    return this.prisma.package.create({
      data,
    }) as unknown as Package;
  }

  async findById(id: string): Promise<Package | null> {
    return this.prisma.package.findUnique({
      where: { id },
    }) as unknown as (Package | null);
  }

  async findByNameAndVersion(name: string, version: string): Promise<Package | null> {
    return this.prisma.package.findUnique({
      where: {
        name_version: {
          name,
          version
        }
      }
    }) as unknown as (Package | null);
  }

  async findAll(): Promise<Package[]> {
    return this.prisma.package.findMany() as unknown as Package[];
  }

  async findByStatus(status: PackageStatus): Promise<Package[]> {
    return this.prisma.package.findMany({
      where: { status },
    }) as unknown as Package[];
  }

  async update(id: string, data: Partial<PackageCreateInput>): Promise<Package> {
    return this.prisma.package.update({
      where: { id },
      data,
    }) as unknown as Package;
  }

  async delete(id: string): Promise<Package> {
    return this.prisma.package.delete({
      where: { id },
    }) as unknown as Package;
  }

  async setStatus(id: string, status: PackageStatus): Promise<Package> {
    return this.prisma.package.update({
      where: { id },
      data: { status },
    }) as unknown as Package;
  }

  async publishPackage(id: string): Promise<Package> {
    return this.setStatus(id, PackageStatus.PUBLISHED);
  }

  async deprecatePackage(id: string): Promise<Package> {
    return this.setStatus(id, PackageStatus.DEPRECATED);
  }

  async archivePackage(id: string): Promise<Package> {
    return this.setStatus(id, PackageStatus.ARCHIVED);
  }
} 