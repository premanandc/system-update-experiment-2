import { PrismaClient } from '@prisma/client';
import { ExecutionRepository, PrismaExecutionRepository, ExecutionStatus, ExecutionBatchStatus, ExecutionBatchResult } from '../../models/execution';
import { PlanStatus } from '../../models/plan';
import { DeviceStatus } from '../../models/device';

// Mock the Prisma client
jest.mock('@prisma/client', () => {
  const mockExecute = jest.fn();
  const mockTransaction = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      plan: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      execution: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      executionBatch: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      executionDeviceStatus: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      batch: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      deviceBatch: {
        findMany: jest.fn(),
      },
      device: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: mockTransaction,
    })),
  };
});

describe('ExecutionRepository', () => {
  let mockPrisma: any;
  let executionRepo: ExecutionRepository;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    executionRepo = new PrismaExecutionRepository(mockPrisma);
    jest.clearAllMocks();
    
    // Set up $transaction mock
    mockPrisma.$transaction.mockImplementation((callback: any) => {
      return callback(mockPrisma);
    });
  });

  describe('createFromPlan', () => {
    it('should create an execution from an approved plan', async () => {
      // Arrange
      const planId = 'plan-123';
      const mockPlan = {
        id: planId,
        name: 'Test Plan',
        status: PlanStatus.APPROVED,
        updateId: 'update-123',
      };
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);
      
      const mockBatches = [
        { id: 'batch-1', name: 'Test Batch 1', sequence: 1, planId },
        { id: 'batch-2', name: 'Test Batch 2', sequence: 2, planId },
      ];
      mockPrisma.batch.findMany.mockResolvedValue(mockBatches);
      
      const mockExecution = {
        id: 'exec-123',
        planId,
        status: ExecutionStatus.CREATED,
        createdAt: new Date(),
      };
      mockPrisma.execution.create.mockResolvedValue(mockExecution);
      
      mockPrisma.$transaction.mockImplementation((callback: any) => {
        return callback(mockPrisma);
      });
      
      mockPrisma.executionBatch.create.mockImplementation((data: any) => ({
        id: `exec-batch-${data.batchId}`,
        ...data.data,
      }));

      // Act
      const result = await executionRepo.createFromPlan(planId);

      // Assert
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: planId },
      });
      expect(mockPrisma.batch.findMany).toHaveBeenCalledWith({
        where: { planId },
        orderBy: { sequence: 'asc' },
      });
      expect(mockPrisma.execution.create).toHaveBeenCalledWith({
        data: {
          planId,
          status: ExecutionStatus.CREATED,
        },
      });
      expect(mockPrisma.executionBatch.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { status: PlanStatus.EXECUTING },
      });
      expect(result).toEqual(mockExecution);
    });

    it('should throw an error if plan is not found', async () => {
      // Arrange
      const planId = 'non-existent-plan';
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(executionRepo.createFromPlan(planId))
        .rejects
        .toThrow('Plan not found');
    });

    it('should throw an error if plan is not approved', async () => {
      // Arrange
      const planId = 'plan-123';
      const mockPlan = {
        id: planId,
        status: PlanStatus.DRAFT,
      };
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      // Act & Assert
      await expect(executionRepo.createFromPlan(planId))
        .rejects
        .toThrow('Only approved plans can be executed');
    });
  });

  describe('startBatch', () => {
    it('should start the first batch of an execution', async () => {
      // Arrange
      const executionId = 'exec-123';
      const mockExecution = {
        id: executionId,
        status: ExecutionStatus.CREATED,
      };
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecution);

      const mockExecutionBatches = [
        { 
          id: 'exec-batch-1', 
          executionId, 
          batchId: 'batch-1', 
          sequence: 1, 
          status: ExecutionBatchStatus.PENDING,
          result: null,
          monitoringEndTime: null,
        },
        { 
          id: 'exec-batch-2', 
          executionId, 
          batchId: 'batch-2', 
          sequence: 2, 
          status: ExecutionBatchStatus.PENDING,
          result: null,
          monitoringEndTime: null,
        },
      ];
      mockPrisma.executionBatch.findMany.mockResolvedValue(mockExecutionBatches);

      const mockBatch = {
        id: 'batch-1',
        monitoringPeriodHours: 24,
      };
      mockPrisma.batch.findUnique.mockResolvedValue(mockBatch);

      const mockBatchDevices = [
        { deviceId: 'device-1' },
        { deviceId: 'device-2' },
      ];
      mockPrisma.deviceBatch.findMany.mockResolvedValue(mockBatchDevices);

      const mockDevices = [
        { id: 'device-1', status: DeviceStatus.ONLINE },
        { id: 'device-2', status: DeviceStatus.ONLINE },
      ];
      mockPrisma.device.findMany.mockResolvedValue(mockDevices);

      mockPrisma.executionBatch.update.mockResolvedValue({
        ...mockExecutionBatches[0],
        status: ExecutionBatchStatus.EXECUTING,
        monitoringEndTime: expect.any(Date),
      });

      mockPrisma.execution.update.mockResolvedValue({
        ...mockExecution,
        status: ExecutionStatus.EXECUTING,
      });

      // Act
      const result = await executionRepo.startBatch(executionId);

      // Assert
      expect(mockPrisma.execution.findUnique).toHaveBeenCalledWith({
        where: { id: executionId },
      });
      expect(mockPrisma.executionBatch.findMany).toHaveBeenCalledWith({
        where: { executionId },
        orderBy: { sequence: 'asc' },
      });
      expect(mockPrisma.batch.findUnique).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
      });
      expect(mockPrisma.deviceBatch.findMany).toHaveBeenCalledWith({
        where: { batchId: 'batch-1' },
      });
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({
        where: { 
          id: { in: ['device-1', 'device-2'] },
        },
      });
      expect(mockPrisma.executionBatch.update).toHaveBeenCalledWith({
        where: { id: 'exec-batch-1' },
        data: {
          status: ExecutionBatchStatus.EXECUTING,
          monitoringEndTime: expect.any(Date),
        },
      });
      expect(mockPrisma.execution.update).toHaveBeenCalledWith({
        where: { id: executionId },
        data: { status: ExecutionStatus.EXECUTING },
      });
      expect(mockPrisma.executionDeviceStatus.create).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        executionBatchId: 'exec-batch-1',
        devicesUpdated: 2,
      });
    });

    it('should not send updates to offline devices', async () => {
      // Arrange
      const executionId = 'exec-123';
      const mockExecution = {
        id: executionId,
        status: ExecutionStatus.CREATED,
      };
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecution);

      const mockExecutionBatches = [
        { 
          id: 'exec-batch-1', 
          executionId, 
          batchId: 'batch-1', 
          sequence: 1, 
          status: ExecutionBatchStatus.PENDING,
        },
      ];
      mockPrisma.executionBatch.findMany.mockResolvedValue(mockExecutionBatches);

      const mockBatch = {
        id: 'batch-1',
        monitoringPeriodHours: 24,
      };
      mockPrisma.batch.findUnique.mockResolvedValue(mockBatch);

      const mockBatchDevices = [
        { deviceId: 'device-1' },
        { deviceId: 'device-2' },
        { deviceId: 'device-3' },
      ];
      mockPrisma.deviceBatch.findMany.mockResolvedValue(mockBatchDevices);

      const mockDevices = [
        { id: 'device-1', status: DeviceStatus.ONLINE },
        { id: 'device-2', status: DeviceStatus.OFFLINE },
        { id: 'device-3', status: DeviceStatus.ONLINE },
      ];
      mockPrisma.device.findMany.mockResolvedValue(mockDevices);

      // Act
      const result = await executionRepo.startBatch(executionId);

      // Assert
      expect(mockPrisma.executionDeviceStatus.create).toHaveBeenCalledTimes(2);
      expect(result.devicesUpdated).toBe(2);
    });

    it('should throw an error if execution is not in CREATED status', async () => {
      // Arrange
      const executionId = 'exec-123';
      const mockExecution = {
        id: executionId,
        status: ExecutionStatus.EXECUTING,
      };
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecution);

      // Act & Assert
      await expect(executionRepo.startBatch(executionId))
        .rejects
        .toThrow('Cannot start batch: execution is already in progress');
    });
  });

  describe('recordDeviceUpdateResult', () => {
    it('should record a device update success', async () => {
      // Arrange
      const executionId = 'exec-123';
      const deviceId = 'device-1';
      const success = true;
      
      const mockExecutionBatch = {
        id: 'exec-batch-1',
        executionId,
        status: ExecutionBatchStatus.EXECUTING,
      };
      mockPrisma.executionBatch.findMany.mockResolvedValue([mockExecutionBatch]);
      
      const mockDeviceStatus = {
        id: 'device-status-1',
        executionBatchId: 'exec-batch-1',
        deviceId,
        updateSent: true,
        updateCompleted: false,
        succeeded: null,
      };
      mockPrisma.executionDeviceStatus.findUnique.mockResolvedValue(mockDeviceStatus);
      
      mockPrisma.executionDeviceStatus.update.mockResolvedValue({
        ...mockDeviceStatus,
        updateCompleted: true,
        succeeded: true,
      });

      // Act
      const result = await executionRepo.recordDeviceUpdateResult(executionId, deviceId, success);

      // Assert
      expect(mockPrisma.executionBatch.findMany).toHaveBeenCalledWith({
        where: {
          executionId,
          status: ExecutionBatchStatus.EXECUTING,
        },
      });
      expect(mockPrisma.executionDeviceStatus.findUnique).toHaveBeenCalledWith({
        where: {
          executionBatchId_deviceId: {
            executionBatchId: 'exec-batch-1',
            deviceId,
          },
        },
      });
      expect(mockPrisma.executionDeviceStatus.update).toHaveBeenCalledWith({
        where: { id: 'device-status-1' },
        data: {
          updateCompleted: true,
          succeeded: true,
        },
      });
      expect(result).toBeTruthy();
    });
    
    it('should throw an error if no executing batch is found', async () => {
      // Arrange
      const executionId = 'exec-123';
      const deviceId = 'device-1';
      mockPrisma.executionBatch.findMany.mockResolvedValue([]);
      
      // Act & Assert
      await expect(executionRepo.recordDeviceUpdateResult(executionId, deviceId, true))
        .rejects
        .toThrow('No executing batch found for this execution');
    });
    
    it('should throw an error if device is not part of the executing batch', async () => {
      // Arrange
      const executionId = 'exec-123';
      const deviceId = 'device-1';
      
      const mockExecutionBatch = {
        id: 'exec-batch-1',
        executionId,
        status: ExecutionBatchStatus.EXECUTING,
      };
      mockPrisma.executionBatch.findMany.mockResolvedValue([mockExecutionBatch]);
      
      mockPrisma.executionDeviceStatus.findUnique.mockResolvedValue(null);
      
      // Act & Assert
      await expect(executionRepo.recordDeviceUpdateResult(executionId, deviceId, true))
        .rejects
        .toThrow('Device is not part of the executing batch');
    });
  });

  describe('checkBatchCompletion', () => {
    it('should mark a batch as completed with success when all devices succeed', async () => {
      // Arrange
      const executionBatchId = 'exec-batch-1';
      
      const mockDeviceStatuses = [
        { deviceId: 'device-1', updateSent: true, updateCompleted: true, succeeded: true },
        { deviceId: 'device-2', updateSent: true, updateCompleted: true, succeeded: true },
      ];
      mockPrisma.executionDeviceStatus.findMany.mockResolvedValue(mockDeviceStatuses);
      
      mockPrisma.executionBatch.update.mockResolvedValue({
        id: executionBatchId,
        status: ExecutionBatchStatus.COMPLETED,
        result: ExecutionBatchResult.SUCCESSFUL,
      });

      // Act
      const result = await executionRepo.checkBatchCompletion(executionBatchId);

      // Assert
      expect(mockPrisma.executionDeviceStatus.findMany).toHaveBeenCalledWith({
        where: { executionBatchId },
      });
      expect(mockPrisma.executionBatch.update).toHaveBeenCalledWith({
        where: { id: executionBatchId },
        data: {
          status: ExecutionBatchStatus.COMPLETED,
          result: ExecutionBatchResult.SUCCESSFUL,
        },
      });
      expect(result).toEqual({
        isComplete: true,
        result: ExecutionBatchResult.SUCCESSFUL,
      });
    });
    
    it('should mark a batch as completed with failure when any device fails', async () => {
      // Arrange
      const executionBatchId = 'exec-batch-1';
      
      const mockDeviceStatuses = [
        { deviceId: 'device-1', updateSent: true, updateCompleted: true, succeeded: true },
        { deviceId: 'device-2', updateSent: true, updateCompleted: true, succeeded: false },
      ];
      mockPrisma.executionDeviceStatus.findMany.mockResolvedValue(mockDeviceStatuses);
      
      mockPrisma.executionBatch.update.mockResolvedValue({
        id: executionBatchId,
        status: ExecutionBatchStatus.COMPLETED,
        result: ExecutionBatchResult.FAILED,
      });

      // Act
      const result = await executionRepo.checkBatchCompletion(executionBatchId);

      // Assert
      expect(mockPrisma.executionBatch.update).toHaveBeenCalledWith({
        where: { id: executionBatchId },
        data: {
          status: ExecutionBatchStatus.COMPLETED,
          result: ExecutionBatchResult.FAILED,
        },
      });
      expect(result).toEqual({
        isComplete: true,
        result: ExecutionBatchResult.FAILED,
      });
    });
    
    it('should not mark a batch as completed if any device has not reported', async () => {
      // Arrange
      const executionBatchId = 'exec-batch-1';
      
      const mockDeviceStatuses = [
        { deviceId: 'device-1', updateSent: true, updateCompleted: true, succeeded: true },
        { deviceId: 'device-2', updateSent: true, updateCompleted: false, succeeded: null },
      ];
      mockPrisma.executionDeviceStatus.findMany.mockResolvedValue(mockDeviceStatuses);

      // Act
      const result = await executionRepo.checkBatchCompletion(executionBatchId);

      // Assert
      expect(mockPrisma.executionBatch.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        isComplete: false,
        result: null,
      });
    });

    it('should handle case with no device statuses', async () => {
      // Arrange
      const executionBatchId = 'exec-batch-1';
      
      // Mock empty device statuses array
      mockPrisma.executionDeviceStatus.findMany.mockResolvedValue([]);

      // Act
      const result = await executionRepo.checkBatchCompletion(executionBatchId);

      // Assert
      expect(mockPrisma.executionBatch.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        isComplete: false,
        result: null,
      });
    });
  });
  
  describe('endMonitoringPeriod', () => {
    it('should mark an incomplete batch as incomplete when monitoring period ends', async () => {
      // Arrange
      const executionBatchId = 'exec-batch-1';
      const executionId = 'exec-123';
      
      const mockExecutionBatch = {
        id: executionBatchId,
        executionId,
        status: ExecutionBatchStatus.EXECUTING,
        sequence: 1,
        monitoringEndTime: new Date(Date.now() - 1000), // End time is in the past
      };
      mockPrisma.executionBatch.findUnique.mockResolvedValue(mockExecutionBatch);
      
      const mockDeviceStatuses = [
        { deviceId: 'device-1', updateSent: true, updateCompleted: true, succeeded: true },
        { deviceId: 'device-2', updateSent: true, updateCompleted: false, succeeded: null },
      ];
      mockPrisma.executionDeviceStatus.findMany.mockResolvedValue(mockDeviceStatuses);
      
      mockPrisma.executionBatch.update.mockResolvedValue({
        ...mockExecutionBatch,
        status: ExecutionBatchStatus.COMPLETED,
        result: ExecutionBatchResult.INCOMPLETE,
      });

      // Act
      const result = await executionRepo.endMonitoringPeriod(executionBatchId);

      // Assert
      expect(mockPrisma.executionBatch.findUnique).toHaveBeenCalledWith({
        where: { id: executionBatchId },
      });
      expect(mockPrisma.executionDeviceStatus.findMany).toHaveBeenCalledWith({
        where: { executionBatchId },
      });
      expect(mockPrisma.executionBatch.update).toHaveBeenCalledWith({
        where: { id: executionBatchId },
        data: {
          status: ExecutionBatchStatus.COMPLETED,
          result: ExecutionBatchResult.INCOMPLETE,
        },
      });
      expect(result).toEqual({
        batchComplete: true,
        result: ExecutionBatchResult.INCOMPLETE,
        devicesReported: 1,
        totalDevices: 2,
      });
    });
    
    it('should not mark a batch as complete if monitoring period has not ended', async () => {
      // Arrange
      const executionBatchId = 'exec-batch-1';
      
      const mockExecutionBatch = {
        id: executionBatchId,
        status: ExecutionBatchStatus.EXECUTING,
        monitoringEndTime: new Date(Date.now() + 1000000), // End time is in the future
      };
      mockPrisma.executionBatch.findUnique.mockResolvedValue(mockExecutionBatch);
      
      // Act
      const result = await executionRepo.endMonitoringPeriod(executionBatchId);

      // Assert
      expect(mockPrisma.executionBatch.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        batchComplete: false,
        result: null,
        devicesReported: 0,
        totalDevices: 0,
      });
    });

    it('should not mark a batch as complete if monitoring period is null', async () => {
      // Arrange
      const executionBatchId = 'exec-batch-1';
      
      const mockExecutionBatch = {
        id: executionBatchId,
        status: ExecutionBatchStatus.EXECUTING,
        monitoringEndTime: null, // Null monitoring end time
      };
      mockPrisma.executionBatch.findUnique.mockResolvedValue(mockExecutionBatch);
      
      // Act
      const result = await executionRepo.endMonitoringPeriod(executionBatchId);

      // Assert
      expect(mockPrisma.executionBatch.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        batchComplete: false,
        result: null,
        devicesReported: 0,
        totalDevices: 0,
      });
    });
  });
  
  describe('startNextBatch', () => {
    it('should start the next batch in sequence', async () => {
      // Arrange
      const executionId = 'exec-123';
      const currentBatchId = 'exec-batch-1';
      
      const mockCurrentBatch = {
        id: currentBatchId,
        executionId,
        sequence: 1,
        status: ExecutionBatchStatus.COMPLETED,
      };
      mockPrisma.executionBatch.findUnique.mockResolvedValue(mockCurrentBatch);
      
      const mockNextBatch = {
        id: 'exec-batch-2',
        executionId,
        batchId: 'batch-2',
        sequence: 2,
        status: ExecutionBatchStatus.PENDING,
      };
      mockPrisma.executionBatch.findMany.mockResolvedValue([mockNextBatch]);
      
      const mockBatch = {
        id: 'batch-2',
        monitoringPeriodHours: 24,
      };
      mockPrisma.batch.findUnique.mockResolvedValue(mockBatch);
      
      const mockBatchDevices = [
        { deviceId: 'device-3' },
        { deviceId: 'device-4' },
      ];
      mockPrisma.deviceBatch.findMany.mockResolvedValue(mockBatchDevices);
      
      const mockDevices = [
        { id: 'device-3', status: DeviceStatus.ONLINE },
        { id: 'device-4', status: DeviceStatus.ONLINE },
      ];
      mockPrisma.device.findMany.mockResolvedValue(mockDevices);
      
      mockPrisma.executionBatch.update.mockResolvedValue({
        ...mockNextBatch,
        status: ExecutionBatchStatus.EXECUTING,
        monitoringEndTime: expect.any(Date),
      });

      // Act
      const result = await executionRepo.startNextBatch(currentBatchId);

      // Assert
      expect(mockPrisma.executionBatch.findUnique).toHaveBeenCalledWith({
        where: { id: currentBatchId },
      });
      expect(mockPrisma.executionBatch.findMany).toHaveBeenCalledWith({
        where: {
          executionId,
          sequence: 2,
          status: ExecutionBatchStatus.PENDING,
        },
      });
      expect(mockPrisma.batch.findUnique).toHaveBeenCalledWith({
        where: { id: 'batch-2' },
      });
      expect(mockPrisma.deviceBatch.findMany).toHaveBeenCalledWith({
        where: { batchId: 'batch-2' },
      });
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({
        where: { 
          id: { in: ['device-3', 'device-4'] },
        },
      });
      expect(mockPrisma.executionBatch.update).toHaveBeenCalledWith({
        where: { id: 'exec-batch-2' },
        data: {
          status: ExecutionBatchStatus.EXECUTING,
          monitoringEndTime: expect.any(Date),
        },
      });
      expect(mockPrisma.executionDeviceStatus.create).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        executionBatchId: 'exec-batch-2',
        devicesUpdated: 2,
      });
    });
    
    it('should throw an error if current batch is not completed', async () => {
      // Arrange
      const currentBatchId = 'exec-batch-1';
      
      const mockCurrentBatch = {
        id: currentBatchId,
        status: ExecutionBatchStatus.EXECUTING,
      };
      mockPrisma.executionBatch.findUnique.mockResolvedValue(mockCurrentBatch);
      
      // Act & Assert
      await expect(executionRepo.startNextBatch(currentBatchId))
        .rejects
        .toThrow('Cannot start next batch: current batch is not completed');
    });
    
    it('should return null if there is no next batch', async () => {
      // Arrange
      const executionId = 'exec-123';
      const currentBatchId = 'exec-batch-1';
      
      const mockCurrentBatch = {
        id: currentBatchId,
        executionId,
        sequence: 1,
        status: ExecutionBatchStatus.COMPLETED,
      };
      mockPrisma.executionBatch.findUnique.mockResolvedValue(mockCurrentBatch);
      
      mockPrisma.executionBatch.findMany.mockResolvedValue([]);
      
      // Act
      const result = await executionRepo.startNextBatch(currentBatchId);

      // Assert
      expect(result).toBeNull();
    });
  });
  
  describe('completeExecution', () => {
    it('should mark an execution as completed', async () => {
      // Arrange
      const executionId = 'exec-123';
      
      mockPrisma.execution.update.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.COMPLETED,
      });
      
      // Act
      const result = await executionRepo.completeExecution(executionId);

      // Assert
      expect(mockPrisma.execution.update).toHaveBeenCalledWith({
        where: { id: executionId },
        data: { status: ExecutionStatus.COMPLETED },
      });
      expect(result).toBeTruthy();
    });

    it('should handle error when execution update fails', async () => {
      // Arrange
      const executionId = 'exec-123';
      const error = new Error('Database error');
      
      mockPrisma.execution.update.mockRejectedValue(error);
      
      // Act & Assert
      await expect(executionRepo.completeExecution(executionId))
        .rejects.toThrow('Database error');
    });
  });
  
  describe('abandonExecution', () => {
    it('should mark an execution as abandoned', async () => {
      // Arrange
      const executionId = 'exec-123';
      
      mockPrisma.execution.update.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.ABANDONED,
      });
      
      // Act
      const result = await executionRepo.abandonExecution(executionId);

      // Assert
      expect(mockPrisma.execution.update).toHaveBeenCalledWith({
        where: { id: executionId },
        data: { status: ExecutionStatus.ABANDONED },
      });
      expect(result).toBeTruthy();
    });

    it('should handle error when execution update fails', async () => {
      // Arrange
      const executionId = 'exec-123';
      const error = new Error('Database error');
      
      mockPrisma.execution.update.mockRejectedValue(error);
      
      // Act & Assert
      await expect(executionRepo.abandonExecution(executionId))
        .rejects.toThrow('Database error');
    });
  });
}); 