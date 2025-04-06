import { PrismaClient } from '@prisma/client';
import { Package } from './package';

// Define enums to match Prisma schema
export enum UpdateStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  TESTING = 'TESTING',
  DEPLOYING = 'DEPLOYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum PackageAction {
  INSTALL = 'INSTALL',
  UNINSTALL = 'UNINSTALL'
}

// Domain entity
export interface Update {
  id: string;
  name: string;
  version: string;
  description: string | null;
  status: UpdateStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for package within an update
export interface UpdatePackage {
  id: string;
  updateId: string;
  packageId: string;
  package: Package;
  action: PackageAction;
  forced: boolean;
  requiresReboot: boolean;
  createdAt: Date;
}

// Input data for creating an update
export interface UpdateCreateInput {
  name: string;
  version: string;
  description?: string;
  status?: UpdateStatus;
  packages?: UpdatePackageInput[];
}

// Input for adding a package to an update
export interface UpdatePackageInput {
  packageId: string;
  action?: PackageAction;
  forced?: boolean;
  requiresReboot?: boolean;
}

// Type for transaction client
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Repository interface
export interface UpdateRepository {
  create(data: UpdateCreateInput): Promise<Update>;
  findById(id: string): Promise<Update | null>;
  findAll(): Promise<Update[]>;
  findByStatus(status: UpdateStatus): Promise<Update[]>;
  update(id: string, data: Partial<Omit<UpdateCreateInput, 'packages'>>): Promise<Update>;
  delete(id: string): Promise<Update>;
  addPackage(updateId: string, packageInput: UpdatePackageInput): Promise<void>;
  addPackages(updateId: string, packageInputs: UpdatePackageInput[]): Promise<void>;
  updatePackageOptions(updateId: string, packageId: string, options: Partial<Omit<UpdatePackageInput, 'packageId'>>): Promise<void>;
  removePackage(updateId: string, packageId: string): Promise<void>;
  removePackages(updateId: string, packageIds: string[]): Promise<void>;
  getPackages(updateId: string): Promise<Package[]>;
  getUpdatePackages(updateId: string): Promise<UpdatePackage[]>;
  requiresReboot(updateId: string): Promise<boolean>;
  publishUpdate(id: string): Promise<Update>;
  testUpdate(id: string): Promise<Update>;
  deployUpdate(id: string): Promise<Update>;
  completeUpdate(id: string): Promise<Update>;
  failUpdate(id: string): Promise<Update>;
  cancelUpdate(id: string): Promise<Update>;
}

// Prisma implementation of UpdateRepository
export class PrismaUpdateRepository implements UpdateRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: UpdateCreateInput): Promise<Update> {
    const { packages, ...updateData } = data;
    
    // Create update and connect packages in a transaction if packages are provided
    if (packages && packages.length > 0) {
      return this.prisma.$transaction(async (tx: TransactionClient) => {
        const update = await tx.update.create({
          data: updateData,
        });

        // Connect packages to the update
        for (const pkg of packages) {
          await tx.updatePackage.create({
            data: {
              updateId: update.id,
              packageId: pkg.packageId,
              action: pkg.action || undefined,
              forced: pkg.forced || undefined,
              requiresReboot: pkg.requiresReboot || undefined,
            },
          });
        }

        return update as unknown as Update;
      });
    }

