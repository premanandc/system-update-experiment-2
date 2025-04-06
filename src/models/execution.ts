import { PrismaClient } from '@prisma/client';
import { DeviceStatus } from './device';
import { PlanStatus } from './plan';

export enum ExecutionStatus {
  CREATED = 'CREATED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum ExecutionBatchStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
}

export enum ExecutionBatchResult {
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
  INCOMPLETE = 'INCOMPLETE',
}

export interface Execution {
  id: string;
  planId: string;
  status: ExecutionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionBatch {
  id: string;
  executionId: string;
  batchId: string;
  sequence: number;
  status: ExecutionBatchStatus;
  result: ExecutionBatchResult | null;
  monitoringEndTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionDeviceStatus {
  id: string;
  executionBatchId: string;
  deviceId: string;
  updateSent: boolean;
  updateCompleted: boolean;
  succeeded: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionRepository {
  createFromPlan(planId: string): Promise<Execution>;
  startBatch(executionId: string): Promise<{
    executionBatchId: string;
    devicesUpdated: number;
  }>;
  recordDeviceUpdateResult(
    executionId: string,
    deviceId: string,
    success: boolean
  ): Promise<boolean>;
  checkBatchCompletion(
    executionBatchId: string
  ): Promise<{
    isComplete: boolean;
    result: ExecutionBatchResult | null;
  }>;
  endMonitoringPeriod(
    executionBatchId: string
  ): Promise<{
    batchComplete: boolean;
    result: ExecutionBatchResult | null;
    devicesReported: number;
    totalDevices: number;
  }>;
  startNextBatch(currentBatchId: string): Promise<{
    executionBatchId: string;
    devicesUpdated: number;
  } | null>;
  completeExecution(executionId: string): Promise<boolean>;
  abandonExecution(executionId: string): Promise<boolean>;
}

export class PrismaExecutionRepository implements ExecutionRepository {
  constructor(private prisma: PrismaClient) {}

  async createFromPlan(planId: string): Promise<Execution> {
    // Verify the plan exists and is approved
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    if (plan.status !== PlanStatus.APPROVED) {
      throw new Error('Only approved plans can be executed');
    }

    // Fetch all batches for the plan, ordered by sequence
    const batches = await this.prisma.batch.findMany({
      where: { planId },
      orderBy: { sequence: 'asc' },
    });

    // Create execution
    const execution = await this.prisma.execution.create({
      data: {
        planId,
        status: ExecutionStatus.CREATED,
      },
    });

    // Create execution batches
    for (const batch of batches) {
      await this.prisma.executionBatch.create({
        data: {
          executionId: execution.id,
          batchId: batch.id,
          sequence: batch.sequence,
          status: ExecutionBatchStatus.PENDING,
          result: null,
          monitoringEndTime: null,
        },
      });
    }

    // Update plan status to EXECUTING
    await this.prisma.plan.update({
      where: { id: planId },
      data: { status: PlanStatus.EXECUTING },
    });

    return {
      id: execution.id,
      planId: execution.planId,
      status: execution.status as unknown as ExecutionStatus,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    };
  }

  async startBatch(executionId: string): Promise<{
    executionBatchId: string;
    devicesUpdated: number;
  }> {
    // Check execution status
    const execution = await this.prisma.execution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status !== ExecutionStatus.CREATED) {
      throw new Error('Cannot start batch: execution is already in progress');
    }

    // Get the first batch (lowest sequence)
    const executionBatches = await this.prisma.executionBatch.findMany({
      where: { executionId },
      orderBy: { sequence: 'asc' },
    });

    if (executionBatches.length === 0) {
      throw new Error('No batches found for this execution');
    }

    const firstBatch = executionBatches[0];

    // Get details of the batch
    const batch = await this.prisma.batch.findUnique({
      where: { id: firstBatch.batchId },
    });

    if (!batch) {
      throw new Error('Batch configuration not found');
    }

    // Get devices in the batch
    const batchDevices = await this.prisma.deviceBatch.findMany({
      where: { batchId: firstBatch.batchId },
    });

    const deviceIds = batchDevices.map((bd: { deviceId: string }) => bd.deviceId);

    // Check which devices are online
    const devices = await this.prisma.device.findMany({
      where: { 
        id: { in: deviceIds },
      },
    });

    const onlineDevices = devices.filter(
      (device: any) => device.status === 'ONLINE'
    );

    // Calculate monitoring end time
    const monitoringEndTime = new Date();
    monitoringEndTime.setHours(
      monitoringEndTime.getHours() + (batch.monitoringPeriod || 24)
    );

    // Update the execution batch status
    await this.prisma.executionBatch.update({
      where: { id: firstBatch.id },
      data: {
        status: ExecutionBatchStatus.EXECUTING,
        monitoringEndTime,
      },
    });

    // Update execution status
    await this.prisma.execution.update({
      where: { id: executionId },
      data: { status: ExecutionStatus.EXECUTING },
    });

    // Record update sent to online devices
    let devicesUpdated = 0;
    for (const device of onlineDevices) {
      await this.prisma.executionDeviceStatus.create({
        data: {
          executionBatchId: firstBatch.id,
          deviceId: device.id,
          updateSent: true,
          updateCompleted: false,
          succeeded: null,
        },
      });
      devicesUpdated++;
    }

    return {
      executionBatchId: firstBatch.id,
      devicesUpdated,
    };
  }

  async recordDeviceUpdateResult(
    executionId: string,
    deviceId: string,
    success: boolean
  ): Promise<boolean> {
    // Find the currently executing batch
    const executionBatch = await this.prisma.executionBatch.findMany({
      where: {
        executionId,
        status: ExecutionBatchStatus.EXECUTING,
      },
    });

    if (executionBatch.length === 0) {
      throw new Error('No executing batch found for this execution');
    }

    const currentBatch = executionBatch[0];

    // Check if device is part of this batch
    const deviceStatus = await this.prisma.executionDeviceStatus.findUnique({
      where: {
        executionBatchId_deviceId: {
          executionBatchId: currentBatch.id,
          deviceId,
        },
      },
    });

    if (!deviceStatus) {
      throw new Error('Device is not part of the executing batch');
    }

    // Update device status
    await this.prisma.executionDeviceStatus.update({
      where: { id: deviceStatus.id },
      data: {
        updateCompleted: true,
        succeeded: success,
      },
    });

    return true;
  }

  async checkBatchCompletion(
    executionBatchId: string
  ): Promise<{
    isComplete: boolean;
    result: ExecutionBatchResult | null;
  }> {
    // Get all device statuses for this batch
    const deviceStatuses = await this.prisma.executionDeviceStatus.findMany({
      where: { executionBatchId },
    });

    if (deviceStatuses.length === 0) {
      return { isComplete: false, result: null };
    }

    // Check if all devices have reported
    const allCompleted = deviceStatuses.every(
      (status: { updateCompleted: boolean }) => status.updateCompleted
    );

    if (!allCompleted) {
      return { isComplete: false, result: null };
    }

    // Check if any device failed
    const anyFailed = deviceStatuses.some(
      (status: { succeeded: boolean | null }) => status.succeeded === false
    );

    // Update batch status
    const result = anyFailed
      ? ExecutionBatchResult.FAILED
      : ExecutionBatchResult.SUCCESSFUL;

    await this.prisma.executionBatch.update({
      where: { id: executionBatchId },
      data: {
        status: ExecutionBatchStatus.COMPLETED,
        result,
      },
    });

    return {
      isComplete: true,
      result,
    };
  }

  async endMonitoringPeriod(
    executionBatchId: string
  ): Promise<{
    batchComplete: boolean;
    result: ExecutionBatchResult | null;
    devicesReported: number;
    totalDevices: number;
  }> {
    // Get batch details
    const executionBatch = await this.prisma.executionBatch.findUnique({
      where: { id: executionBatchId },
    });

    if (!executionBatch) {
      throw new Error('Execution batch not found');
    }

    // Check if monitoring period has ended
    if (
      !executionBatch.monitoringEndTime ||
      executionBatch.monitoringEndTime > new Date()
    ) {
      return {
        batchComplete: false,
        result: null,
        devicesReported: 0,
        totalDevices: 0,
      };
    }

    // Get device statuses
    const deviceStatuses = await this.prisma.executionDeviceStatus.findMany({
      where: { executionBatchId },
    });

    const totalDevices = deviceStatuses.length;
    const reportedDevices = deviceStatuses.filter(
      (status: { updateCompleted: boolean }) => status.updateCompleted
    );
    const devicesReported = reportedDevices.length;

    // If batch is not already completed and monitoring period has ended,
    // mark it as complete with INCOMPLETE result
    if (executionBatch.status !== ExecutionBatchStatus.COMPLETED) {
      await this.prisma.executionBatch.update({
        where: { id: executionBatchId },
        data: {
          status: ExecutionBatchStatus.COMPLETED,
          result: ExecutionBatchResult.INCOMPLETE,
        },
      });

      return {
        batchComplete: true,
        result: ExecutionBatchResult.INCOMPLETE,
        devicesReported,
        totalDevices,
      };
    }

    return {
      batchComplete: true,
      result: executionBatch.result as ExecutionBatchResult,
      devicesReported,
      totalDevices,
    };
  }

  async startNextBatch(currentBatchId: string): Promise<{
    executionBatchId: string;
    devicesUpdated: number;
  } | null> {
    // Get current batch
    const currentBatch = await this.prisma.executionBatch.findUnique({
      where: { id: currentBatchId },
    });

    if (!currentBatch) {
      throw new Error('Current batch not found');
    }

    // Ensure current batch is completed
    if (currentBatch.status !== ExecutionBatchStatus.COMPLETED) {
      throw new Error('Cannot start next batch: current batch is not completed');
    }

    // Find the next batch in sequence
    const nextBatch = await this.prisma.executionBatch.findMany({
      where: {
        executionId: currentBatch.executionId,
        sequence: currentBatch.sequence + 1,
        status: ExecutionBatchStatus.PENDING,
      },
    });

    if (nextBatch.length === 0) {
      // No more batches
      return null;
    }

    const batchToStart = nextBatch[0];

    // Get batch configuration
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchToStart.batchId },
    });

