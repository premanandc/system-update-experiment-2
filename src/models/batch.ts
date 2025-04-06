import { PrismaClient } from '@prisma/client';
import { Device } from './device';

// Define BatchType enum to match Prisma schema
export enum BatchType {
  TEST = 'TEST',
  MASS = 'MASS'
}

// Define BatchStatus enum to match Prisma schema
export enum BatchStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Domain entity
export interface Batch {
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

// Input data for creating a batch
export interface BatchCreateInput {
  name: string;
  description?: string;
  planId: string;
  sequence: number;
  type?: BatchType;
  monitoringPeriod?: number;
  status?: BatchStatus;
}

// Repository interface - note: we'll likely use this through the Plan repository
export interface BatchRepository {
  create(data: BatchCreateInput): Promise<Batch>;
  findById(id: string): Promise<Batch | null>;
  findByPlanId(planId: string): Promise<Batch[]>;
  update(id: string, data: Partial<BatchCreateInput>): Promise<Batch>;
  delete(id: string): Promise<Batch>;
  
  // Device operations
  getDevices(batchId: string): Promise<Device[]>;
  addDevice(batchId: string, deviceId: string): Promise<void>;
  removeDevice(batchId: string, deviceId: string): Promise<void>;
}

// Prisma implementation of BatchRepository
export class PrismaBatchRepository implements BatchRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: BatchCreateInput): Promise<Batch> {
    return this.prisma.batch.create({
      data,
    }) as unknown as Batch;
  }

  async findById(id: string): Promise<Batch | null> {
    return this.prisma.batch.findUnique({
      where: { id },
    }) as unknown as (Batch | null);
  }

  async findByPlanId(planId: string): Promise<Batch[]> {
    return this.prisma.batch.findMany({
      where: { planId },
      orderBy: { sequence: 'asc' },
    }) as unknown as Batch[];
  }

  async update(id: string, data: Partial<BatchCreateInput>): Promise<Batch> {
    return this.prisma.batch.update({
      where: { id },
      data,
    }) as unknown as Batch;
  }

  async delete(id: string): Promise<Batch> {
    return this.prisma.batch.delete({
      where: { id },
    }) as unknown as Batch;
  }

  async getDevices(batchId: string): Promise<Device[]> {
    const deviceBatches = await this.prisma.deviceBatch.findMany({
      where: { batchId },
      include: { device: true },
    });

    return deviceBatches.map((db: { device: any }) => ({
      id: db.device.id,
      name: db.device.name,
      ipAddress: db.device.ipAddress,
      type: db.device.type,
      status: db.device.status as unknown as Device['status'],
      createdAt: db.device.createdAt,
      updatedAt: db.device.updatedAt
    }));
  }

  async addDevice(batchId: string, deviceId: string): Promise<void> {
    await this.prisma.deviceBatch.create({
      data: {
        deviceId,
        batchId,
      },
    });
  }

  async removeDevice(batchId: string, deviceId: string): Promise<void> {
    const deviceBatch = await this.prisma.deviceBatch.findFirst({
      where: {
        deviceId,
        batchId,
      },
    });

    if (!deviceBatch) {
      throw new Error('Device is not in this batch');
    }

    await this.prisma.deviceBatch.delete({
      where: {
        id: deviceBatch.id,
      },
    });
  }
} 