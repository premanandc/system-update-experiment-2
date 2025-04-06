import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { 
  PlanStatus, 
  PrismaPlanRepository, 
  Plan,
  BatchType,
  BatchStatus,
  PlanBatch
} from '../../models/plan';
import { Device } from '../../models/device';

// Mock PrismaClient
const mockPrisma = mockDeep<PrismaClient>();

// Create an instance of the PlanRepository with the mocked PrismaClient
const planRepository = new PrismaPlanRepository(mockPrisma);

// Reset mocks before each test
beforeEach(() => {
  mockReset(mockPrisma);
});

describe('PlanRepository', () => {
  describe('create', () => {
    it('should create a new plan', async () => {
      // Arrange
      const planData = {
        name: 'Test Plan',
        description: 'Test Description',
        updateId: '1',
      };
      
      const expectedPlan: Plan = {
        id: '1',
        name: 'Test Plan',
        description: 'Test Description',
        updateId: '1',
        status: PlanStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.plan.create.mockResolvedValue(expectedPlan);
      
      // Act
      const result = await planRepository.create(planData);
      
      // Assert
      expect(mockPrisma.plan.create).toHaveBeenCalledWith({
        data: planData,
      });
      expect(result).toEqual(expectedPlan);
    });
  });

  describe('findById', () => {
    it('should find a plan by ID', async () => {
      // Arrange
      const planId = '1';
      const expectedPlan: Plan = {
        id: planId,
        name: 'Test Plan',
        description: 'Test Description',
        updateId: '1',
        status: PlanStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.plan.findUnique.mockResolvedValue(expectedPlan);
      
      // Act
      const result = await planRepository.findById(planId);
      
      // Assert
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: planId },
      });
      expect(result).toEqual(expectedPlan);
    });
  });

  describe('getBatches', () => {
    it('should get batches for a plan', async () => {
      // Arrange
      const planId = '1';
      const expectedBatches: PlanBatch[] = [
        {
          id: '1',
          name: 'Test Batch 1',
          description: 'Test batch with 2 devices',
          planId: planId,
          sequence: 1,
          type: BatchType.TEST,
          monitoringPeriod: 24,
          status: BatchStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Mass Batch',
          description: 'Mass batch with 8 devices',
          planId: planId,
          sequence: 2,
          type: BatchType.MASS,
          monitoringPeriod: 24,
          status: BatchStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrisma.batch.findMany.mockResolvedValue(expectedBatches as any);
      
      // Act
      const result = await planRepository.getBatches(planId);
      
      // Assert
      expect(mockPrisma.batch.findMany).toHaveBeenCalledWith({
        where: { planId },
        orderBy: { sequence: 'asc' },
      });
      expect(result).toEqual(expectedBatches);
    });
  });

  describe('approvePlan', () => {
    it('should approve a draft plan with batches', async () => {
      // Arrange
      const planId = '1';
      const existingPlan: Plan = {
        id: planId,
        name: 'Test Plan',
        description: 'Test Description',
        updateId: '1',
        status: PlanStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const expectedBatches: PlanBatch[] = [
        {
          id: '1',
          name: 'Test Batch',
          description: 'Test batch',
          planId,
          sequence: 1,
          type: BatchType.TEST,
          monitoringPeriod: 24,
          status: BatchStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];
      
      const approvedPlan: Plan = {
        ...existingPlan,
        status: PlanStatus.APPROVED,
      };
      
      mockPrisma.plan.findUnique.mockResolvedValue(existingPlan);
      mockPrisma.batch.findMany.mockResolvedValue(expectedBatches as any);
      mockPrisma.plan.update.mockResolvedValue(approvedPlan);
      
      // Act
      const result = await planRepository.approvePlan(planId);
      
      // Assert
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: planId },
      });
      expect(mockPrisma.batch.findMany).toHaveBeenCalledWith({
        where: { planId },
        orderBy: { sequence: 'asc' },
      });
      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { status: PlanStatus.APPROVED },
      });
      expect(result).toEqual(approvedPlan);
    });
    
    it('should throw error when approving a non-draft plan', async () => {
      // Arrange
      const planId = '1';
      const existingPlan: Plan = {
        id: planId,
        name: 'Test Plan',
        description: 'Test Description',
        updateId: '1',
        status: PlanStatus.APPROVED, // Already approved
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.plan.findUnique.mockResolvedValue(existingPlan);
      
      // Act & Assert
      await expect(planRepository.approvePlan(planId))
        .rejects.toThrow('Only draft plans can be approved');
    });
    
    it('should throw error when approving a plan without batches', async () => {
      // Arrange
      const planId = '1';
      const existingPlan: Plan = {
        id: planId,
        name: 'Test Plan',
        description: 'Test Description',
        updateId: '1',
        status: PlanStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.plan.findUnique.mockResolvedValue(existingPlan);
      mockPrisma.batch.findMany.mockResolvedValue([]);
      
      // Act & Assert
      await expect(planRepository.approvePlan(planId))
        .rejects.toThrow('Cannot approve a plan without batches');
    });
  });

  describe('rejectPlan', () => {
    it('should reject a draft plan', async () => {
      // Arrange
      const planId = '1';
      const existingPlan: Plan = {
        id: planId,
        name: 'Test Plan',
        description: 'Test Description',
        updateId: '1',
        status: PlanStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const rejectedPlan: Plan = {
        ...existingPlan,
        status: PlanStatus.REJECTED,
      };
      
      mockPrisma.plan.findUnique.mockResolvedValue(existingPlan);
      mockPrisma.plan.update.mockResolvedValue(rejectedPlan);
      
      // Act
      const result = await planRepository.rejectPlan(planId);
      
      // Assert
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: planId },
      });
      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { status: PlanStatus.REJECTED },
      });
      expect(result).toEqual(rejectedPlan);
    });
    
    it('should throw error when rejecting a non-draft plan', async () => {
      // Arrange
      const planId = '1';
      const existingPlan: Plan = {
        id: planId,
        name: 'Test Plan',
        description: 'Test Description',
        updateId: '1',
        status: PlanStatus.APPROVED, // Already approved
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.plan.findUnique.mockResolvedValue(existingPlan);
      
      // Act & Assert
      await expect(planRepository.rejectPlan(planId))
        .rejects.toThrow('Only draft plans can be rejected');
    });
    
    it('should throw error when rejecting a non-existent plan', async () => {
      // Arrange
      const planId = 'nonexistent';
      mockPrisma.plan.findUnique.mockResolvedValue(null);
      
      // Act & Assert
      await expect(planRepository.rejectPlan(planId))
        .rejects.toThrow('Plan not found');
    });
  });

  describe('getAffectedDevices', () => {
    it('should identify devices affected by an update', async () => {
      // Arrange
      const updateId = '1';
      const updatePackages = [
        {
          package: {
            id: 'pkg1',
            name: 'nginx',
            version: '1.21.0'
          },
          action: 'INSTALL',
          forced: false
        }
      ];
      
      const update = {
        id: updateId,
        name: 'Security Update',
        version: '1.0.0',
        packages: updatePackages
      };
      
      const devices = [
        {
          id: 'dev1',
          name: 'Server 1',
          status: 'ONLINE',
          installedPackages: []
        },
        {
          id: 'dev2',
          name: 'Server 2',
          status: 'ONLINE',
          installedPackages: [
            {
              package: {
                id: 'pkg1',
                name: 'nginx',
                version: '1.20.0' // Older version
              }
            }
          ]
        },
        {
          id: 'dev3',
          name: 'Server 3',
          status: 'ONLINE',
          installedPackages: [
            {
              package: {
                id: 'pkg1',
                name: 'nginx',
                version: '1.21.0' // Same version
              }
            }
          ]
        }
      ];
      
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      mockPrisma.device.findMany.mockResolvedValue(devices as any);
      
      // Act
      const result = await planRepository.getAffectedDevices(updateId);
      
      // Assert
      expect(result.length).toBe(2); // dev1 and dev2 should be affected
      expect(result.some(d => d.id === 'dev1')).toBe(true); // No package installed
      expect(result.some(d => d.id === 'dev2')).toBe(true); // Older version installed
      expect(result.some(d => d.id === 'dev3')).toBe(false); // Up-to-date
    });

    it('should identify devices affected by a forced update', async () => {
      // Arrange
      const updateId = '1';
      const updatePackages = [
        {
          package: {
            id: 'pkg1',
            name: 'nginx',
            version: '1.21.0'
          },
          action: 'INSTALL',
          forced: true // Forced installation
        }
      ];
      
      const update = {
        id: updateId,
        name: 'Security Update',
        version: '1.0.0',
        packages: updatePackages
      };
      
      const devices = [
        {
          id: 'dev1',
          name: 'Server 1',
          status: 'ONLINE',
          installedPackages: []
        },
        {
          id: 'dev2',
          name: 'Server 2',
          status: 'ONLINE',
          installedPackages: [
            {
              package: {
                id: 'pkg1',
                name: 'nginx',
                version: '1.21.0' // Same version
              }
            }
          ]
        }
      ];
      
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      mockPrisma.device.findMany.mockResolvedValue(devices as any);
      
      // Act
      const result = await planRepository.getAffectedDevices(updateId);
      
      // Assert
      expect(result.length).toBe(2); // Both should be affected due to forced installation
      expect(result.some(d => d.id === 'dev1')).toBe(true);
      expect(result.some(d => d.id === 'dev2')).toBe(true);
    });

    it('should identify devices affected by an uninstall action', async () => {
      // Arrange
      const updateId = '1';
      const updatePackages = [
        {
          package: {
            id: 'pkg1',
            name: 'nginx',
            version: '1.21.0'
          },
          action: 'UNINSTALL',
          forced: false
        }
      ];
      
      const update = {
        id: updateId,
        name: 'Security Update',
        version: '1.0.0',
        packages: updatePackages
      };
      
      const devices = [
        {
          id: 'dev1',
          name: 'Server 1',
          status: 'ONLINE',
          installedPackages: []
        },
        {
          id: 'dev2',
          name: 'Server 2',
          status: 'ONLINE',
          installedPackages: [
            {
              package: {
                id: 'pkg1',
                name: 'nginx',
                version: '1.21.0'
              }
            }
          ]
        }
      ];
      
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      mockPrisma.device.findMany.mockResolvedValue(devices as any);
      
      // Act
      const result = await planRepository.getAffectedDevices(updateId);
      
      // Assert
      expect(result.length).toBe(1); // Only dev2 should be affected
      expect(result.some(d => d.id === 'dev1')).toBe(false); // No package to uninstall
      expect(result.some(d => d.id === 'dev2')).toBe(true); // Has package to uninstall
    });

    it('should return empty array for updates with no packages', async () => {
      // Arrange
      const updateId = '1';
      const update = {
        id: updateId,
        name: 'Empty Update',
        version: '1.0.0',
        packages: [] // No packages
      };
      
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      
      // Act
      const result = await planRepository.getAffectedDevices(updateId);
      
      // Assert
      expect(result.length).toBe(0);
      expect(mockPrisma.device.findMany).not.toHaveBeenCalled();
    });

    it('should throw error for a non-existent update', async () => {
      // Arrange
      const updateId = 'nonexistent';
      mockPrisma.update.findUnique.mockResolvedValue(null);
      
      // Act & Assert
      await expect(planRepository.getAffectedDevices(updateId))
        .rejects.toThrow('Update not found');
    });
  });

  // To test the private compareVersions method, we'll need to test it indirectly
  // through getAffectedDevices with different versions
  describe('version comparison', () => {
    it('should correctly identify devices with older versions as affected', async () => {
      // Arrange
      const updateId = '1';
      const updatePackages = [
        {
          package: {
            id: 'pkg1',
            name: 'nginx',
            version: '1.21.5'
          },
          action: 'INSTALL',
          forced: false
        }
      ];
      
      const update = {
        id: updateId,
        name: 'Security Update',
        version: '1.0.0',
        packages: updatePackages
      };
      
      // Create devices with different versions to test various version comparison scenarios
      const devices = [
        {
          id: 'dev1',
          name: 'Server 1',
          status: 'ONLINE',
          installedPackages: [
            {
              package: {
                id: 'pkg1',
                name: 'nginx',
                version: '1.21.0' // Older - affected
              }
            }
          ]
        },
        {
          id: 'dev2',
          name: 'Server 2',
          status: 'ONLINE',
          installedPackages: [
            {
              package: {
                id: 'pkg1',
                name: 'nginx',
                version: '1.21.5' // Same - not affected
              }
            }
          ]
        },
        {
          id: 'dev3',
          name: 'Server 3',
          status: 'ONLINE',
          installedPackages: [
            {
              package: {
                id: 'pkg1',
                name: 'nginx',
                version: '1.21.10' // Newer - not affected
              }
            }
          ]
        },
        {
          id: 'dev4',
          name: 'Server 4',
          status: 'ONLINE',
          installedPackages: [
            {
              package: {
                id: 'pkg1',
                name: 'nginx',
                version: '1.9.0' // Older major version - affected
              }
            }
          ]
        },
        {
          id: 'dev5',
          name: 'Server 5',
          status: 'ONLINE',
          installedPackages: [
            {
              package: {
                id: 'pkg1',
                name: 'nginx',
                version: '2.0.0' // Newer major version - not affected
              }
            }
          ]
        }
      ];
      
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      mockPrisma.device.findMany.mockResolvedValue(devices as any);
      
      // Act
      const result = await planRepository.getAffectedDevices(updateId);
      
      // Assert
      expect(result.length).toBe(2);
      expect(result.some(d => d.id === 'dev1')).toBe(true); // Older minor version
      expect(result.some(d => d.id === 'dev2')).toBe(false); // Same version
      expect(result.some(d => d.id === 'dev3')).toBe(false); // Newer minor version
      expect(result.some(d => d.id === 'dev4')).toBe(true); // Older major version
      expect(result.some(d => d.id === 'dev5')).toBe(false); // Newer major version
    });
  });

  describe('generatePlan', () => {
    it('should generate a plan with appropriate batches for a single device', async () => {
      // Arrange
      const updateId = '1';
      const update = {
        id: updateId,
        name: 'Security Update',
        version: '1.0.0'
      };
      
      // Mock a single affected device
      const devices = [
        {
          id: 'dev1',
          name: 'Server 1',
          status: 'ONLINE',
          type: 'PRODUCTION',
          ipAddress: '192.168.1.1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Mock plan creation
      const createdPlan = {
        id: 'plan1',
        name: 'Plan for Security Update v1.0.0',
        description: 'Automatically generated plan for update Security Update v1.0.0',
        updateId,
        status: PlanStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Mock batch creation
      const massBatch = {
        id: 'batch1',
        name: 'Mass Batch',
        description: 'Mass batch with 1 device',
        planId: 'plan1',
        sequence: 1,
        type: BatchType.MASS,
        monitoringPeriod: 24,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Set up mocks
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      
      // Mock getAffectedDevices without actually implementing it yet
      jest.spyOn(planRepository, 'getAffectedDevices').mockResolvedValue(devices as any);
      
      mockPrisma.plan.create.mockResolvedValue(createdPlan as any);
      mockPrisma.batch.create.mockResolvedValue(massBatch as any);
      mockPrisma.deviceBatch.create.mockResolvedValue({ id: 'db1', deviceId: 'dev1', batchId: 'batch1' } as any);
      
      // Act
      const result = await planRepository.generatePlan(updateId);
      
      // Assert
      expect(result).toEqual(createdPlan);
      expect(planRepository.getAffectedDevices).toHaveBeenCalledWith(updateId);
      expect(mockPrisma.plan.create).toHaveBeenCalledWith({
        data: {
          name: 'Plan for Security Update v1.0.0',
          description: 'Automatically generated plan for update Security Update v1.0.0',
          updateId
        }
      });
      expect(mockPrisma.batch.create).toHaveBeenCalledWith({
        data: {
          name: 'Mass Batch',
          description: expect.stringContaining('Mass batch with'),
          planId: 'plan1',
          sequence: 1,
          type: BatchType.MASS,
          monitoringPeriod: 24
        }
      });
    });

    it('should generate a plan with test and mass batches for multiple devices', async () => {
      // Arrange
      const updateId = '1';
      const update = {
        id: updateId,
        name: 'Security Update',
        version: '1.0.0'
      };
      
      // Mock four affected devices
      const devices = [
        {
          id: 'dev1',
          name: 'Server 1',
          status: 'ONLINE',
          type: 'PRODUCTION',
          ipAddress: '192.168.1.1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'dev2',
          name: 'Server 2',
          status: 'ONLINE',
          type: 'PRODUCTION',
          ipAddress: '192.168.1.2',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'dev3',
          name: 'Server 3',
          status: 'ONLINE',
          type: 'PRODUCTION',
          ipAddress: '192.168.1.3',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'dev4',
          name: 'Server 4',
          status: 'ONLINE',
          type: 'PRODUCTION',
          ipAddress: '192.168.1.4',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Mock plan creation
      const createdPlan = {
        id: 'plan1',
        name: 'Plan for Security Update v1.0.0',
        description: 'Automatically generated plan for update Security Update v1.0.0',
        updateId,
        status: PlanStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Mock batch creation
      const testBatch = {
        id: 'batch1',
        name: 'Test Batch',
        description: 'Mass batch with 1 device',
        planId: 'plan1',
        sequence: 1,
        type: BatchType.TEST,
        monitoringPeriod: 24,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const massBatch = {
        id: 'batch2',
        name: 'Mass Batch',
        description: 'Mass batch with 3 devices',
        planId: 'plan1',
        sequence: 2,
        type: BatchType.MASS,
        monitoringPeriod: 24,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Set up mocks
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      
      // Mock getAffectedDevices
      jest.spyOn(planRepository, 'getAffectedDevices').mockResolvedValue(devices as any);
      
      mockPrisma.plan.create.mockResolvedValue(createdPlan as any);
      
      // Mock batch creation - first create test batch, then mass batch
      mockPrisma.batch.create.mockResolvedValueOnce(testBatch as any);
      mockPrisma.batch.create.mockResolvedValueOnce(massBatch as any);
      
      // Mock device-batch associations
      mockPrisma.deviceBatch.create.mockResolvedValue({ id: 'db1' } as any);
      
      // Act
      const result = await planRepository.generatePlan(updateId);
      
      // Assert
      expect(result).toEqual(createdPlan);
      expect(mockPrisma.batch.create).toHaveBeenCalledTimes(2);
      
      // Check first call for test batch
      expect(mockPrisma.batch.create.mock.calls[0][0]).toEqual({
        data: {
          name: 'Test Batch',
          description: expect.stringContaining('Mass batch with'),
          planId: 'plan1',
          sequence: 1,
          type: BatchType.TEST,
          monitoringPeriod: 24
        }
      });
      
      // Check second call for mass batch
      expect(mockPrisma.batch.create.mock.calls[1][0]).toEqual({
        data: {
          name: 'Mass Batch',
          description: expect.stringContaining('Mass batch with'),
          planId: 'plan1',
          sequence: 2,
          type: BatchType.MASS,
          monitoringPeriod: 24
        }
      });
      
      // Expect deviceBatch create to be called 4 times (once per device)
      expect(mockPrisma.deviceBatch.create).toHaveBeenCalledTimes(4);
    });

    it('should generate a plan with multiple test batches and mass batch for many devices', async () => {
      // Arrange
      const updateId = '1';
      const update = {
        id: updateId,
        name: 'Security Update',
        version: '1.0.0'
      };
      
      // Mock six affected devices
      const devices = Array.from({ length: 6 }, (_, i) => ({
        id: `dev${i+1}`,
        name: `Server ${i+1}`,
        status: 'ONLINE',
        type: 'PRODUCTION',
        ipAddress: `192.168.1.${i+1}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      // Mock plan creation
      const createdPlan = {
        id: 'plan1',
        name: 'Plan for Security Update v1.0.0',
        description: 'Automatically generated plan for update Security Update v1.0.0',
        updateId,
        status: PlanStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Mock batch creation
      const testBatch1 = {
        id: 'batch1',
        name: 'Test Batch 1',
        description: 'Mass batch with 1 device',
        planId: 'plan1',
        sequence: 1,
        type: BatchType.TEST,
        monitoringPeriod: 24,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const testBatch2 = {
        id: 'batch2',
        name: 'Test Batch 2',
        description: 'Mass batch with 1 device',
        planId: 'plan1',
        sequence: 2,
        type: BatchType.TEST,
        monitoringPeriod: 24,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const massBatch = {
        id: 'batch3',
        name: 'Mass Batch',
        description: 'Mass batch with 4 devices',
        planId: 'plan1',
        sequence: 3,
        type: BatchType.MASS,
        monitoringPeriod: 24,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Set up mocks
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      
      // Mock getAffectedDevices
      jest.spyOn(planRepository, 'getAffectedDevices').mockResolvedValue(devices as any);
      
      mockPrisma.plan.create.mockResolvedValue(createdPlan as any);
      
      // Mock batch creation
      mockPrisma.batch.create.mockResolvedValueOnce(testBatch1 as any);
      mockPrisma.batch.create.mockResolvedValueOnce(testBatch2 as any);
      mockPrisma.batch.create.mockResolvedValueOnce(massBatch as any);
      
      // Mock device-batch associations
      mockPrisma.deviceBatch.create.mockResolvedValue({ id: 'db1' } as any);
      
      // Act
      const result = await planRepository.generatePlan(updateId);
      
      // Assert
      expect(result).toEqual(createdPlan);
      expect(mockPrisma.batch.create).toHaveBeenCalledTimes(3);
      
      // Check first call for test batch 1
      expect(mockPrisma.batch.create.mock.calls[0][0]).toEqual({
        data: {
          name: 'Test Batch 1',
          description: expect.stringContaining('Mass batch with'),
          planId: 'plan1',
          sequence: 1,
          type: BatchType.TEST,
          monitoringPeriod: 24
        }
      });
      
      // Check second call for test batch 2
      expect(mockPrisma.batch.create.mock.calls[1][0]).toEqual({
        data: {
          name: 'Test Batch 2',
          description: expect.stringContaining('Mass batch with'),
          planId: 'plan1',
          sequence: 2,
          type: BatchType.TEST,
          monitoringPeriod: 24
        }
      });
      
      // Check third call for mass batch
      expect(mockPrisma.batch.create.mock.calls[2][0]).toEqual({
        data: {
          name: 'Mass Batch',
          description: expect.stringContaining('Mass batch with'),
          planId: 'plan1',
          sequence: 3,
          type: BatchType.MASS,
          monitoringPeriod: 24
        }
      });
      
      // Expect deviceBatch create to be called 6 times (once per device)
      expect(mockPrisma.deviceBatch.create).toHaveBeenCalledTimes(6);
    });

    it('should throw error for non-existent update', async () => {
      // Arrange
      const updateId = 'nonexistent';
      mockPrisma.update.findUnique.mockResolvedValue(null);
      
      // Act & Assert
      await expect(planRepository.generatePlan(updateId))
        .rejects.toThrow('Update not found');
    });

    it('should throw error when no affected devices are found', async () => {
      // Arrange
      const updateId = '1';
      const update = {
        id: updateId,
        name: 'Security Update',
        version: '1.0.0'
      };
      
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      
      // Mock getAffectedDevices to return empty array
      jest.spyOn(planRepository, 'getAffectedDevices').mockResolvedValue([]);
      
      // Act & Assert
      await expect(planRepository.generatePlan(updateId))
        .rejects.toThrow('No affected devices found for this update');
    });

    it('should filter devices when deviceIds are provided', async () => {
      // Arrange
      const updateId = '1';
      const update = {
        id: updateId,
        name: 'Security Update',
        version: '1.0.0'
      };
      
      // Mock affected devices
      const devices = [
        {
          id: 'dev1',
          name: 'Server 1',
          status: 'ONLINE',
          type: 'PRODUCTION',
          ipAddress: '192.168.1.1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'dev2',
          name: 'Server 2',
          status: 'ONLINE',
          type: 'PRODUCTION',
          ipAddress: '192.168.1.2',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Mock plan creation
      const createdPlan = {
        id: 'plan1',
        name: 'Plan for Security Update v1.0.0',
        description: 'Automatically generated plan for update Security Update v1.0.0',
        updateId,
        status: PlanStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Mock batch creation
      const massBatch = {
        id: 'batch1',
        name: 'Mass Batch',
        description: 'Mass batch with 1 device',
        planId: 'plan1',
        sequence: 1,
        type: BatchType.MASS,
        monitoringPeriod: 24,
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Set up mocks
      mockPrisma.update.findUnique.mockResolvedValue(update as any);
      
      // Mock getAffectedDevices
      jest.spyOn(planRepository, 'getAffectedDevices').mockResolvedValue(devices as any);
      
      mockPrisma.plan.create.mockResolvedValue(createdPlan as any);
      mockPrisma.batch.create.mockResolvedValue(massBatch as any);
      mockPrisma.deviceBatch.create.mockResolvedValue({ id: 'db1' } as any);
      
      // Act
      // Only include device with ID 'dev1'
      const result = await planRepository.generatePlan(updateId, ['dev1']);
      
      // Assert
      expect(result).toEqual(createdPlan);
      expect(mockPrisma.batch.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.deviceBatch.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.deviceBatch.create).toHaveBeenCalledWith({
        data: {
          deviceId: 'dev1',
          batchId: massBatch.id
        }
      });
    });
  });
}); 