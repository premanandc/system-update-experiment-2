import { PrismaClient } from '@prisma/client';
import { Device, DeviceStatus } from './device';
import { PackageAction } from './update';

// Define PlanStatus enum to match Prisma schema
export enum PlanStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  READY = 'READY',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Define BatchType and BatchStatus enums for use in the Plan repository
export enum BatchType {
  TEST = 'TEST',
  MASS = 'MASS'
}

export enum BatchStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Domain entity
export interface Plan {
  id: string;
  name: string;
  description: string | null;
  updateId: string;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Batch interface used within the Plan repository
export interface PlanBatch {
  id: string;
  name: string;
  description: string | null;
  planId: string;
  sequence: number;
  type: BatchType;
  monitoringPeriod: number; // In hours
  status: BatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Input data for creating a plan
export interface PlanCreateInput {
  name: string;
  description?: string;
  updateId: string;
  status?: PlanStatus;
}

// Repository interface
export interface PlanRepository {
  create(data: PlanCreateInput): Promise<Plan>;
  findById(id: string): Promise<Plan | null>;
  approvePlan(id: string): Promise<Plan>;
  rejectPlan(id: string): Promise<Plan>;
  getBatches(planId: string): Promise<PlanBatch[]>;
  getAffectedDevices(updateId: string): Promise<Device[]>;
  generatePlan(updateId: string, deviceIds?: string[]): Promise<Plan>;
}

// Prisma implementation of PlanRepository
export class PrismaPlanRepository implements PlanRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: PlanCreateInput): Promise<Plan> {
    return this.prisma.plan.create({
      data,
    }) as unknown as Plan;
  }

  async findById(id: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({
      where: { id },
    }) as unknown as (Plan | null);
  }

  async approvePlan(id: string): Promise<Plan> {
    const plan = await this.findById(id);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== PlanStatus.DRAFT) {
      throw new Error('Only draft plans can be approved');
    }
    
    // Ensure the plan has batches
    const batches = await this.getBatches(id);
    if (batches.length === 0) {
      throw new Error('Cannot approve a plan without batches');
    }
    
