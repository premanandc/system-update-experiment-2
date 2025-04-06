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
    
    it('should create a new update with packages using default values for missing optional parameters', async () => {
      // Arrange
      const updateData: UpdateCreateInput = {
        name: 'Update with Default Values',
        version: 'v1.0.0',
        description: 'Testing default values',
        packages: [
          { 
            packageId: 'pkg1'
            // action, forced, requiresReboot are omitted
          }
        ]
      };
      
      const expectedUpdate: Update = {
        id: '1',
        name: 'Update with Default Values',
        version: 'v1.0.0',
        description: 'Testing default values',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Reset mocks
      mockReset(mockPrisma.update.create);
      mockReset(mockPrisma.updatePackage.create);
      
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
      
      // Verify package creation with default values
      const call = mockPrisma.updatePackage.create.mock.calls[0][0];
      expect(call.data).toEqual({
        updateId: '1',
        packageId: 'pkg1',
        action: PackageAction.INSTALL,  // default
        forced: false,                  // default
        requiresReboot: false           // default
      });
    });

    it('should explicitly test the package length check', async () => {
      // Arrange
      const updateData: UpdateCreateInput = {
        name: 'Empty Package Test',
        version: 'v1.0.0',
        description: 'Testing the packages length check',
        packages: [] // Empty packages array
      };
      
      const expectedUpdate: Update = {
        id: '1',
        name: 'Empty Package Test',
        version: 'v1.0.0',
        description: 'Testing the packages length check',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.update.create.mockResolvedValue(expectedUpdate);
      
      // Act
      const result = await updateRepository.create(updateData);
      
      // Assert
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.update.create).toHaveBeenCalledWith({
        data: {
          name: 'Empty Package Test',
          version: 'v1.0.0',
          description: 'Testing the packages length check'
        },
      });
      expect(result).toEqual(expectedUpdate);
    });

    it('should verify the correct update data is passed to create function', async () => {
      // Arrange
      const updateData: UpdateCreateInput = {
        name: 'Update Data Verification',
        version: 'v1.0.0',
        description: 'Verifying correct data flow',
        packages: [
          { 
            packageId: 'pkg1',
            action: PackageAction.INSTALL
          }
        ]
      };
      
      const expectedUpdate: Update = {
        id: '1',
        name: 'Update Data Verification',
        version: 'v1.0.0',
        description: 'Verifying correct data flow',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Reset mocks
      mockReset(mockPrisma.update.create);
      
      // Mock create function with the expected return
      mockPrisma.update.create.mockResolvedValue(expectedUpdate);
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      
      // Act
      const result = await updateRepository.create(updateData);
      
      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      
      // Check that update.create was called with the correct data
      const createCall = mockPrisma.update.create.mock.calls[0][0];
      expect(createCall.data).toEqual({
        name: 'Update Data Verification',
        version: 'v1.0.0',
        description: 'Verifying correct data flow'
      });
      expect(result).toEqual(expectedUpdate);
    });

    it('should explicitly test forced and requiresReboot defaults in create method', async () => {
      // Arrange
      const updateData: UpdateCreateInput = {
        name: 'Testing Default Values',
        version: 'v1.0.0',
        description: 'Test default values explicitly',
        packages: [
          { 
            packageId: 'pkg1',
            action: PackageAction.INSTALL,
            forced: true,       // Explicitly set to true
            requiresReboot: true // Explicitly set to true
          },
          { 
            packageId: 'pkg2',
            action: PackageAction.INSTALL,
            forced: false,       // Explicitly set to false
            requiresReboot: false // Explicitly set to false
          },
          { 
            packageId: 'pkg3',
            action: PackageAction.INSTALL
            // forced and requiresReboot omitted to test defaults
          }
        ]
      };
      
      const expectedUpdate: Update = {
        id: '1',
        name: 'Testing Default Values',
        version: 'v1.0.0',
        description: 'Test default values explicitly',
        status: UpdateStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Reset mock
      mockReset(mockPrisma.updatePackage.create);
      
      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        mockPrisma.update.create.mockResolvedValue(expectedUpdate);
        return callback(mockPrisma);
      });
      
      // Act
      await updateRepository.create(updateData);
      
      // Assert
      // Verify each updatePackage.create call to ensure defaults are properly applied
      const calls = mockPrisma.updatePackage.create.mock.calls;
      expect(calls.length).toBe(3);
      
      // First package: explicit true values
      expect(calls[0][0].data.forced).toBe(true);
      expect(calls[0][0].data.requiresReboot).toBe(true);
      
      // Second package: explicit false values
      expect(calls[1][0].data.forced).toBe(false);
      expect(calls[1][0].data.requiresReboot).toBe(false);
      
      // Third package: defaults should be applied
      expect(calls[2][0].data.forced).toBe(false);
      expect(calls[2][0].data.requiresReboot).toBe(false);
      
      // Check that the || false logic is properly tested
      // The following variables demonstrate the behavior of || with different values
      const withExplicitTrue = true;
      const withExplicitFalse = false;
      const withUndefined = undefined;
      
      // These assertions demonstrate how the default value logic works for each case
      expect(withExplicitTrue || false).toBe(true);  // true is used, false is ignored
      expect(withExplicitFalse || false).toBe(false); // false is used
      expect(withUndefined || false).toBe(false);    // undefined is falsy, so false is used
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
  
  describe('findAll', () => {
    it('should return all updates', async () => {
      // Arrange
      const expectedUpdates: Update[] = [
        {
          id: '1',
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.DRAFT,
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
        {
          id: '3',
          name: 'Emergency Hotfix',
          version: 'v1.0.1',
          description: 'Critical security fix',
          status: UpdateStatus.COMPLETED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrisma.update.findMany.mockResolvedValue(expectedUpdates);
      
      // Act
      const result = await updateRepository.findAll();
      
      // Assert
      expect(mockPrisma.update.findMany).toHaveBeenCalledWith();
      expect(result).toEqual(expectedUpdates);
      expect(result.length).toBe(3);
    });
    
    it('should return an empty array when no updates exist', async () => {
      // Arrange
      mockPrisma.update.findMany.mockResolvedValue([]);
      
      // Act
      const result = await updateRepository.findAll();
      
      // Assert
      expect(mockPrisma.update.findMany).toHaveBeenCalledWith();
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
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
    
    it('should use default values when optional parameters are omitted', async () => {
      // Arrange
      const updateId = '1';
      const packageInput: UpdatePackageInput = {
        packageId: 'pkg1'
        // action, forced, and requiresReboot are intentionally omitted
      };
      
      // Act
      await updateRepository.addPackage(updateId, packageInput);
      
      // Assert
      expect(mockPrisma.updatePackage.create).toHaveBeenCalledWith({
        data: {
          updateId,
          packageId: 'pkg1',
          action: PackageAction.INSTALL,  // default
          forced: false,                  // default
          requiresReboot: false           // default
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
    
    it('should use default values when some packages have missing optional parameters', async () => {
      // Arrange
      const updateId = '1';
      const packageInputs: UpdatePackageInput[] = [
        {
          packageId: 'pkg1'
          // No optional parameters provided
        },
        {
          packageId: 'pkg2',
          action: PackageAction.UNINSTALL
          // forced and requiresReboot are omitted
        },
        {
          packageId: 'pkg3',
          forced: true
          // action and requiresReboot are omitted
        }
      ];
      
      // Reset the mock before this test
      mockReset(mockPrisma.updatePackage.create);
      
      // Act
      await updateRepository.addPackages(updateId, packageInputs);
      
      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      
      // Verify the calls to create were made with the right data
      const calls = mockPrisma.updatePackage.create.mock.calls;
      expect(calls.length).toBe(3);
      
      // Check first package (all defaults)
      expect(calls[0][0].data).toEqual({
        updateId,
        packageId: 'pkg1',
        action: PackageAction.INSTALL,
        forced: false,
        requiresReboot: false
      });
      
      // Check second package (action provided, other defaults)
      expect(calls[1][0].data).toEqual({
        updateId,
        packageId: 'pkg2',
        action: PackageAction.UNINSTALL,
        forced: false,
        requiresReboot: false
      });
      
      // Check third package (forced provided, other defaults)
      expect(calls[2][0].data).toEqual({
        updateId,
        packageId: 'pkg3',
        action: PackageAction.INSTALL,
        forced: true,
        requiresReboot: false
      });
    });

    it('should test forced and requiresReboot defaults more thoroughly', async () => {
      // Arrange
      const updateId = '1';
      const packageInputs: UpdatePackageInput[] = [
        { packageId: 'pkg1', action: PackageAction.INSTALL, forced: true, requiresReboot: true },
        { packageId: 'pkg2', action: PackageAction.INSTALL, forced: false, requiresReboot: true },
        { packageId: 'pkg3', action: PackageAction.INSTALL, forced: true, requiresReboot: false },
        { packageId: 'pkg4', action: PackageAction.INSTALL, forced: false, requiresReboot: false }
      ];
      
      // Reset the mock before this test
      mockReset(mockPrisma.updatePackage.create);
      
      // Act
      await updateRepository.addPackages(updateId, packageInputs);
      
      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      
      // Verify the calls to create were made with exactly the provided values
      const calls = mockPrisma.updatePackage.create.mock.calls;
      expect(calls.length).toBe(4);
      
      // Check first package - all true
      expect(calls[0][0].data).toEqual({
        updateId,
        packageId: 'pkg1',
        action: PackageAction.INSTALL,
        forced: true,
        requiresReboot: true
      });
      
      // Check second package - forced false
      expect(calls[1][0].data).toEqual({
        updateId,
        packageId: 'pkg2',
        action: PackageAction.INSTALL,
        forced: false,
        requiresReboot: true
      });
      
      // Check third package - requiresReboot false
      expect(calls[2][0].data).toEqual({
        updateId,
        packageId: 'pkg3',
        action: PackageAction.INSTALL,
        forced: true,
        requiresReboot: false
      });
      
      // Check fourth package - both false
      expect(calls[3][0].data).toEqual({
        updateId,
        packageId: 'pkg4',
        action: PackageAction.INSTALL,
        forced: false,
        requiresReboot: false
      });
    });
  });
  
  describe('removePackage', () => {
    it('should remove a package from an update', async () => {
      // Arrange
      const updateId = '1';
      const packageId = 'pkg1';
      
      // Act
      await updateRepository.removePackage(updateId, packageId);
      
      // Assert
      expect(mockPrisma.updatePackage.delete).toHaveBeenCalledWith({
        where: {
          updateId_packageId: {
            updateId,
            packageId,
          },
        },
      });
    });
  });
  
  describe('removePackages', () => {
    it('should remove multiple packages from an update', async () => {
      // Arrange
      const updateId = '1';
      const packageIds = ['pkg1', 'pkg2', 'pkg3'];
      
      // Act
      await updateRepository.removePackages(updateId, packageIds);
      
      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      
      // Check that each package deletion was called
      for (const packageId of packageIds) {
        expect(mockPrisma.updatePackage.delete).toHaveBeenCalledWith({
          where: {
            updateId_packageId: {
              updateId,
              packageId,
            },
          },
        });
      }
      
      expect(mockPrisma.updatePackage.delete).toHaveBeenCalledTimes(packageIds.length);
    });
    
    it('should handle removing an empty array of packages', async () => {
      // Arrange
      const updateId = '1';
      const packageIds: string[] = [];
      
      // Act
      await updateRepository.removePackages(updateId, packageIds);
      
      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.updatePackage.delete).not.toHaveBeenCalled();
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
      
      it('should throw error when update is not found', async () => {
        // Arrange
        const updateId = 'non-existent';
        mockPrisma.update.findUnique.mockResolvedValue(null);
        
        // Act & Assert
        await expect(updateRepository.publishUpdate(updateId))
          .rejects.toThrow('Update not found');
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
      
      it('should throw error when update is not found', async () => {
        // Arrange
        const updateId = 'non-existent';
        mockPrisma.update.findUnique.mockResolvedValue(null);
        
        // Act & Assert
        await expect(updateRepository.testUpdate(updateId))
          .rejects.toThrow('Update not found');
      });
    });
    
    describe('deployUpdate', () => {
      it('should move a testing update to deploying', async () => {
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
        
        const deployingUpdate = {
          ...existingUpdate,
          status: UpdateStatus.DEPLOYING
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        mockPrisma.update.update.mockResolvedValue(deployingUpdate);
        
        // Act
        const result = await updateRepository.deployUpdate(updateId);
        
        // Assert
        expect(mockPrisma.update.update).toHaveBeenCalledWith({
          where: { id: updateId },
          data: { status: UpdateStatus.DEPLOYING }
        });
        expect(result.status).toBe(UpdateStatus.DEPLOYING);
      });
      
      it('should throw error when deploying a non-testing update', async () => {
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
        await expect(updateRepository.deployUpdate(updateId))
          .rejects.toThrow('Only tested updates can be deployed');
      });
      
      it('should throw error when update is not found', async () => {
        // Arrange
        const updateId = 'non-existent';
        mockPrisma.update.findUnique.mockResolvedValue(null);
        
        // Act & Assert
        await expect(updateRepository.deployUpdate(updateId))
          .rejects.toThrow('Update not found');
      });
    });
    
    describe('completeUpdate', () => {
      it('should mark a deploying update as completed', async () => {
        // Arrange
        const updateId = '1';
        const existingUpdate: Update = {
          id: updateId,
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.DEPLOYING,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const completedUpdate = {
          ...existingUpdate,
          status: UpdateStatus.COMPLETED
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        mockPrisma.update.update.mockResolvedValue(completedUpdate);
        
        // Act
        const result = await updateRepository.completeUpdate(updateId);
        
        // Assert
        expect(mockPrisma.update.update).toHaveBeenCalledWith({
          where: { id: updateId },
          data: { status: UpdateStatus.COMPLETED }
        });
        expect(result.status).toBe(UpdateStatus.COMPLETED);
      });
      
      it('should throw error when completing a non-deploying update', async () => {
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
        await expect(updateRepository.completeUpdate(updateId))
          .rejects.toThrow('Only deploying updates can be marked as completed');
      });
      
      it('should throw error when update is not found', async () => {
        // Arrange
        const updateId = 'non-existent';
        mockPrisma.update.findUnique.mockResolvedValue(null);
        
        // Act & Assert
        await expect(updateRepository.completeUpdate(updateId))
          .rejects.toThrow('Update not found');
      });
    });
    
    describe('failUpdate', () => {
      it('should mark a deploying update as failed', async () => {
        // Arrange
        const updateId = '1';
        const existingUpdate: Update = {
          id: updateId,
          name: 'Monthly Security Patch',
          version: 'v1.0.0',
          description: 'Security updates for July',
          status: UpdateStatus.DEPLOYING,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const failedUpdate = {
          ...existingUpdate,
          status: UpdateStatus.FAILED
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        mockPrisma.update.update.mockResolvedValue(failedUpdate);
        
        // Act
        const result = await updateRepository.failUpdate(updateId);
        
        // Assert
        expect(mockPrisma.update.update).toHaveBeenCalledWith({
          where: { id: updateId },
          data: { status: UpdateStatus.FAILED }
        });
        expect(result.status).toBe(UpdateStatus.FAILED);
      });
      
      it('should mark a testing update as failed', async () => {
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
        
        const failedUpdate = {
          ...existingUpdate,
          status: UpdateStatus.FAILED
        };
        
        mockPrisma.update.findUnique.mockResolvedValue(existingUpdate);
        mockPrisma.update.update.mockResolvedValue(failedUpdate);
        
        // Act
        const result = await updateRepository.failUpdate(updateId);
        
        // Assert
        expect(mockPrisma.update.update).toHaveBeenCalledWith({
          where: { id: updateId },
          data: { status: UpdateStatus.FAILED }
        });
        expect(result.status).toBe(UpdateStatus.FAILED);
      });
      
      it('should throw error when failing a non-deploying update', async () => {
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
        await expect(updateRepository.failUpdate(updateId))
          .rejects.toThrow('Only testing or deploying updates can be marked as failed');
      });
      
      it('should throw error when update is not found', async () => {
        // Arrange
        const updateId = 'non-existent';
        mockPrisma.update.findUnique.mockResolvedValue(null);
        
        // Act & Assert
        await expect(updateRepository.failUpdate(updateId))
          .rejects.toThrow('Update not found');
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
      
      it('should throw error when update is not found', async () => {
        // Arrange
        const updateId = 'non-existent';
        mockPrisma.update.findUnique.mockResolvedValue(null);
        
        // Act & Assert
        await expect(updateRepository.cancelUpdate(updateId))
          .rejects.toThrow('Update not found');
      });
    });
  });
}); 