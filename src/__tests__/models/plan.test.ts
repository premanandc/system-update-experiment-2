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
  });
}); 