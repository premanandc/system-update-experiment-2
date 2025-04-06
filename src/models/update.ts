import { PrismaClient } from '@prisma/client';

// Define UpdateStatus enum to match Prisma schema
export enum UpdateStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  TESTING = 'TESTING',
  DEPLOYING = 'DEPLOYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface UpdateCreateInput {
  name: string;
  version: string;
  description?: string;
  status?: UpdateStatus;
  packageIds?: string[];
}

export interface PrismaUpdate {
  id: string;
  name: string;
  version: string;
  description: string | null;
  status: UpdateStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Package {
  id: string;
  name: string;
  version: string;
  vendor: string | null;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Type for transaction client
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class Update {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: UpdateCreateInput): Promise<PrismaUpdate> {
    const { packageIds, ...updateData } = data;
    
    // Create update and connect packages in a transaction if packageIds are provided
    if (packageIds && packageIds.length > 0) {
      return this.prisma.$transaction(async (tx: TransactionClient) => {
        const update = await tx.update.create({
          data: updateData,
        });

        // Connect packages to the update
        for (const packageId of packageIds) {
          await tx.updatePackage.create({
            data: {
              updateId: update.id,
              packageId,
            },
          });
        }

        return update as unknown as PrismaUpdate;
      });
    }

    // Create update without packages
    return this.prisma.update.create({
      data: updateData,
    }) as unknown as PrismaUpdate;
  }

  async findById(id: string): Promise<PrismaUpdate | null> {
    return this.prisma.update.findUnique({
      where: { id },
    }) as unknown as (PrismaUpdate | null);
  }

  async findAll(): Promise<PrismaUpdate[]> {
    return this.prisma.update.findMany() as unknown as PrismaUpdate[];
  }

  async findByStatus(status: UpdateStatus): Promise<PrismaUpdate[]> {
    return this.prisma.update.findMany({
      where: { status },
    }) as unknown as PrismaUpdate[];
  }

  async update(id: string, data: Partial<Omit<UpdateCreateInput, 'packageIds'>>): Promise<PrismaUpdate> {
    return this.prisma.update.update({
      where: { id },
      data,
    }) as unknown as PrismaUpdate;
  }

  async delete(id: string): Promise<PrismaUpdate> {
    return this.prisma.update.delete({
      where: { id },
    }) as unknown as PrismaUpdate;
  }

  async setStatus(id: string, status: UpdateStatus): Promise<PrismaUpdate> {
    return this.prisma.update.update({
      where: { id },
      data: { status },
    }) as unknown as PrismaUpdate;
  }

  async addPackages(updateId: string, packageIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      packageIds.map((packageId) =>
        this.prisma.updatePackage.create({
          data: {
            updateId,
            packageId,
          },
        })
      )
    );
  }

  async removePackages(updateId: string, packageIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      packageIds.map((packageId) =>
        this.prisma.updatePackage.delete({
          where: {
            updateId_packageId: {
              updateId,
              packageId,
            },
          },
        })
      )
    );
  }

  async getPackages(updateId: string): Promise<Package[]> {
    const updatePackages = await this.prisma.updatePackage.findMany({
      where: { updateId },
      include: { package: true },
    });

    return updatePackages.map((up: { package: Package }) => up.package);
  }

  async publishUpdate(id: string): Promise<PrismaUpdate> {
    return this.setStatus(id, UpdateStatus.PUBLISHED);
  }

  async testUpdate(id: string): Promise<PrismaUpdate> {
    return this.setStatus(id, UpdateStatus.TESTING);
  }

  async deployUpdate(id: string): Promise<PrismaUpdate> {
    return this.setStatus(id, UpdateStatus.DEPLOYING);
  }

  async completeUpdate(id: string): Promise<PrismaUpdate> {
    return this.setStatus(id, UpdateStatus.COMPLETED);
  }

  async failUpdate(id: string): Promise<PrismaUpdate> {
    return this.setStatus(id, UpdateStatus.FAILED);
  }

  async cancelUpdate(id: string): Promise<PrismaUpdate> {
    return this.setStatus(id, UpdateStatus.CANCELLED);
  }
} 