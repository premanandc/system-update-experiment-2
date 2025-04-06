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
}); 