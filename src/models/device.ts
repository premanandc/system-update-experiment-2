import { PrismaClient } from '@prisma/client';

// Define DeviceStatus enum to match Prisma schema
export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
  DECOMMISSIONED = 'DECOMMISSIONED'
}

export interface DeviceCreateInput {
  name: string;
  ipAddress?: string;
  type: string;
  status?: DeviceStatus;
}

export interface PrismaDevice {
  id: string;
  name: string;
  ipAddress: string | null;
  type: string;
  status: DeviceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Device {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: DeviceCreateInput): Promise<PrismaDevice> {
    return this.prisma.device.create({
      data,
    }) as Promise<PrismaDevice>;
  }

  async findById(id: string): Promise<PrismaDevice | null> {
    return this.prisma.device.findUnique({
      where: { id },
    }) as Promise<PrismaDevice | null>;
  }

  async findAll(): Promise<PrismaDevice[]> {
    return this.prisma.device.findMany() as Promise<PrismaDevice[]>;
  }

  async findByStatus(status: DeviceStatus): Promise<PrismaDevice[]> {
    return this.prisma.device.findMany({
      where: { status },
    }) as Promise<PrismaDevice[]>;
  }

  async update(id: string, data: Partial<DeviceCreateInput>): Promise<PrismaDevice> {
    return this.prisma.device.update({
      where: { id },
      data,
    }) as Promise<PrismaDevice>;
  }

  async delete(id: string): Promise<PrismaDevice> {
    return this.prisma.device.delete({
      where: { id },
    }) as Promise<PrismaDevice>;
  }

  async setStatus(id: string, status: DeviceStatus): Promise<PrismaDevice> {
    return this.prisma.device.update({
      where: { id },
      data: { status },
    }) as Promise<PrismaDevice>;
  }
} 