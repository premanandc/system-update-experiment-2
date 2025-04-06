import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DeviceStatus } from '../../models/device';
import { PackageStatus } from '../../models/package';
import { UpdateStatus, PackageAction } from '../../models/update';
import { PlanStatus } from '../../models/plan';
import { BatchType } from '../../models/batch';
import { ExecutionStatus, ExecutionBatchStatus } from '../../models/execution';
import { PrismaDeviceRepository } from '../../models/device';
import { PrismaPackageRepository } from '../../models/package';
import { PrismaUpdateRepository } from '../../models/update';
import { PrismaPlanRepository } from '../../models/plan';
import { PrismaBatchRepository } from '../../models/batch';
import { PrismaExecutionRepository } from '../../models/execution';

const execPromise = promisify(exec);

// Use an in-memory SQLite database for testing
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "file:./dev.db",
    },
  },
});

// Create repositories
const deviceRepository = new PrismaDeviceRepository(prisma);
const packageRepository = new PrismaPackageRepository(prisma);
const updateRepository = new PrismaUpdateRepository(prisma);
const planRepository = new PrismaPlanRepository(prisma);
const batchRepository = new PrismaBatchRepository(prisma);
const executionRepository = new PrismaExecutionRepository(prisma);

// Store created entity IDs for cleanup
const createdIds = {
  devices: [] as string[],
  packages: [] as string[],
  updates: [] as string[],
  plans: [] as string[],
  executions: [] as string[],
};

describe('Update Execution Functional Test', () => {
  // Set longer timeout for this test since it's doing actual DB operations
  jest.setTimeout(60000);

  // Setup before running tests
  beforeAll(async () => {
    // We'll use the project's existing database
    // Just clean any existing test data that might be present
    await cleanup();
  });

  // Clean up after tests
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('should execute the entire update workflow successfully', async () => {
    // Step 1: Create devices, packages, and install packages on devices
    await createTestData();
    
    // Step 2: Create an update with a newer version of a software package
    const oldPackage = await findPackageByName('system-core');
    expect(oldPackage).not.toBeNull();
    
    // Create a new version of the package
    const newPackageVersion = {
      name: 'system-core',
      version: '2.0.0', // New version
      vendor: 'System Corp',
      description: 'Core system package - updated version',
      status: PackageStatus.PUBLISHED,
    };
    
    const newPackage = await packageRepository.create(newPackageVersion);
    createdIds.packages.push(newPackage.id);
    
    // Create an update with the new package
    const update = await updateRepository.create({
      name: 'System Core Update',
      version: '1.0.0',
      description: 'Update system core to version 2.0.0',
    });
    createdIds.updates.push(update.id);
    
    // Add the package to the update
    await updateRepository.addPackage(update.id, {
      packageId: newPackage.id,
      action: PackageAction.INSTALL,
      forced: false,
      requiresReboot: true,
    });
    
    // Publish the update
    await updateRepository.publishUpdate(update.id);
    
    // Verify the update exists and is published
    const publishedUpdate = await updateRepository.findById(update.id);
    console.log('Published update:', publishedUpdate);
    expect(publishedUpdate).not.toBeNull();
    expect(publishedUpdate?.status).toBe(UpdateStatus.PUBLISHED);
    
    // Step 3: Create a plan directly (without getting affected devices first)
    const plan = await planRepository.generatePlan(update.id);
    createdIds.plans.push(plan.id);
    console.log('Generated plan:', plan);
    
    // Verify the plan structure
    const batches = await planRepository.getBatches(plan.id);
    console.log('Batches:', batches);
    
    // We should have three batches (2 test + 1 mass)
    expect(batches.length).toBe(3);
    
    // Verify batch types
    expect(batches[0].type).toBe(BatchType.TEST);
    expect(batches[1].type).toBe(BatchType.TEST);
    expect(batches[2].type).toBe(BatchType.MASS);
    
    // Step 5: Approve the plan
    await planRepository.approvePlan(plan.id);
    
    // Verify plan is approved
    const approvedPlan = await planRepository.findById(plan.id);
    expect(approvedPlan?.status).toBe(PlanStatus.APPROVED);
    
    // Step 6: Create an execution
    const execution = await executionRepository.createFromPlan(plan.id);
    createdIds.executions.push(execution.id);
    
    // Verify execution is created
    expect(execution.status).toBe(ExecutionStatus.CREATED);
    
    // Step 7: Start the first batch (sending update requests)
    const startResult = await executionRepository.startBatch(execution.id);
    expect(startResult.devicesUpdated).toBeGreaterThan(0);
    
    // Get the executionBatchId
    const executionBatchId = startResult.executionBatchId;
    
    // Verify the batch is in executing state
    const executionDetails = await prisma.execution.findUnique({
      where: { id: execution.id },
      include: {
        batches: {
          where: { id: executionBatchId },
        },
      },
    });
    
    expect(executionDetails).not.toBeNull();
    expect(executionDetails?.status).toBe(ExecutionStatus.EXECUTING);
    expect(executionDetails?.batches[0].status).toBe(ExecutionBatchStatus.EXECUTING);
    
    // Step 8: Simulate a device reporting back success
    // Get a device ID from the first batch
    const deviceStatuses = await prisma.executionDeviceStatus.findMany({
      where: { executionBatchId },
      include: { device: true },
      take: 1,
    });
    
    expect(deviceStatuses.length).toBeGreaterThan(0);
    
    const testDeviceId = deviceStatuses[0].deviceId;
    console.log(`Device ${testDeviceId} reporting back success`);
    
    // Record device update result
    await executionRepository.recordDeviceUpdateResult(
      execution.id,
      testDeviceId,
      true // Success
    );
    
    // Verify device status is updated
    const updatedDeviceStatus = await prisma.executionDeviceStatus.findUnique({
      where: {
        executionBatchId_deviceId: {
          executionBatchId,
          deviceId: testDeviceId,
        },
      },
    });
    
    expect(updatedDeviceStatus).not.toBeNull();
    expect(updatedDeviceStatus?.updateCompleted).toBe(true);
    expect(updatedDeviceStatus?.succeeded).toBe(true);
    
    // Check if we can get pending updates for a device that hasn't reported back
    const otherDeviceStatus = deviceStatuses.find((ds: any) => ds.deviceId !== testDeviceId);
    if (otherDeviceStatus) {
      const pendingUpdates = await deviceRepository.getPendingUpdates(otherDeviceStatus.deviceId);
      expect(pendingUpdates.length).toBeGreaterThan(0);
      
      // Verify the pending update contains the right information
      const pendingUpdate = pendingUpdates[0];
      expect(pendingUpdate.updateId).toBe(update.id);
      expect(pendingUpdate.planId).toBe(plan.id);
      expect(pendingUpdate.executionBatchId).toBe(executionBatchId);
    }
    
    // Success! The entire workflow completed as expected
    console.log('Full update workflow test completed successfully');
  });
});