    return this.prisma.plan.update({
      where: { id },
      data: { status: PlanStatus.APPROVED },
    }) as unknown as Plan;
  }

  async rejectPlan(id: string): Promise<Plan> {
    const plan = await this.findById(id);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== PlanStatus.DRAFT) {
      throw new Error('Only draft plans can be rejected');
    }
    
    return this.prisma.plan.update({
      where: { id },
      data: { status: PlanStatus.REJECTED },
    }) as unknown as Plan;
  }

  async getBatches(planId: string): Promise<PlanBatch[]> {
    const batches = await this.prisma.batch.findMany({
      where: { planId },
      orderBy: { sequence: 'asc' },
    });
    
    return batches.map((batch: any) => ({
      id: batch.id,
      name: batch.name,
      description: batch.description,
      planId: batch.planId,
      sequence: batch.sequence,
      type: batch.type as unknown as BatchType,
      monitoringPeriod: batch.monitoringPeriod,
      status: batch.status as unknown as BatchStatus,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt
    }));
  }

  // Get affected devices for an update
  async getAffectedDevices(updateId: string): Promise<Device[]> {
    // First, get the update and its packages
    const update = await this.prisma.update.findUnique({
      where: { id: updateId },
      include: {
        packages: {
          include: {
            package: true
          }
        }
      }
    });

    // Explicit check for null update - this makes the error handling more robust
    // against mutations that might remove this block
    if (update === null || update === undefined) {
      throw new Error('Update not found');
    }

    // No packages means no affected devices
    if (update.packages.length === 0) {
      return [];
    }

    // Get all online devices
    const allDevices = await this.prisma.device.findMany({
      where: {
        status: 'ONLINE'
      },
      include: {
        installedPackages: {
          include: {
            package: true
          }
        }
      }
    });

    // For each device, check if it's affected by the update
    const affectedDevices: Device[] = [];
    
    for (const device of allDevices) {
      // Check each package in the update
      let isAffected = false;
      
      for (const updatePackage of update.packages) {
        const { package: pkg, action, forced } = updatePackage;

        // If this is a forced installation, the device is affected
        if (forced) {
          isAffected = true;
          break;
        }

        // Find if the device has this package installed
        const installedPackage = device.installedPackages.find(
          (ip: any) => ip.package.name === pkg.name
        );

        // Use explicit string comparison for action to make it mutation-resistant
        const isUninstall = action === 'UNINSTALL';
        const isInstall = action === 'INSTALL';

        if (isInstall) {
          // Case 1: Package needs to be installed
          // Device is affected if it doesn't have the package or has an older version
          if (!installedPackage) {
            isAffected = true; // Package not installed
            break;
          }

          // Check if device has an older version
          if (this.compareVersions(installedPackage.package.version, pkg.version) < 0) {
            isAffected = true; // Older version installed
            break;
          }
        } else if (isUninstall) {
          // Case 3: Package needs to be uninstalled
          // Device is affected if it has the package installed
          if (installedPackage) {
            isAffected = true;
            break;
          }
        }
      }
      
      if (isAffected) {
        affectedDevices.push({
          id: device.id,
          name: device.name,
          ipAddress: device.ipAddress,
          type: device.type,
          status: device.status as unknown as DeviceStatus,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt
        });
      }
    }

    return affectedDevices;
  }
  
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    
    return 0; // Versions are equal
  }

  async generatePlan(updateId: string, deviceIds?: string[]): Promise<Plan> {
    // 1. Get the update to make sure it exists
    const update = await this.prisma.update.findUnique({
      where: { id: updateId },
    });

    if (!update) {
      throw new Error('Update not found');
    }

    // 2. Get affected devices
    let affectedDevices = await this.getAffectedDevices(updateId);

    // 3. If deviceIds is provided, filter to only include those devices
    if (deviceIds && deviceIds.length > 0) {
      affectedDevices = affectedDevices.filter(device => 
        deviceIds.includes(device.id)
      );
    }

    // 4. If no affected devices, throw an error
    if (affectedDevices.length === 0) {
      throw new Error('No affected devices found for this update');
    }

    // 5. Create the plan
    const planName = `Plan for ${update.name} v${update.version}`;
    const plan = await this.create({
      name: planName,
      description: `Automatically generated plan for update ${update.name} v${update.version}`,
      updateId: updateId,
    });

    // 6. Create batches based on the number of devices
    const totalDevices = affectedDevices.length;
    
    if (totalDevices === 1) {
      // For a single device, create one mass batch
      await this.createBatch(plan.id, 'Mass Batch', affectedDevices, 1, BatchType.MASS);
    } else if (totalDevices < 5) {
      // For 2-4 devices, create one test batch and one mass batch
      const testDevices = [affectedDevices[0]];
      const massDevices = affectedDevices.slice(1);
      
      await this.createBatch(plan.id, 'Test Batch', testDevices, 1, BatchType.TEST);
      await this.createBatch(plan.id, 'Mass Batch', massDevices, 2, BatchType.MASS);
    } else {
      // For 5+ devices, create two test batches and one mass batch
      const testBatch1 = [affectedDevices[0]];
      const testBatch2 = [affectedDevices[1]];
      const massDevices = affectedDevices.slice(2);
      
      await this.createBatch(plan.id, 'Test Batch 1', testBatch1, 1, BatchType.TEST);
      await this.createBatch(plan.id, 'Test Batch 2', testBatch2, 2, BatchType.TEST);
      await this.createBatch(plan.id, 'Mass Batch', massDevices, 3, BatchType.MASS);
    }

    return plan;
  }

  // Helper method to create a batch with devices
  private async createBatch(
    planId: string, 
    name: string, 
    devices: Device[], 
    sequence: number, 
    type: BatchType,
    monitoringPeriod: number = 24 // Default 24 hour monitoring
  ): Promise<void> {
    // Create the batch
    const batch = await this.prisma.batch.create({
      data: {
        name,
        description: `Mass batch with ${devices.length} device${devices.length !== 1 ? 's' : ''}`,
        planId,
        sequence,
        type,
        monitoringPeriod,
      },
    });
    
    // Add devices to the batch
    for (const device of devices) {
      await this.prisma.deviceBatch.create({
        data: {
          deviceId: device.id,
          batchId: batch.id,
        },
      });
    }
  }
} 