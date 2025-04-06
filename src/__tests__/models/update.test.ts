import { PrismaClient } from '@prisma/client';
import { Update, UpdateCreateInput, UpdateStatus, PrismaUpdateRepository } from '../../models/update';
import { mockDeep, mockReset } from 'jest-mock-extended';
import { mock } from 'jest-mock-extended';
import { PackageAction, UpdatePackage, UpdatePackageInput } from '../../models/update';
import { Package } from '../../models/package';

// Mock PrismaClient
const mockPrisma = mockDeep<PrismaClient>();
mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));

// Create an instance of the UpdateRepository with the mocked PrismaClient
const updateRepository = new PrismaUpdateRepository(mockPrisma);

// Reset mocks before each test
beforeEach(() => {
  mockReset(mockPrisma);
});

describe('UpdateRepository', () => {
  describe('create', () => {
    it('should create a new update without packages', async () => {
      // Arrange
      const updateData: UpdateCreateInput = {
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
      };
      
      const expectedUpdate: Update = {
        id: '1',
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.update.create.mockResolvedValue(expectedUpdate);
      
      // Act
      const result = await updateRepository.create(updateData);
      
      // Assert
      expect(mockPrisma.update.create).toHaveBeenCalledWith({
        data: updateData,
      });
      expect(result).toEqual(expectedUpdate);
    });
    
    it('should create a new update with packages', async () => {
      // Arrange
      const updateData: UpdateCreateInput = {
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
        packages: [
          { 
            packageId: 'pkg1',
            action: PackageAction.INSTALL,
            forced: true,
            requiresReboot: true
          },
          { 
            packageId: 'pkg2',
            action: PackageAction.UNINSTALL,
            forced: false,
            requiresReboot: false
          }
        ]
      };
      
      const expectedUpdate: Update = {
        id: '1',
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // We need to setup the transaction to mock the create calls
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        mockPrisma.update.create.mockResolvedValue(expectedUpdate);
        return callback(mockPrisma);
      });
      
      // Act
      const result = await updateRepository.create(updateData);
      
      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(expectedUpdate);
    });
  });
  
  describe('findById', () => {
    it('should find an update by its ID', async () => {
      // Arrange
      const updateId = '1';
      const expectedUpdate: Update = {
        id: updateId,
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.update.findUnique.mockResolvedValue(expectedUpdate);
      
      // Act
      const result = await updateRepository.findById(updateId);
      
      // Assert
      expect(mockPrisma.update.findUnique).toHaveBeenCalledWith({
        where: { id: updateId },
      });
      expect(result).toEqual(expectedUpdate);
    });
  });
  
  describe('findByStatus', () => {
    it('should find updates by status', async () => {
      // Arrange
      const status = UpdateStatus.PUBLISHED;
      const expectedUpdates: Update[] = [
        {
          id: '1',
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.PUBLISHED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Quarterly Feature Update',
          version: 'v2.0.0',
          description: 'New features for Q2',
          status: UpdateStatus.PUBLISHED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrisma.update.findMany.mockResolvedValue(expectedUpdates);
      
      // Act
      const result = await updateRepository.findByStatus(status);
      
      // Assert
      expect(mockPrisma.update.findMany).toHaveBeenCalledWith({
        where: { status },
      });
      expect(result).toEqual(expectedUpdates);
    });
  });
  
  describe('update', () => {
    it('should update an update', async () => {
      // Arrange
      const updateId = '1';
      const updateData = {
        description: 'Updated description',
      };
      const expectedUpdate: Update = {
        id: updateId,
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Updated description',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.update.update.mockResolvedValue(expectedUpdate);
      
      // Act
      const result = await updateRepository.update(updateId, updateData);
      
      // Assert
      expect(mockPrisma.update.update).toHaveBeenCalledWith({
        where: { id: updateId },
        data: updateData,
      });
      expect(result).toEqual(expectedUpdate);
    });
  });
  
  describe('delete', () => {
    it('should delete an update', async () => {
      // Arrange
      const updateId = '1';
      const expectedUpdate: Update = {
        id: updateId,
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.update.delete.mockResolvedValue(expectedUpdate);
      
      // Act
      const result = await updateRepository.delete(updateId);
      
      // Assert
      expect(mockPrisma.update.delete).toHaveBeenCalledWith({
        where: { id: updateId },
      });
      expect(result).toEqual(expectedUpdate);
    });
  });
  
  describe('addPackage and updatePackageOptions', () => {
    it('should add a package to an update', async () => {
      // Arrange
      const updateId = '1';
      const packageInput: UpdatePackageInput = {
        packageId: 'pkg1',
        action: PackageAction.INSTALL,
        forced: true,
        requiresReboot: true
      };
      
      // Act
      await updateRepository.addPackage(updateId, packageInput);
      
      // Assert
      expect(mockPrisma.updatePackage.create).toHaveBeenCalledWith({
        data: {
          updateId,
          packageId: 'pkg1',
          action: PackageAction.INSTALL,
          forced: true,
          requiresReboot: true
        }
      });
    });
    
    it('should update package options', async () => {
      // Arrange
      const updateId = '1';
      const packageId = 'pkg1';
      const options = {
        action: PackageAction.UNINSTALL,
        forced: true,
        requiresReboot: false
      };
      
      // Act
      await updateRepository.updatePackageOptions(updateId, packageId, options);
      
      // Assert
      expect(mockPrisma.updatePackage.update).toHaveBeenCalledWith({
        where: {
          updateId_packageId: {
            updateId,
            packageId
          }
        },
        data: options
      });
    });
  });
  
  describe('addPackages', () => {
    it('should add packages to an update', async () => {
      // Arrange
      const updateId = '1';
      const packageInputs: UpdatePackageInput[] = [
        {
          packageId: 'pkg1',
          action: PackageAction.INSTALL,
          forced: true,
          requiresReboot: true
        },
        {
          packageId: 'pkg2',
          action: PackageAction.UNINSTALL
        }
      ];
      
      // Act
      await updateRepository.addPackages(updateId, packageInputs);
      
      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
  
  describe('getUpdatePackages', () => {
    it('should get update packages with details', async () => {
      // Arrange
      const updateId = '1';
      const prismaUpdatePackages = [
        {
          id: 'rel1',
          updateId: '1',
          packageId: 'pkg1',
          action: PackageAction.INSTALL,
          forced: true,
          requiresReboot: true,
          createdAt: new Date(),
          package: {
            id: 'pkg1',
            name: 'nginx',
            version: '1.21.0',
            vendor: 'Nginx Inc.',
            description: 'Web server',
            status: 'PUBLISHED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'rel2',
          updateId: '1',
          packageId: 'pkg2',
          action: PackageAction.UNINSTALL,
          forced: false,
          requiresReboot: false,
          createdAt: new Date(),
          package: {
            id: 'pkg2',
            name: 'node',
            version: '16.9.1',
            vendor: 'Node.js Foundation',
            description: 'JavaScript runtime',
            status: 'PUBLISHED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];
      
      mockPrisma.updatePackage.findMany.mockResolvedValue(prismaUpdatePackages as any);
      
      // Act
      const result = await updateRepository.getUpdatePackages(updateId);
      
      // Assert
      expect(mockPrisma.updatePackage.findMany).toHaveBeenCalledWith({
        where: { updateId },
        include: { package: true },
      });
      
      expect(result.length).toBe(2);
      expect(result[0].action).toBe(PackageAction.INSTALL);
      expect(result[0].forced).toBe(true);
      expect(result[0].requiresReboot).toBe(true);
      expect(result[0].package.name).toBe('nginx');
      
      expect(result[1].action).toBe(PackageAction.UNINSTALL);
      expect(result[1].forced).toBe(false);
      expect(result[1].requiresReboot).toBe(false);
      expect(result[1].package.name).toBe('node');
    });
  });
  
  describe('getPackages', () => {
    it('should get packages for an update', async () => {
      // Arrange
      const updateId = '1';
      const updatePackages = [
        {
          id: 'rel1',
          updateId: '1',
          packageId: 'pkg1',
          action: PackageAction.INSTALL,
          forced: true,
          requiresReboot: true,
          createdAt: new Date(),
          package: {
            id: 'pkg1',
            name: 'nginx',
            version: '1.21.0',
            vendor: 'Nginx Inc.',
            description: 'Web server',
            status: 'PUBLISHED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'rel2',
          updateId: '1',
          packageId: 'pkg2',
          action: PackageAction.UNINSTALL,
          forced: false,
          requiresReboot: false,
          createdAt: new Date(),
          package: {
            id: 'pkg2',
            name: 'node',
            version: '16.9.1',
            vendor: 'Node.js Foundation',
            description: 'JavaScript runtime',
            status: 'PUBLISHED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];
      
      mockPrisma.updatePackage.findMany.mockResolvedValue(updatePackages as any);
      
      // Act
      const result = await updateRepository.getPackages(updateId);
      
      // Assert
      expect(mockPrisma.updatePackage.findMany).toHaveBeenCalledWith({
        where: { updateId },
        include: { package: true },
      });
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('nginx');
      expect(result[1].name).toBe('node');
    });
  });
  
  describe('requiresReboot', () => {
    it('should return true if any package requires a reboot', async () => {
      // Arrange
      const updateId = '1';
      const updatePackages = [
        {
          requiresReboot: false
        },
        {
          requiresReboot: true
        }
      ];
      
      mockPrisma.updatePackage.findMany.mockResolvedValue(updatePackages as any);
      
      // Act
      const result = await updateRepository.requiresReboot(updateId);
      
      // Assert
      expect(mockPrisma.updatePackage.findMany).toHaveBeenCalledWith({
        where: { updateId },
        select: { requiresReboot: true }
      });
      expect(result).toBe(true);
    });
    
    it('should return false if no package requires a reboot', async () => {
      // Arrange
      const updateId = '1';
      const updatePackages = [
        {
          requiresReboot: false
        },
        {
          requiresReboot: false
        }
      ];
      
      mockPrisma.updatePackage.findMany.mockResolvedValue(updatePackages as any);
      
      // Act
      const result = await updateRepository.requiresReboot(updateId);
      
      // Assert
      expect(result).toBe(false);
    });
    
    it('should return false if there are no packages', async () => {
      // Arrange
      const updateId = '1';
      mockPrisma.updatePackage.findMany.mockResolvedValue([] as any);
      
      // Act
      const result = await updateRepository.requiresReboot(updateId);
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  describe('status transition methods', () => {
    describe('publishUpdate', () => {
      it('should publish a draft update with packages', async () => {
        // Arrange
        const updateId = '1';
        const existingUpdate: Update = {
          id: updateId,
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.DRAFT,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const packages = [
          { id: 'pkg1', name: 'package1', version: '1.0', status: 'PUBLISHED' as any, createdAt: new Date(), updatedAt: new Date(), vendor: null, description: null }
        ];
        
        const publishedUpdate = {
          ...existingUpdate,
          status: UpdateStatus.PUBLISHED
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        mockPrisma.updatePackage.findMany.mockResolvedValue([{ package: packages[0] }] as any);
        mockPrisma.update.update.mockResolvedValue(publishedUpdate);
        
        // Act
        const result = await updateRepository.publishUpdate(updateId);
        
        // Assert
        expect(mockPrisma.update.findUnique).toHaveBeenCalledWith({
          where: { id: updateId }
        });
        expect(mockPrisma.updatePackage.findMany).toHaveBeenCalled();
        expect(mockPrisma.update.update).toHaveBeenCalledWith({
          where: { id: updateId },
          data: { status: UpdateStatus.PUBLISHED }
        });
        expect(result.status).toBe(UpdateStatus.PUBLISHED);
      });
      
      it('should throw error when publishing a non-draft update', async () => {
        // Arrange
        const updateId = '1';
        const existingUpdate: Update = {
          id: updateId,
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.PUBLISHED,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        
        // Act & Assert
        await expect(updateRepository.publishUpdate(updateId))
          .rejects.toThrow('Only draft updates can be published');
      });
      
      it('should throw error when publishing an update without packages', async () => {
        // Arrange
        const updateId = '1';
        const existingUpdate: Update = {
          id: updateId,
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.DRAFT,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        mockPrisma.updatePackage.findMany.mockResolvedValue([] as any);
        
        // Act & Assert
        await expect(updateRepository.publishUpdate(updateId))
          .rejects.toThrow('Cannot publish an update without packages');
      });
    });
    
    describe('testUpdate', () => {
      it('should move a published update to testing', async () => {
        // Arrange
        const updateId = '1';
        const existingUpdate: Update = {
          id: updateId,
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.PUBLISHED,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const testingUpdate = {
          ...existingUpdate,
          status: UpdateStatus.TESTING
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        mockPrisma.update.update.mockResolvedValue(testingUpdate);
        
        // Act
        const result = await updateRepository.testUpdate(updateId);
        
        // Assert
        expect(mockPrisma.update.update).toHaveBeenCalledWith({
          where: { id: updateId },
          data: { status: UpdateStatus.TESTING }
        });
        expect(result.status).toBe(UpdateStatus.TESTING);
      });
      
      it('should throw error when testing a non-published update', async () => {
        // Arrange
        const updateId = '1';
        const existingUpdate: Update = {
          id: updateId,
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.DRAFT,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        
        // Act & Assert
        await expect(updateRepository.testUpdate(updateId))
          .rejects.toThrow('Only published updates can be moved to testing');
      });
    });
    
    describe('cancelUpdate', () => {
      it('should cancel a draft, published, or testing update', async () => {
        // Arrange
        const updateId = '1';
        const existingUpdate: Update = {
          id: updateId,
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.TESTING,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        mockPrisma.update.update.mockResolvedValue({
          ...existingUpdate,
          status: UpdateStatus.CANCELLED
        });
        
        // Act
        const result = await updateRepository.cancelUpdate(updateId);
        
        // Assert
        expect(mockPrisma.update.update).toHaveBeenCalledWith({
          where: { id: updateId },
          data: { status: UpdateStatus.CANCELLED }
        });
        expect(result.status).toBe(UpdateStatus.CANCELLED);
      });
      
      it('should throw error when cancelling a completed update', async () => {
        // Arrange
        const updateId = '1';
        const existingUpdate: Update = {
          id: updateId,
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.COMPLETED,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        
        // Act & Assert
        await expect(updateRepository.cancelUpdate(updateId))
          .rejects.toThrow('Only draft, published, or testing updates can be cancelled');
      });
    });
  });
}); 