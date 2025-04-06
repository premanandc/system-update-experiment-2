import { PrismaClient } from '@prisma/client';
import { Device, DeviceCreateInput, DeviceStatus, PrismaDeviceRepository } from '../../models/device';
import { mockDeep, mockReset } from 'jest-mock-extended';

// Mock PrismaClient
const mockPrisma = mockDeep<PrismaClient>();

// Create an instance of the DeviceRepository with the mocked PrismaClient
const deviceRepository = new PrismaDeviceRepository(mockPrisma);

// Reset mocks before each test
beforeEach(() => {
  mockReset(mockPrisma);
});

describe('DeviceRepository', () => {
  describe('create', () => {
    it('should create a new device', async () => {
      // Arrange
      const deviceData: DeviceCreateInput = {
        name: 'Test Device',
        ipAddress: '192.168.1.1',
        type: 'SERVER',
      };
      
      const expectedDevice: Device = {
        id: '1',
        name: 'Test Device',
        ipAddress: '192.168.1.1',
        type: 'SERVER',
        status: DeviceStatus.ONLINE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.device.create.mockResolvedValue(expectedDevice);
      
      // Act
      const result = await deviceRepository.create(deviceData);
      
      // Assert
      expect(mockPrisma.device.create).toHaveBeenCalledWith({
        data: deviceData,
      });
      expect(result).toEqual(expectedDevice);
    });
  });
  
  describe('findById', () => {
    it('should find a device by its ID', async () => {
      // Arrange
      const deviceId = '1';
      const expectedDevice: Device = {
        id: deviceId,
        name: 'Test Device',
        ipAddress: '192.168.1.1',
        type: 'SERVER',
        status: DeviceStatus.ONLINE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.device.findUnique.mockResolvedValue(expectedDevice);
      
      // Act
      const result = await deviceRepository.findById(deviceId);
      
      // Assert
      expect(mockPrisma.device.findUnique).toHaveBeenCalledWith({
        where: { id: deviceId },
      });
      expect(result).toEqual(expectedDevice);
    });
    
    it('should return null when device is not found', async () => {
      // Arrange
      const deviceId = 'non-existent-id';
      mockPrisma.device.findUnique.mockResolvedValue(null);
      
      // Act
      const result = await deviceRepository.findById(deviceId);
      
      // Assert
      expect(mockPrisma.device.findUnique).toHaveBeenCalledWith({
        where: { id: deviceId },
      });
      expect(result).toBeNull();
    });
  });
  
  describe('findByStatus', () => {
    it('should find devices by status', async () => {
      // Arrange
      const status = DeviceStatus.ONLINE;
      const expectedDevices: Device[] = [
        {
          id: '1',
          name: 'Device 1',
          ipAddress: '192.168.1.1',
          type: 'SERVER',
          status: DeviceStatus.ONLINE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Device 2',
          ipAddress: '192.168.1.2',
          type: 'SERVER',
          status: DeviceStatus.ONLINE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrisma.device.findMany.mockResolvedValue(expectedDevices);
      
      // Act
      const result = await deviceRepository.findByStatus(status);
      
      // Assert
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({
        where: { status },
      });
      expect(result).toEqual(expectedDevices);
    });
  });
  
  describe('update', () => {
    it('should update a device', async () => {
      // Arrange
      const deviceId = '1';
      const updateData = {
        name: 'Updated Device',
        ipAddress: '192.168.1.100',
      };
      const expectedDevice: Device = {
        id: deviceId,
        name: 'Updated Device',
        ipAddress: '192.168.1.100',
        type: 'SERVER',
        status: DeviceStatus.ONLINE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.device.update.mockResolvedValue(expectedDevice);
      
      // Act
      const result = await deviceRepository.update(deviceId, updateData);
      
      // Assert
      expect(mockPrisma.device.update).toHaveBeenCalledWith({
        where: { id: deviceId },
        data: updateData,
      });
      expect(result).toEqual(expectedDevice);
    });
  });
  
  describe('setStatus', () => {
    it('should set a device status', async () => {
      // Arrange
      const deviceId = '1';
      const status = DeviceStatus.MAINTENANCE;
      const expectedDevice: Device = {
        id: deviceId,
        name: 'Test Device',
        ipAddress: '192.168.1.1',
        type: 'SERVER',
        status: DeviceStatus.MAINTENANCE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.device.update.mockResolvedValue(expectedDevice);
      
      // Act
      const result = await deviceRepository.setStatus(deviceId, status);
      
      // Assert
      expect(mockPrisma.device.update).toHaveBeenCalledWith({
        where: { id: deviceId },
        data: { status },
      });
      expect(result).toEqual(expectedDevice);
    });
  });
  
  describe('delete', () => {
    it('should delete a device', async () => {
      // Arrange
      const deviceId = '1';
      const expectedDevice: Device = {
        id: deviceId,
        name: 'Test Device',
        ipAddress: '192.168.1.1',
        type: 'SERVER',
        status: DeviceStatus.ONLINE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.device.delete.mockResolvedValue(expectedDevice);
      
      // Act
      const result = await deviceRepository.delete(deviceId);
      
      // Assert
      expect(mockPrisma.device.delete).toHaveBeenCalledWith({
        where: { id: deviceId },
      });
      expect(result).toEqual(expectedDevice);
    });
  });
}); 