    if (!batch) {
      throw new Error('Batch configuration not found');
    }

    // Get devices in the batch
    const batchDevices = await this.prisma.deviceBatch.findMany({
      where: { batchId: batchToStart.batchId },
    });

    const deviceIds = batchDevices.map((bd: { deviceId: string }) => bd.deviceId);

    // Check which devices are online
    const devices = await this.prisma.device.findMany({
      where: { 
        id: { in: deviceIds },
      },
    });

    const onlineDevices = devices.filter(
      (device: any) => device.status === 'ONLINE'
    );

    // Calculate monitoring end time
    const monitoringEndTime = new Date();
    monitoringEndTime.setHours(
      monitoringEndTime.getHours() + (batch.monitoringPeriod || 24)
    );

    // Update batch status
    await this.prisma.executionBatch.update({
      where: { id: batchToStart.id },
      data: {
        status: ExecutionBatchStatus.EXECUTING,
        monitoringEndTime,
      },
    });

    // Record update sent to online devices
    let devicesUpdated = 0;
    for (const device of onlineDevices) {
      await this.prisma.executionDeviceStatus.create({
        data: {
          executionBatchId: batchToStart.id,
          deviceId: device.id,
          updateSent: true,
          updateCompleted: false,
          succeeded: null,
        },
      });
      devicesUpdated++;
    }

    return {
      executionBatchId: batchToStart.id,
      devicesUpdated,
    };
  }

  async completeExecution(executionId: string): Promise<boolean> {
    await this.prisma.execution.update({
      where: { id: executionId },
      data: { status: ExecutionStatus.COMPLETED },
    });
    return true;
  }

  async abandonExecution(executionId: string): Promise<boolean> {
    await this.prisma.execution.update({
      where: { id: executionId },
      data: { status: ExecutionStatus.ABANDONED },
    });
    return true;
  }
} 