    // Create update without packages
    return this.prisma.update.create({
      data: updateData,
    }) as unknown as Update;
  }

  async findById(id: string): Promise<Update | null> {
    return this.prisma.update.findUnique({
      where: { id },
    }) as unknown as (Update | null);
  }

  async findAll(): Promise<Update[]> {
    return this.prisma.update.findMany() as unknown as Update[];
  }

  async findByStatus(status: UpdateStatus): Promise<Update[]> {
    return this.prisma.update.findMany({
      where: { status },
    }) as unknown as Update[];
  }

  async update(id: string, data: Partial<Omit<UpdateCreateInput, 'packages'>>): Promise<Update> {
    return this.prisma.update.update({
      where: { id },
      data,
    }) as unknown as Update;
  }

  async delete(id: string): Promise<Update> {
    return this.prisma.update.delete({
      where: { id },
    }) as unknown as Update;
  }

  async addPackage(updateId: string, packageInput: UpdatePackageInput): Promise<void> {
    await this.prisma.updatePackage.create({
      data: {
        updateId,
        packageId: packageInput.packageId,
        action: packageInput.action || undefined,
        forced: packageInput.forced || undefined,
        requiresReboot: packageInput.requiresReboot || undefined,
      },
    });
  }

  async addPackages(updateId: string, packageInputs: UpdatePackageInput[]): Promise<void> {
    await this.prisma.$transaction(
      packageInputs.map((pkg) =>
        this.prisma.updatePackage.create({
          data: {
            updateId,
            packageId: pkg.packageId,
            action: pkg.action || undefined,
            forced: pkg.forced || undefined,
            requiresReboot: pkg.requiresReboot || undefined,
          },
        })
      )
    );
  }

  async updatePackageOptions(
    updateId: string, 
    packageId: string, 
    options: Partial<Omit<UpdatePackageInput, 'packageId'>>
  ): Promise<void> {
    await this.prisma.updatePackage.update({
      where: {
        updateId_packageId: {
          updateId,
          packageId,
        },
      },
      data: options,
    });
  }

  async removePackage(updateId: string, packageId: string): Promise<void> {
    await this.prisma.updatePackage.delete({
      where: {
        updateId_packageId: {
          updateId,
          packageId,
        },
      },
    });
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

  async getUpdatePackages(updateId: string): Promise<UpdatePackage[]> {
    const updatePackages = await this.prisma.updatePackage.findMany({
      where: { updateId },
      include: { package: true },
    });

    return updatePackages.map((up: any) => ({
      id: up.id,
      updateId: up.updateId,
      packageId: up.packageId,
      action: up.action as PackageAction,
      forced: up.forced,
      requiresReboot: up.requiresReboot,
      createdAt: up.createdAt,
      package: {
        id: up.package.id,
        name: up.package.name,
        version: up.package.version,
        description: up.package.description,
        vendor: up.package.vendor,
        status: up.package.status as unknown as Package['status'],
        createdAt: up.package.createdAt,
        updatedAt: up.package.updatedAt
      }
    }));
  }

  async getPackages(updateId: string): Promise<Package[]> {
    const updatePackages = await this.prisma.updatePackage.findMany({
      where: { updateId },
      include: { package: true },
    });

    // Fix type conversion - explicitly map to our Package type
    return updatePackages.map((up: { package: any }) => ({
      id: up.package.id,
      name: up.package.name,
      version: up.package.version,
      description: up.package.description,
      vendor: up.package.vendor,
      status: up.package.status as unknown as Package['status'],
      createdAt: up.package.createdAt,
      updatedAt: up.package.updatedAt
    }));
  }

  async requiresReboot(updateId: string): Promise<boolean> {
    const updatePackages = await this.prisma.updatePackage.findMany({
      where: { updateId },
      select: { requiresReboot: true }
    });
    
    // Return true if any package requires a reboot
    return updatePackages.some((pkg: { requiresReboot: boolean }) => pkg.requiresReboot);
  }

  async publishUpdate(id: string): Promise<Update> {
    const update = await this.findById(id);
    if (!update) throw new Error('Update not found');
    if (update.status !== UpdateStatus.DRAFT) {
      throw new Error('Only draft updates can be published');
    }

    // Additional validation could be added here
    // For example, checking if the update has at least one package
    const packages = await this.getPackages(id);
    if (packages.length === 0) {
      throw new Error('Cannot publish an update without packages');
    }
    
    return this.prisma.update.update({
      where: { id },
      data: { status: UpdateStatus.PUBLISHED },
    }) as unknown as Update;
  }

  async testUpdate(id: string): Promise<Update> {
    const update = await this.findById(id);
    if (!update) throw new Error('Update not found');
    if (update.status !== UpdateStatus.PUBLISHED) {
      throw new Error('Only published updates can be moved to testing');
    }
    
    return this.prisma.update.update({
      where: { id },
      data: { status: UpdateStatus.TESTING },
    }) as unknown as Update;
  }

  async deployUpdate(id: string): Promise<Update> {
    const update = await this.findById(id);
    if (!update) throw new Error('Update not found');
    if (update.status !== UpdateStatus.TESTING) {
      throw new Error('Only tested updates can be deployed');
    }
    
    return this.prisma.update.update({
      where: { id },
      data: { status: UpdateStatus.DEPLOYING },
    }) as unknown as Update;
  }

  async completeUpdate(id: string): Promise<Update> {
    const update = await this.findById(id);
    if (!update) throw new Error('Update not found');
    if (update.status !== UpdateStatus.DEPLOYING) {
      throw new Error('Only deploying updates can be marked as completed');
    }
    
    return this.prisma.update.update({
      where: { id },
      data: { status: UpdateStatus.COMPLETED },
    }) as unknown as Update;
  }

  async failUpdate(id: string): Promise<Update> {
    const update = await this.findById(id);
    if (!update) throw new Error('Update not found');
    if (![UpdateStatus.TESTING, UpdateStatus.DEPLOYING].includes(update.status)) {
      throw new Error('Only testing or deploying updates can be marked as failed');
    }
    
    return this.prisma.update.update({
      where: { id },
      data: { status: UpdateStatus.FAILED },
    }) as unknown as Update;
  }

  async cancelUpdate(id: string): Promise<Update> {
    const update = await this.findById(id);
    if (!update) throw new Error('Update not found');
    if (![UpdateStatus.DRAFT, UpdateStatus.PUBLISHED, UpdateStatus.TESTING].includes(update.status)) {
      throw new Error('Only draft, published, or testing updates can be cancelled');
    }
    
    return this.prisma.update.update({
      where: { id },
      data: { status: UpdateStatus.CANCELLED },
    }) as unknown as Update;
  }
} 