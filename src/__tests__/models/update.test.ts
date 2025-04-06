import { PrismaClient } from '@prisma/client';
import { Update, UpdateCreateInput, UpdateStatus } from '../../models/update';
import { mockDeep, mockReset } from 'jest-mock-extended';

// Mock PrismaClient
const mockPrisma = mockDeep<PrismaClient>();

// Create an instance of the Update class with the mocked PrismaClient
const updateModel = new Update(mockPrisma);

// Reset mocks before each test
beforeEach(() => {
  mockReset(mockPrisma);
});

describe('Update Model', () => {
  describe('create', () => {
    it('should create a new update without packages', async () => {
      // Arrange
      const updateData: UpdateCreateInput = {
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
      };
      
      const expectedUpdate = {
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
      const result = await updateModel.create(updateData);
      
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
        packageIds: ['pkg1', 'pkg2'],
      };
      
      const expectedUpdate = {
        id: '1',
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Use a type for the function argument
      mockPrisma.$transaction.mockImplementation((fn: unknown) => {
        if (typeof fn === 'function') {
          // Mock the transaction function call
          mockPrisma.update.create.mockResolvedValue(expectedUpdate);
          return Promise.resolve(fn(mockPrisma));
        }
        return Promise.resolve(undefined);
      });
      
      // Act
      const result = await updateModel.create(updateData);
      
      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(expectedUpdate);
    });
  });
  
  describe('findById', () => {
    it('should find an update by its ID', async () => {
      // Arrange
      const updateId = '1';
      const expectedUpdate = {
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
      const result = await updateModel.findById(updateId);
      
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
      const expectedUpdates = [
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
          name: 'Feature Update',
          version: 'v2.0.0',
          description: 'New features for August',
          status: UpdateStatus.PUBLISHED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrisma.update.findMany.mockResolvedValue(expectedUpdates);
      
      // Act
      const result = await updateModel.findByStatus(status);
      
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
        version: 'v1.0.1',
      };
      const expectedUpdate = {
        id: updateId,
        name: 'Monthly Security Patch',
        version: 'v1.0.1',
        description: 'Updated description',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.update.update.mockResolvedValue(expectedUpdate);
      
      // Act
      const result = await updateModel.update(updateId, updateData);
      
      // Assert
      expect(mockPrisma.update.update).toHaveBeenCalledWith({
        where: { id: updateId },
        data: updateData,
      });
      expect(result).toEqual(expectedUpdate);
    });
  });
  
  describe('setStatus', () => {
    it('should set an update status', async () => {
      // Arrange
      const updateId = '1';
      const status = UpdateStatus.PUBLISHED;
      const expectedUpdate = {
        id: updateId,
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
        status: UpdateStatus.PUBLISHED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.update.update.mockResolvedValue(expectedUpdate);
      
      // Act
      const result = await updateModel.setStatus(updateId, status);
      
      // Assert
      expect(mockPrisma.update.update).toHaveBeenCalledWith({
        where: { id: updateId },
        data: { status },
      });
      expect(result).toEqual(expectedUpdate);
    });
  });
  
  describe('addPackages', () => {
    it('should add packages to an update', async () => {
      // Arrange
      const updateId = '1';
      const packageIds = ['pkg1', 'pkg2'];
      
      mockPrisma.$transaction.mockResolvedValue([]);
      
      // Act
      await updateModel.addPackages(updateId, packageIds);
      
      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
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
      
      mockPrisma.updatePackage.findMany.mockResolvedValue(updatePackages);
      
      // Act
      const result = await updateModel.getPackages(updateId);
      
      // Assert
      expect(mockPrisma.updatePackage.findMany).toHaveBeenCalledWith({
        where: { updateId },
        include: { package: true },
      });
      expect(result).toEqual(updatePackages.map(up => up.package));
    });
  });
  
  describe('status change methods', () => {
    it('should publish an update', async () => {
      // Arrange
      const updateId = '1';
      const expectedUpdate = {
        id: updateId,
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
        status: UpdateStatus.PUBLISHED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.update.update.mockResolvedValue(expectedUpdate);
      
      // Act
      const result = await updateModel.publishUpdate(updateId);
      
      // Assert
      expect(mockPrisma.update.update).toHaveBeenCalledWith({
        where: { id: updateId },
        data: { status: UpdateStatus.PUBLISHED },
      });
      expect(result).toEqual(expectedUpdate);
    });
    
    it('should set an update to testing', async () => {
      // Arrange
      const updateId = '1';
      const expectedUpdate = {
        id: updateId,
        name: 'Monthly Security Patch',
        version: 'v1.0.0',
        description: 'Security updates for July',
        status: UpdateStatus.TESTING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.update.update.mockResolvedValue(expectedUpdate);
      
      // Act
      const result = await updateModel.testUpdate(updateId);
      
      // Assert
      expect(mockPrisma.update.update).toHaveBeenCalledWith({
        where: { id: updateId },
        data: { status: UpdateStatus.TESTING },
      });
      expect(result).toEqual(expectedUpdate);
    });
  });
}); 