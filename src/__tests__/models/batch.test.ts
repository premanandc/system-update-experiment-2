import { PrismaClient } from '@prisma/client';
import { 
  Batch, 
  BatchCreateInput, 
  BatchStatus, 
  BatchType, 
  PrismaBatchRepository 
} from '../../models/batch';
import { mockDeep, mockReset } from 'jest-mock-extended';
import { Device, DeviceStatus } from '../../models/device';

// Mock PrismaClient
const mockPrisma = mockDeep<PrismaClient>();
mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));

// Create repository with the mock
const batchRepository = new PrismaBatchRepository(mockPrisma);

describe('BatchRepository', () => {
  // Reset mocks before each test
  beforeEach(() => {
    mockReset(mockPrisma);
  });

  describe('create', () => {
    it('should create a new batch', async () => {
      // Arrange
      const batchData: BatchCreateInput = {
        name: 'Test Batch',
        description: 'A test batch for testing',
        planId: 'plan-1',
        sequence: 1,
        type: BatchType.TEST,
        monitoringPeriod: 48,
      };

      const expectedBatch: Batch = {
        id: '1',
        name: 'Test Batch',
        description: 'A test batch for testing',
        planId: 'plan-1',
        sequence: 1,
        type: BatchType.TEST,
        monitoringPeriod: 48,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.batch.create.mockResolvedValue(expectedBatch);

      // Act
      const result = await batchRepository.create(batchData);

      // Assert
      expect(mockPrisma.batch.create).toHaveBeenCalledWith({
        data: batchData,
      });
      expect(result).toEqual(expectedBatch);
    });
  });

  describe('findById', () => {
    it('should find a batch by its ID', async () => {
      // Arrange
      const batchId = '1';
      const expectedBatch: Batch = {
        id: batchId,
        name: 'Test Batch',
        description: 'A test batch for testing',
        planId: 'plan-1',
        sequence: 1,
        type: BatchType.TEST,
        monitoringPeriod: 48,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.batch.findUnique.mockResolvedValue(expectedBatch);

      // Act
      const result = await batchRepository.findById(batchId);

      // Assert
      expect(mockPrisma.batch.findUnique).toHaveBeenCalledWith({
        where: { id: batchId },
      });
      expect(result).toEqual(expectedBatch);
    });

    it('should return null when batch is not found', async () => {
      // Arrange
      const batchId = 'non-existent';
      mockPrisma.batch.findUnique.mockResolvedValue(null);

      // Act
      const result = await batchRepository.findById(batchId);

      // Assert
      expect(mockPrisma.batch.findUnique).toHaveBeenCalledWith({
        where: { id: batchId },
      });
      expect(result).toBeNull();
    });
  });

  describe('findByPlanId', () => {
    it('should find all batches for a plan', async () => {
      // Arrange
      const planId = 'plan-1';
      const expectedBatches: Batch[] = [
        {
          id: '1',
          name: 'Test Batch 1',
          description: 'First test batch',
          planId,
          sequence: 1,
          type: BatchType.TEST,
          monitoringPeriod: 48,
          status: BatchStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Test Batch 2',
          description: 'Second test batch',
          planId,
          sequence: 2,
          type: BatchType.MASS,
          monitoringPeriod: 24,
          status: BatchStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.batch.findMany.mockResolvedValue(expectedBatches);

      // Act
      const result = await batchRepository.findByPlanId(planId);

      // Assert
      expect(mockPrisma.batch.findMany).toHaveBeenCalledWith({
        where: { planId },
        orderBy: { sequence: 'asc' },
      });
      expect(result).toEqual(expectedBatches);
    });

    it('should return an empty array when no batches are found', async () => {
      // Arrange
      const planId = 'non-existent';
      mockPrisma.batch.findMany.mockResolvedValue([]);

      // Act
      const result = await batchRepository.findByPlanId(planId);

      // Assert
      expect(mockPrisma.batch.findMany).toHaveBeenCalledWith({
        where: { planId },
        orderBy: { sequence: 'asc' },
      });
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a batch', async () => {
      // Arrange
      const batchId = '1';
      const updateData = {
        name: 'Updated Batch',
        description: 'Updated description',
        status: BatchStatus.EXECUTING,
      };

      const expectedBatch: Batch = {
        id: batchId,
        name: 'Updated Batch',
        description: 'Updated description',
        planId: 'plan-1',
        sequence: 1,
        type: BatchType.TEST,
        monitoringPeriod: 48,
        status: BatchStatus.EXECUTING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.batch.update.mockResolvedValue(expectedBatch);

      // Act
      const result = await batchRepository.update(batchId, updateData);

      // Assert
      expect(mockPrisma.batch.update).toHaveBeenCalledWith({
        where: { id: batchId },
        data: updateData,
      });
      expect(result).toEqual(expectedBatch);
    });
  });

  describe('delete', () => {
    it('should delete a batch', async () => {
      // Arrange
      const batchId = '1';
      const expectedBatch: Batch = {
        id: batchId,
        name: 'Test Batch',
        description: 'A test batch for testing',
        planId: 'plan-1',
        sequence: 1,
        type: BatchType.TEST,
        monitoringPeriod: 48,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.batch.delete.mockResolvedValue(expectedBatch);

      // Act
      const result = await batchRepository.delete(batchId);

      // Assert
      expect(mockPrisma.batch.delete).toHaveBeenCalledWith({
        where: { id: batchId },
      });
      expect(result).toEqual(expectedBatch);
    });
  });

  describe('getDevices', () => {
    it('should get all devices in a batch', async () => {
      // Arrange
      const batchId = '1';
      const deviceBatches = [
        {
          id: 'db1',
          batchId,
          deviceId: 'device-1',
          createdAt: new Date(),
          device: {
            id: 'device-1',
            name: 'Device 1',
            ipAddress: '192.168.1.1',
            type: 'SERVER',
            status: 'ONLINE',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'db2',
          batchId,
          deviceId: 'device-2',
          createdAt: new Date(),
          device: {
            id: 'device-2',
            name: 'Device 2',
            ipAddress: '192.168.1.2',
            type: 'WORKSTATION',
            status: 'ONLINE',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      const expectedDevices: Device[] = [
        {
          id: 'device-1',
          name: 'Device 1',
          ipAddress: '192.168.1.1',
          type: 'SERVER',
          status: DeviceStatus.ONLINE,
          createdAt: deviceBatches[0].device.createdAt,
          updatedAt: deviceBatches[0].device.updatedAt,
        },
        {
          id: 'device-2',
          name: 'Device 2',
          ipAddress: '192.168.1.2',
          type: 'WORKSTATION',
          status: DeviceStatus.ONLINE,
          createdAt: deviceBatches[1].device.createdAt,
          updatedAt: deviceBatches[1].device.updatedAt,
        },
      ];

      mockPrisma.deviceBatch.findMany.mockResolvedValue(deviceBatches as any);

      // Act
      const result = await batchRepository.getDevices(batchId);

      // Assert
      expect(mockPrisma.deviceBatch.findMany).toHaveBeenCalledWith({
        where: { batchId },
        include: { device: true },
      });
      expect(result).toEqual(expectedDevices);
    });

    it('should return an empty array when no devices are in the batch', async () => {
      // Arrange
      const batchId = '1';
      mockPrisma.deviceBatch.findMany.mockResolvedValue([]);

      // Act
      const result = await batchRepository.getDevices(batchId);

      // Assert
      expect(mockPrisma.deviceBatch.findMany).toHaveBeenCalledWith({
        where: { batchId },
        include: { device: true },
      });
      expect(result).toEqual([]);
    });
  });

  describe('addDevice', () => {
    it('should add a device to a batch', async () => {
      // Arrange
      const batchId = '1';
      const deviceId = 'device-1';

      mockPrisma.deviceBatch.create.mockResolvedValue({
        id: 'db1',
        batchId,
        deviceId,
        createdAt: new Date(),
      } as any);

      // Act
      await batchRepository.addDevice(batchId, deviceId);

      // Assert
      expect(mockPrisma.deviceBatch.create).toHaveBeenCalledWith({
        data: {
          deviceId,
          batchId,
        },
      });
    });
  });

  describe('removeDevice', () => {
    it('should remove a device from a batch', async () => {
      // Arrange
      const batchId = '1';
      const deviceId = 'device-1';
      const deviceBatchId = 'db1';

      mockPrisma.deviceBatch.findFirst.mockResolvedValue({
        id: deviceBatchId,
        batchId,
        deviceId,
        createdAt: new Date(),
      } as any);

      mockPrisma.deviceBatch.delete.mockResolvedValue({} as any);

      // Act
      await batchRepository.removeDevice(batchId, deviceId);

      // Assert
      expect(mockPrisma.deviceBatch.findFirst).toHaveBeenCalledWith({
        where: {
          deviceId,
          batchId,
        },
      });
      expect(mockPrisma.deviceBatch.delete).toHaveBeenCalledWith({
        where: {
          id: deviceBatchId,
        },
      });
    });

    it('should throw an error when device is not in the batch', async () => {
      // Arrange
      const batchId = '1';
      const deviceId = 'non-existent';

      mockPrisma.deviceBatch.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(batchRepository.removeDevice(batchId, deviceId))
        .rejects.toThrow('Device is not in this batch');

      expect(mockPrisma.deviceBatch.findFirst).toHaveBeenCalledWith({
        where: {
          deviceId,
          batchId,
        },
      });
      expect(mockPrisma.deviceBatch.delete).not.toHaveBeenCalled();
    });
  });
}); 