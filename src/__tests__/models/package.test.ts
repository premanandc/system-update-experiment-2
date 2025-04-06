import { PrismaClient } from '@prisma/client';
import { Package, PackageCreateInput, PackageStatus } from '../../models/package';
import { mockDeep, mockReset } from 'jest-mock-extended';

// Mock PrismaClient
const mockPrisma = mockDeep<PrismaClient>();

// Create an instance of the Package class with the mocked PrismaClient
const packageModel = new Package(mockPrisma);

// Reset mocks before each test
beforeEach(() => {
  mockReset(mockPrisma);
});

describe('Package Model', () => {
  describe('create', () => {
    it('should create a new package', async () => {
      // Arrange
      const packageData: PackageCreateInput = {
        name: 'nginx',
        version: '1.21.0',
        vendor: 'Nginx Inc.',
        description: 'High-performance HTTP server',
      };
      
      const expectedPackage = {
        id: '1',
        name: 'nginx',
        version: '1.21.0',
        vendor: 'Nginx Inc.',
        description: 'High-performance HTTP server',
        status: PackageStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.package.create.mockResolvedValue(expectedPackage);
      
      // Act
      const result = await packageModel.create(packageData);
      
      // Assert
      expect(mockPrisma.package.create).toHaveBeenCalledWith({
        data: packageData,
      });
      expect(result).toEqual(expectedPackage);
    });
  });
  
  describe('findById', () => {
    it('should find a package by its ID', async () => {
      // Arrange
      const packageId = '1';
      const expectedPackage = {
        id: packageId,
        name: 'nginx',
        version: '1.21.0',
        vendor: 'Nginx Inc.',
        description: 'High-performance HTTP server',
        status: PackageStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.package.findUnique.mockResolvedValue(expectedPackage);
      
      // Act
      const result = await packageModel.findById(packageId);
      
      // Assert
      expect(mockPrisma.package.findUnique).toHaveBeenCalledWith({
        where: { id: packageId },
      });
      expect(result).toEqual(expectedPackage);
    });
    
    it('should return null when package is not found', async () => {
      // Arrange
      const packageId = 'non-existent-id';
      mockPrisma.package.findUnique.mockResolvedValue(null);
      
      // Act
      const result = await packageModel.findById(packageId);
      
      // Assert
      expect(mockPrisma.package.findUnique).toHaveBeenCalledWith({
        where: { id: packageId },
      });
      expect(result).toBeNull();
    });
  });
  
  describe('findByNameAndVersion', () => {
    it('should find a package by name and version', async () => {
      // Arrange
      const name = 'nginx';
      const version = '1.21.0';
      const expectedPackage = {
        id: '1',
        name: 'nginx',
        version: '1.21.0',
        vendor: 'Nginx Inc.',
        description: 'High-performance HTTP server',
        status: PackageStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.package.findUnique.mockResolvedValue(expectedPackage);
      
      // Act
      const result = await packageModel.findByNameAndVersion(name, version);
      
      // Assert
      expect(mockPrisma.package.findUnique).toHaveBeenCalledWith({
        where: {
          name_version: {
            name,
            version
          }
        }
      });
      expect(result).toEqual(expectedPackage);
    });
  });
  
  describe('findByStatus', () => {
    it('should find packages by status', async () => {
      // Arrange
      const status = PackageStatus.PUBLISHED;
      const expectedPackages = [
        {
          id: '1',
          name: 'nginx',
          version: '1.21.0',
          vendor: 'Nginx Inc.',
          description: 'High-performance HTTP server',
          status: PackageStatus.PUBLISHED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'node',
          version: '16.9.1',
          vendor: 'Node.js Foundation',
          description: 'JavaScript runtime',
          status: PackageStatus.PUBLISHED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrisma.package.findMany.mockResolvedValue(expectedPackages);
      
      // Act
      const result = await packageModel.findByStatus(status);
      
      // Assert
      expect(mockPrisma.package.findMany).toHaveBeenCalledWith({
        where: { status },
      });
      expect(result).toEqual(expectedPackages);
    });
  });
  
  describe('update', () => {
    it('should update a package', async () => {
      // Arrange
      const packageId = '1';
      const updateData = {
        description: 'Updated description',
        vendor: 'Updated vendor',
      };
      const expectedPackage = {
        id: packageId,
        name: 'nginx',
        version: '1.21.0',
        vendor: 'Updated vendor',
        description: 'Updated description',
        status: PackageStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.package.update.mockResolvedValue(expectedPackage);
      
      // Act
      const result = await packageModel.update(packageId, updateData);
      
      // Assert
      expect(mockPrisma.package.update).toHaveBeenCalledWith({
        where: { id: packageId },
        data: updateData,
      });
      expect(result).toEqual(expectedPackage);
    });
  });
  
  describe('status change methods', () => {
    it('should publish a package', async () => {
      // Arrange
      const packageId = '1';
      const expectedPackage = {
        id: packageId,
        name: 'nginx',
        version: '1.21.0',
        vendor: 'Nginx Inc.',
        description: 'High-performance HTTP server',
        status: PackageStatus.PUBLISHED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.package.update.mockResolvedValue(expectedPackage);
      
      // Act
      const result = await packageModel.publishPackage(packageId);
      
      // Assert
      expect(mockPrisma.package.update).toHaveBeenCalledWith({
        where: { id: packageId },
        data: { status: PackageStatus.PUBLISHED },
      });
      expect(result).toEqual(expectedPackage);
    });
    
    it('should deprecate a package', async () => {
      // Arrange
      const packageId = '1';
      const expectedPackage = {
        id: packageId,
        name: 'nginx',
        version: '1.21.0',
        vendor: 'Nginx Inc.',
        description: 'High-performance HTTP server',
        status: PackageStatus.DEPRECATED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.package.update.mockResolvedValue(expectedPackage);
      
      // Act
      const result = await packageModel.deprecatePackage(packageId);
      
      // Assert
      expect(mockPrisma.package.update).toHaveBeenCalledWith({
        where: { id: packageId },
        data: { status: PackageStatus.DEPRECATED },
      });
      expect(result).toEqual(expectedPackage);
    });
    
    it('should archive a package', async () => {
      // Arrange
      const packageId = '1';
      const expectedPackage = {
        id: packageId,
        name: 'nginx',
        version: '1.21.0',
        vendor: 'Nginx Inc.',
        description: 'High-performance HTTP server',
        status: PackageStatus.ARCHIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.package.update.mockResolvedValue(expectedPackage);
      
      // Act
      const result = await packageModel.archivePackage(packageId);
      
      // Assert
      expect(mockPrisma.package.update).toHaveBeenCalledWith({
        where: { id: packageId },
        data: { status: PackageStatus.ARCHIVED },
      });
      expect(result).toEqual(expectedPackage);
    });
  });
}); 