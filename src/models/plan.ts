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

// Type for transaction client
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Repository interface
export interface PlanRepository {
  create(data: PlanCreateInput): Promise<Plan>;
  findById(id: string): Promise<Plan | null>;
  findAll(): Promise<Plan[]>;
  findByUpdateId(updateId: string): Promise<Plan[]>;
  findByStatus(status: PlanStatus): Promise<Plan[]>;
  update(id: string, data: Partial<PlanCreateInput>): Promise<Plan>;
  delete(id: string): Promise<Plan>;
  
  // Status transitions
  approvePlan(id: string): Promise<Plan>;
  rejectPlan(id: string): Promise<Plan>;
  
  // Batch operations
  getBatches(planId: string): Promise<PlanBatch[]>;
  
  // Plan generation
  generatePlan(updateId: string, deviceIds?: string[]): Promise<Plan>;
  getAffectedDevices(updateId: string): Promise<Device[]>;
  
  // Plan modification
  addDeviceToBatch(planId: string, batchId: string, deviceId: string): Promise<void>;
  removeDeviceFromBatch(planId: string, batchId: string, deviceId: string): Promise<void>;
  moveDeviceBetweenBatches(planId: string, fromBatchId: string, toBatchId: string, deviceId: string): Promise<void>;
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

  async findAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany() as unknown as Plan[];
  }

  async findByUpdateId(updateId: string): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      where: { updateId },
    }) as unknown as Plan[];
  }

  async findByStatus(status: PlanStatus): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      where: { status },
    }) as unknown as Plan[];
  }

  async update(id: string, data: Partial<PlanCreateInput>): Promise<Plan> {
    return this.prisma.plan.update({
      where: { id },
      data,
    }) as unknown as Plan;
  }

  async delete(id: string): Promise<Plan> {
    return this.prisma.plan.delete({
      where: { id },
    }) as unknown as Plan;
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

  // Plan generation
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

    // 6. Create batches based on strategy
    await this.createBatchesForPlan(plan.id, affectedDevices);

    return plan;
  }

  // Helper method to create batches for a plan based on strategy
  private async createBatchesForPlan(planId: string, devices: Device[]): Promise<void> {
    const totalDevices = devices.length;
    
    // Strategy implementation based on number of affected devices
    if (totalDevices === 1) {
      // Case 1: Only one device, create a single mass batch
      await this.createBatch(planId, 'Mass Batch', devices, 1, BatchType.MASS);
    } else if (totalDevices < 5) {
      // Case 2: Less than 5 devices
      // Create one test batch with a single device
      const testDevices = [devices[0]];
      const massDevices = devices.slice(1);
      
      await this.createBatch(planId, 'Test Batch', testDevices, 1, BatchType.TEST);
      await this.createBatch(planId, 'Mass Batch', massDevices, 2, BatchType.MASS);
    } else {
      // Case 3: 5 or more devices
      // Create two test batches, each with 10% of devices (or at least 1)
      const testBatchSize = Math.max(1, Math.ceil(totalDevices * 0.1));
      const test1Devices = devices.slice(0, testBatchSize);
      const test2Devices = devices.slice(testBatchSize, testBatchSize * 2);
      const massDevices = devices.slice(testBatchSize * 2);
      
      await this.createBatch(planId, 'Test Batch 1', test1Devices, 1, BatchType.TEST);
      await this.createBatch(planId, 'Test Batch 2', test2Devices, 2, BatchType.TEST);
      
      if (massDevices.length > 0) {
        await this.createBatch(planId, 'Mass Batch', massDevices, 3, BatchType.MASS);
      }
    }
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
        description: `${type} batch with ${devices.length} devices`,
        planId,
        sequence,
        type,
        monitoringPeriod,
      },
    });
    
    // Add devices to the batch
    if (devices.length > 0) {
      await this.prisma.$transaction(
        devices.map(device => 
          this.prisma.deviceBatch.create({
            data: {
              deviceId: device.id,
              batchId: batch.id,
            },
          })
        )
      );
    }
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

    if (!update) {
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

        if (action === 'INSTALL') {
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
        } else if (action === 'UNINSTALL') {
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

  // Helper method to compare version strings (returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2)
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    const maxLength = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const part1 = i < parts1.length ? parts1[i] : 0;
      const part2 = i < parts2.length ? parts2[i] : 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    
    return 0; // Versions are equal
  }
  
  async addDeviceToBatch(planId: string, batchId: string, deviceId: string): Promise<void> {
    // Verify plan exists and is in draft status
    const plan = await this.findById(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== PlanStatus.DRAFT) {
      throw new Error('Can only modify draft plans');
    }
    
    // Verify batch belongs to plan
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
    });
    if (!batch || batch.planId !== planId) {
      throw new Error('Batch not found or does not belong to plan');
    }
    
    // Check if device is affected by the update
    const affectedDevices = await this.getAffectedDevices(plan.updateId);
    const isAffected = affectedDevices.some(device => device.id === deviceId);
    if (!isAffected) {
      throw new Error('Device is not affected by this update');
    }
    
    // Check if device is already in a batch
    const existingDeviceBatch = await this.prisma.deviceBatch.findFirst({
      where: {
        deviceId,
        batch: {
          planId,
        },
      },
    });
    
    if (existingDeviceBatch) {
      throw new Error('Device is already part of the plan');
    }
    
    // Add device to batch
    await this.prisma.deviceBatch.create({
      data: {
        deviceId,
        batchId,
      },
    });
  }

  async removeDeviceFromBatch(planId: string, batchId: string, deviceId: string): Promise<void> {
    // Verify plan exists and is in draft status
    const plan = await this.findById(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== PlanStatus.DRAFT) {
      throw new Error('Can only modify draft plans');
    }
    
    // Verify device is in the batch
    const deviceBatch = await this.prisma.deviceBatch.findFirst({
      where: {
        deviceId,
        batchId,
        batch: {
          planId,
        },
      },
    });
    
    if (!deviceBatch) {
      throw new Error('Device is not in this batch');
    }
    
    // Remove device from batch
    await this.prisma.deviceBatch.delete({
      where: {
        id: deviceBatch.id,
      },
    });
  }

  async moveDeviceBetweenBatches(
    planId: string,
    fromBatchId: string,
    toBatchId: string,
    deviceId: string
  ): Promise<void> {
    // Verify plan exists and is in draft status
    const plan = await this.findById(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== PlanStatus.DRAFT) {
      throw new Error('Can only modify draft plans');
    }
    
    // Verify batches belong to plan
    const fromBatch = await this.prisma.batch.findUnique({
      where: { id: fromBatchId },
    });
    
    const toBatch = await this.prisma.batch.findUnique({
      where: { id: toBatchId },
    });
    
    if (!fromBatch || fromBatch.planId !== planId) {
      throw new Error('Source batch not found or does not belong to plan');
    }
    
    if (!toBatch || toBatch.planId !== planId) {
      throw new Error('Target batch not found or does not belong to plan');
    }
    
    // Verify device is in the source batch
    const deviceBatch = await this.prisma.deviceBatch.findFirst({
      where: {
        deviceId,
        batchId: fromBatchId,
      },
    });
    
    if (!deviceBatch) {
      throw new Error('Device is not in the source batch');
    }
    
    // Move device to target batch (delete from source and create in target)
    await this.prisma.$transaction(async (tx: TransactionClient) => {
      await tx.deviceBatch.delete({
        where: {
          id: deviceBatch.id,
        },
      });
      
      await tx.deviceBatch.create({
        data: {
          deviceId,
          batchId: toBatchId,
        },
      });
    });
  }
} 