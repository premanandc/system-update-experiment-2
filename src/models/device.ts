import { PrismaClient } from '@prisma/client';

// Define DeviceStatus enum to match Prisma schema
export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
  DECOMMISSIONED = 'DECOMMISSIONED'
}

// Domain entity
export interface Device {
  id: string;
  name: string;
  ipAddress: string | null;
  type: string;
  status: DeviceStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Input data for creating a device
export interface DeviceCreateInput {
  name: string;
  ipAddress?: string;
  type: string;
  status?: DeviceStatus;
}

// Pending Update information
export interface PendingUpdate {
  updateId: string;
  updateName: string;
  executionBatchId: string;
  batchId: string;
  batchName: string;
  executionId: string;
  planId: string;
  planName: string;
}

// Repository interface
export interface DeviceRepository {
  create(data: DeviceCreateInput): Promise<Device>;
  findById(id: string): Promise<Device | null>;
  findAll(): Promise<Device[]>;
  findByStatus(status: DeviceStatus): Promise<Device[]>;
  update(id: string, data: Partial<DeviceCreateInput>): Promise<Device>;
  delete(id: string): Promise<Device>;
  setStatus(id: string, status: DeviceStatus): Promise<Device>;
  getPendingUpdates(deviceId: string): Promise<PendingUpdate[]>;
}

// Prisma implementation of DeviceRepository
export class PrismaDeviceRepository implements DeviceRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: DeviceCreateInput): Promise<Device> {
    return this.prisma.device.create({
      data,
    }) as unknown as Device;
  }

  async findById(id: string): Promise<Device | null> {
    return this.prisma.device.findUnique({
      where: { id },
    }) as unknown as (Device | null);
  }

  async findAll(): Promise<Device[]> {
    try {
      return this.prisma.device.findMany() as unknown as Device[];
    } catch (error) {
      console.error('Error fetching all devices:', error);
      return [];
    }
  }

  async findByStatus(status: DeviceStatus): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { status },
    }) as unknown as Device[];
  }

  async update(id: string, data: Partial<DeviceCreateInput>): Promise<Device> {
    return this.prisma.device.update({
      where: { id },
      data,
    }) as unknown as Device;
  }

  async delete(id: string): Promise<Device> {
    return this.prisma.device.delete({
      where: { id },
    }) as unknown as Device;
  }

  async setStatus(id: string, status: DeviceStatus): Promise<Device> {
    return this.prisma.device.update({
      where: { id },
      data: { status },
    }) as unknown as Device;
  }

  async getPendingUpdates(deviceId: string): Promise<PendingUpdate[]> {
    const pendingUpdates = await this.prisma.executionDeviceStatus.findMany({
      where: {
        deviceId,
        updateSent: true,
        updateCompleted: false,
      },
      include: {
        executionBatch: {
          include: {
            batch: true,
            execution: {
              include: {
                plan: {
                  include: {
                    update: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return pendingUpdates.map((status: any) => ({
      updateId: status.executionBatch.execution.plan.update.id,
      updateName: status.executionBatch.execution.plan.update.name,
      executionBatchId: status.executionBatchId,
      batchId: status.executionBatch.batchId,
      batchName: status.executionBatch.batch.name,
      executionId: status.executionBatch.executionId,
      planId: status.executionBatch.execution.planId,
      planName: status.executionBatch.execution.plan.name
    }));
  }
} 