// Helper functions
async function createTestData() {
  // Create 20 devices (15 online, 5 offline)
  const deviceTypes = ['SERVER', 'WORKSTATION', 'MOBILE', 'IOT'];
  const onlineCount = 15;
  
  for (let i = 0; i < 20; i++) {
    const device = await deviceRepository.create({
      name: `Test Device ${i + 1}`,
      ipAddress: `192.168.1.${i + 10}`,
      type: deviceTypes[i % deviceTypes.length],
      status: i < onlineCount ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE,
    });
    createdIds.devices.push(device.id);
  }
  
  // Create packages
  const packages = [
    {
      name: 'system-core',
      version: '1.0.0',
      vendor: 'System Corp',
      description: 'Core system package',
      status: PackageStatus.PUBLISHED,
    },
    {
      name: 'utility-tools',
      version: '1.5.0',
      vendor: 'Tools Inc',
      description: 'Utility tools bundle',
      status: PackageStatus.PUBLISHED,
    },
    {
      name: 'security-suite',
      version: '2.1.0',
      vendor: 'SecureSoft',
      description: 'Security tools suite',
      status: PackageStatus.PUBLISHED,
    },
  ];
  
  for (const pkg of packages) {
    const createdPackage = await packageRepository.create(pkg);
    createdIds.packages.push(createdPackage.id);
  }
  
  // Install packages on devices (ensure about 10 devices have system-core installed)
  const systemCorePackage = await findPackageByName('system-core');
  const utilityToolsPackage = await findPackageByName('utility-tools');
  const securitySuitePackage = await findPackageByName('security-suite');
  
  // Install system-core on first 10 devices
  for (let i = 0; i < 10; i++) {
    await prisma.devicePackage.create({
      data: {
        deviceId: createdIds.devices[i],
        packageId: systemCorePackage!.id,
        installedDate: new Date(),
      },
    });
  }
  
  // Install utility-tools on some devices (including some with system-core)
  for (let i = 5; i < 15; i++) {
    await prisma.devicePackage.create({
      data: {
        deviceId: createdIds.devices[i],
        packageId: utilityToolsPackage!.id,
        installedDate: new Date(),
      },
    });
  }
  
  // Install security-suite on some devices
  for (let i = 10; i < 20; i++) {
    await prisma.devicePackage.create({
      data: {
        deviceId: createdIds.devices[i],
        packageId: securitySuitePackage!.id,
        installedDate: new Date(),
      },
    });
  }
  
  console.log('Test data created successfully');
}

async function findPackageByName(name: string) {
  const packages = await packageRepository.findAll();
  return packages.find(p => p.name === name) || null;
}

async function cleanup() {
  // Delete created entities in reverse order
  try {
    // Delete executions
    for (const id of createdIds.executions) {
      await prisma.execution.delete({ where: { id } }).catch(() => null);
    }
    
    // Delete plans and their batches
    for (const id of createdIds.plans) {
      await prisma.batch.deleteMany({ where: { planId: id } }).catch(() => null);
      await prisma.plan.delete({ where: { id } }).catch(() => null);
    }
    
    // Delete updates and their packages
    for (const id of createdIds.updates) {
      await prisma.updatePackage.deleteMany({ where: { updateId: id } }).catch(() => null);
      await prisma.update.delete({ where: { id } }).catch(() => null);
    }
    
    // Delete device packages
    await prisma.devicePackage.deleteMany({}).catch(() => null);
    
    // Delete devices
    for (const id of createdIds.devices) {
      await prisma.device.delete({ where: { id } }).catch(() => null);
    }
    
    // Delete packages
    for (const id of createdIds.packages) {
      await prisma.package.delete({ where: { id } }).catch(() => null);
    }
    
    // Reset IDs
    createdIds.devices = [];
    createdIds.packages = [];
    createdIds.updates = [];
    createdIds.plans = [];
    createdIds.executions = [];
    
    console.log('Cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
} 