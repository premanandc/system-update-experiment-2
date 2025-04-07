import { PrismaClient } from '@prisma/client';
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

/**
 * Feature: System Update Workflow
 * 
 * This test follows the entire update workflow from creating an update
 * to executing it on devices and verifying the results.
 */

// Use the project's database
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

// Context to share data between test steps
type TestContext = {
  devices: string[];
  packages: string[];
  updates: string[];
  plans: string[];
  executions: string[];
  currentUpdate?: { id: string; name: string };
  oldPackage?: any;
  newPackage?: any;
  plan?: any;
  batches?: any[];
  execution?: any;
  executionBatchId?: string;
  testDeviceId?: string;
  otherDeviceId?: string;
  allDevicesInBatch?: string[];
  currentBatchIndex: number;
};

const context: TestContext = {
  devices: [],
  packages: [],
  updates: [],
  plans: [],
  executions: [],
  currentBatchIndex: 0,
};

describe('Update Execution Workflow', () => {
  // Set longer timeout for this test since it's doing actual DB operations
  jest.setTimeout(60000);

  beforeAll(async () => {
    await cleanup(); // Clean up any existing test data
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  /**
   * Scenario: Execute a complete system update workflow
   */
  describe('Scenario: Execute a complete system update workflow', () => {
    /**
     * Given a system with devices and installed packages
     */
    test('GIVEN a system with devices and installed packages', async () => {
      // Create test devices (15 online, 5 offline)
      await given_multiple_devices_in_different_states();

      // Create packages and install them on devices
      await given_published_packages_installed_on_devices();

      // Verify the test data
      const allDevices = await deviceRepository.findAll();
      expect(allDevices.length).toBeGreaterThanOrEqual(context.devices.length);
      
      const allPackages = await packageRepository.findAll();
      expect(allPackages.length).toBeGreaterThanOrEqual(context.packages.length);
      
      // Verify system-core is installed on devices
      const firstDeviceId = context.devices[0];
      const installedPackages = await prisma.devicePackage.findMany({
        where: { deviceId: firstDeviceId },
      });
      expect(installedPackages.length).toBeGreaterThan(0);
    });

    /**
     * When a new update package is created and published
     */
    test('WHEN a new update package is created and published', async () => {
      // Find the existing package we want to update
      context.oldPackage = await findPackageByName('system-core');
      expect(context.oldPackage).not.toBeNull();
      
      // Create a new version of the package
      await when_a_new_package_version_is_created();
      expect(context.newPackage).not.toBeNull();
      expect(context.newPackage?.version).toBe('2.0.0');
      
      // Create an update with the new package
      await when_an_update_is_created_with_the_new_package();
      expect(context.currentUpdate).not.toBeNull();
      
      // Publish the update
      await when_the_update_is_published();
      
      // Verify the update is published
      const publishedUpdate = await updateRepository.findById(context.currentUpdate!.id);
      expect(publishedUpdate?.status).toBe(UpdateStatus.PUBLISHED);
    });

    /**
     * And an update plan is generated and approved
     */
    test('AND an update plan is generated and approved', async () => {
      // Generate a plan for the update
      await when_an_update_plan_is_generated();
      expect(context.plan).not.toBeNull();
      
      // Get the batches for the plan using batchRepository
      const batches = await batchRepository.findByPlanId(context.plan.id);
      context.batches = batches;
      
      // Verify the batch structure (2 test + 1 mass)
      expect(context.batches.length).toBe(3);
      expect(context.batches[0].type).toBe(BatchType.TEST);
      expect(context.batches[1].type).toBe(BatchType.TEST);
      expect(context.batches[2].type).toBe(BatchType.MASS);
      
      // Verify the first test batch using batchRepository.findById
      const firstBatch = await batchRepository.findById(context.batches[0].id);
      expect(firstBatch).not.toBeNull();
      expect(firstBatch?.name).toContain('Test Batch');
      expect(firstBatch?.sequence).toBe(1);
      
      // Approve the plan
      await when_the_plan_is_approved();
      
      // Verify the plan is approved
      const approvedPlan = await planRepository.findById(context.plan.id);
      expect(approvedPlan?.status).toBe(PlanStatus.APPROVED);
    });

    /**
     * And an execution of the plan is started
     */
    test('AND an execution of the plan is started', async () => {
      // Create an execution from the plan
      await when_an_execution_is_created_from_the_plan();
      expect(context.execution).not.toBeNull();
      expect(context.execution.status).toBe(ExecutionStatus.CREATED);
      
      // Start the first batch
      await when_the_first_batch_is_started();
      expect(context.executionBatchId).not.toBeNull();
      
      // Verify the execution and batch status
      const executionDetails = await prisma.execution.findUnique({
        where: { id: context.execution.id },
        include: {
          batches: {
            where: { id: context.executionBatchId },
          },
        },
      });
      
      expect(executionDetails?.status).toBe(ExecutionStatus.EXECUTING);
      expect(executionDetails?.batches[0].status).toBe(ExecutionBatchStatus.EXECUTING);
    });

    /**
     * Then devices are updated and report back success
     */
    test('THEN devices are updated and report back success', async () => {
      // Get devices in the batch
      const deviceStatuses = await prisma.executionDeviceStatus.findMany({
        where: { executionBatchId: context.executionBatchId },
        include: { device: true },
      });
      
      expect(deviceStatuses.length).toBeGreaterThan(0);
      
      // Get a test device
      context.testDeviceId = deviceStatuses[0].deviceId;
      if (deviceStatuses.length > 1) {
        context.otherDeviceId = deviceStatuses[1].deviceId;
      }
      
      // Store all devices in this batch
      context.allDevicesInBatch = deviceStatuses.map((status: any) => status.deviceId);
      
      // Simulate device reporting back success
      await then_a_device_reports_update_success();
      
      // Verify device status is updated
      const updatedDeviceStatus = await prisma.executionDeviceStatus.findUnique({
        where: {
          executionBatchId_deviceId: {
            executionBatchId: context.executionBatchId!,
            deviceId: context.testDeviceId!,
          },
        },
      });
      
      expect(updatedDeviceStatus?.updateCompleted).toBe(true);
      expect(updatedDeviceStatus?.succeeded).toBe(true);
    });

    /**
     * And all devices in the batch complete successfully
     */
    test('AND all devices in the batch complete successfully', async () => {
      if (!context.allDevicesInBatch || context.allDevicesInBatch.length === 0) {
        // No devices in batch, skip this test
        return;
      }
      
      // Update all remaining devices to report success
      await then_all_devices_in_batch_report_success();
      
      // Check if batch is completed
      const batchCompletionResult = await executionRepository.checkBatchCompletion(
        context.executionBatchId!
      );
      
      expect(batchCompletionResult.isComplete).toBe(true);
      expect(batchCompletionResult.result).toBe('SUCCESSFUL');
      
      // Verify batch is now marked as completed
      const executionBatch = await prisma.executionBatch.findUnique({
        where: { id: context.executionBatchId! },
      });
      
      expect(executionBatch?.status).toBe(ExecutionBatchStatus.COMPLETED);
      expect(executionBatch?.result).toBe('SUCCESSFUL');
    });
    
    /**
     * And the next batch is started and completed
     */
    test('AND the next batch is started and completed', async () => {
      context.currentBatchIndex++;
      
      // Get all batches for this execution
      const allBatches = await prisma.executionBatch.findMany({
        where: { executionId: context.execution.id },
        orderBy: { sequence: 'asc' },
      });
      
      if (context.currentBatchIndex >= allBatches.length) {
        // No more batches to execute, skip this test
        return;
      }
      
      // Start the next batch
      const startNextResult = await executionRepository.startNextBatch(
        context.executionBatchId!
      );
      
      expect(startNextResult).not.toBeNull();
      
      // Update the current execution batch ID
      context.executionBatchId = startNextResult!.executionBatchId;
      
      // Get the batch info using executionBatch data
      const executionBatch = await prisma.executionBatch.findUnique({
        where: { id: context.executionBatchId },
      });
      
      // Use batchRepository to get batch details
      const batchDetails = await batchRepository.findById(executionBatch!.batchId);
      expect(batchDetails).not.toBeNull();
      expect(batchDetails?.sequence).toBe(context.currentBatchIndex + 1);
      
      // Use batchRepository to get devices in the batch
      const batchDevices = await batchRepository.getDevices(executionBatch!.batchId);
      expect(batchDevices.length).toBeGreaterThan(0);
      
      // Get devices in this batch
      const deviceStatuses = await prisma.executionDeviceStatus.findMany({
        where: { executionBatchId: context.executionBatchId },
      });
      
      context.allDevicesInBatch = deviceStatuses.map((status: any) => status.deviceId);
      
      // Complete all devices in this batch
      await then_all_devices_in_batch_report_success();
      
      // Check batch completion
      const batchCompletionResult = await executionRepository.checkBatchCompletion(
        context.executionBatchId!
      );
      
      expect(batchCompletionResult.isComplete).toBe(true);
    });
    
    /**
     * And all remaining batches are completed
     */
    test('AND all remaining batches are completed', async () => {
      // Get all batches for this execution
      const allBatches = await prisma.executionBatch.findMany({
        where: { executionId: context.execution.id },
        orderBy: { sequence: 'asc' },
      });
      
      // Process each remaining batch
      for (let i = context.currentBatchIndex + 1; i < allBatches.length; i++) {
        // Start the next batch
        const startNextResult = await executionRepository.startNextBatch(
          context.executionBatchId!
        );
        
        if (!startNextResult) {
          // No more batches to start after this one
          return;
        }
        
        // Update current batch ID
        context.executionBatchId = startNextResult.executionBatchId;
        
        // Get devices in this batch
        const deviceStatuses = await prisma.executionDeviceStatus.findMany({
          where: { executionBatchId: context.executionBatchId },
        });
        
        context.allDevicesInBatch = deviceStatuses.map((status: any) => status.deviceId);
        
        // Complete all devices in this batch
        if (context.allDevicesInBatch && context.allDevicesInBatch.length > 0) {
          await then_all_devices_in_batch_report_success();
          
          // Check batch completion
          const batchCompletionResult = await executionRepository.checkBatchCompletion(
            context.executionBatchId!
          );
          
          expect(batchCompletionResult.isComplete).toBe(true);
        }
      }
      
      // Verify all batches are completed using batchRepository
      for (const batch of context.batches || []) {
        // Get the execution batch for this batch
        const executionBatch = await prisma.executionBatch.findFirst({
          where: { 
            executionId: context.execution.id,
            batchId: batch.id
          }
        });
        
        expect(executionBatch).not.toBeNull();
        expect(executionBatch?.status).toBe(ExecutionBatchStatus.COMPLETED);
      }
      
      // Check if all batches are completed
      const pendingBatches = await prisma.executionBatch.findMany({
        where: { 
          executionId: context.execution.id,
          status: { not: ExecutionBatchStatus.COMPLETED },
        },
      });
      
      expect(pendingBatches.length).toBe(0);
    });
    
    /**
     * And the execution is completed successfully
     */
    test('AND the execution is completed successfully', async () => {
      // Complete the execution
      const result = await executionRepository.completeExecution(context.execution.id);
      expect(result).toBe(true);
      
      // Verify execution status
      const executionDetails = await prisma.execution.findUnique({
        where: { id: context.execution.id },
      });
      
      expect(executionDetails?.status).toBe(ExecutionStatus.COMPLETED);
    });

    /**
     * And pending updates are available for other devices
     */
    test('AND pending updates are available for other devices', async () => {
      if (!context.otherDeviceId) {
        // No other device ID found, skip this test
        return;
      }
      
      // Check for pending updates on other device
      const pendingUpdates = await deviceRepository.getPendingUpdates(context.otherDeviceId);
      expect(pendingUpdates.length).toBeGreaterThan(0);
      
      // Verify pending update contains the correct information
      const pendingUpdate = pendingUpdates[0];
      expect(pendingUpdate.updateId).toBe(context.currentUpdate!.id);
      expect(pendingUpdate.planId).toBe(context.plan.id);
      expect(pendingUpdate.executionBatchId).toBe(context.executionBatchId);
    });
  });
});

// Step implementations
async function given_multiple_devices_in_different_states() {
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
    context.devices.push(device.id);
  }
}

async function given_published_packages_installed_on_devices() {
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
    context.packages.push(createdPackage.id);
  }
  
  // Install packages on devices
  const systemCorePackage = await findPackageByName('system-core');
  const utilityToolsPackage = await findPackageByName('utility-tools');
  const securitySuitePackage = await findPackageByName('security-suite');
  
  // Install system-core on first 10 devices
  for (let i = 0; i < 10; i++) {
    await prisma.devicePackage.create({
      data: {
        deviceId: context.devices[i],
        packageId: systemCorePackage!.id,
        installedDate: new Date(),
      },
    });
  }
  
  // Install utility-tools on some devices (including some with system-core)
  for (let i = 5; i < 15; i++) {
    await prisma.devicePackage.create({
      data: {
        deviceId: context.devices[i],
        packageId: utilityToolsPackage!.id,
        installedDate: new Date(),
      },
    });
  }
  
  // Install security-suite on some devices
  for (let i = 10; i < 20; i++) {
    await prisma.devicePackage.create({
      data: {
        deviceId: context.devices[i],
        packageId: securitySuitePackage!.id,
        installedDate: new Date(),
      },
    });
  }
}

async function when_a_new_package_version_is_created() {
  // Create a new version of the system-core package
  const newPackageVersion = {
    name: 'system-core',
    version: '2.0.0', // New version
    vendor: 'System Corp',
    description: 'Core system package - updated version',
    status: PackageStatus.PUBLISHED,
  };
  
  context.newPackage = await packageRepository.create(newPackageVersion);
  context.packages.push(context.newPackage.id);
}

async function when_an_update_is_created_with_the_new_package() {
  // Create an update with the new package
  const update = await updateRepository.create({
    name: 'System Core Update',
    version: '1.0.0',
    description: 'Update system core to version 2.0.0',
  });
  
  context.currentUpdate = { id: update.id, name: update.name };
  context.updates.push(update.id);
  
  // Add the package to the update
  await updateRepository.addPackage(update.id, {
    packageId: context.newPackage.id,
    action: PackageAction.INSTALL,
    forced: false,
    requiresReboot: true,
  });
}

async function when_the_update_is_published() {
  // Publish the update
  await updateRepository.publishUpdate(context.currentUpdate!.id);
}

async function when_an_update_plan_is_generated() {
  // Generate a plan for the update
  context.plan = await planRepository.generatePlan(context.currentUpdate!.id);
  context.plans.push(context.plan.id);
}

async function when_the_plan_is_approved() {
  // Approve the plan
  await planRepository.approvePlan(context.plan.id);
}

async function when_an_execution_is_created_from_the_plan() {
  // Create an execution from the plan
  context.execution = await executionRepository.createFromPlan(context.plan.id);
  context.executions.push(context.execution.id);
}

async function when_the_first_batch_is_started() {
  // Start the first batch
  const startResult = await executionRepository.startBatch(context.execution.id);
  context.executionBatchId = startResult.executionBatchId;
}

async function then_a_device_reports_update_success() {
  // Simulate device reporting update success
  await executionRepository.recordDeviceUpdateResult(
    context.execution.id,
    context.testDeviceId!,
    true // Success
  );
}

async function then_all_devices_in_batch_report_success() {
  // Skip the first device as it's already been processed
  if (!context.allDevicesInBatch) {
    // No devices found in batch
    return;
  }
  
  const devicesToUpdate = context.allDevicesInBatch.filter(id => id !== context.testDeviceId);
  
  // Have each device report success
  for (const deviceId of devicesToUpdate) {
    await executionRepository.recordDeviceUpdateResult(
      context.execution.id,
      deviceId,
      true // Success
    );
  }
}

// Helper functions
async function findPackageByName(name: string) {
  const packages = await packageRepository.findAll();
  return packages.find(p => p.name === name) || null;
}

async function cleanup() {
  try {
    // Delete created entities in reverse order of creation
    
    // Delete executions
    for (const id of context.executions) {
      await prisma.execution.delete({ where: { id } }).catch(() => null);
    }
    
    // Delete plans and their batches
    for (const id of context.plans) {
      await prisma.batch.deleteMany({ where: { planId: id } }).catch(() => null);
      await prisma.plan.delete({ where: { id } }).catch(() => null);
    }
    
    // Delete updates and their packages
    for (const id of context.updates) {
      await prisma.updatePackage.deleteMany({ where: { updateId: id } }).catch(() => null);
      await prisma.update.delete({ where: { id } }).catch(() => null);
    }
    
    // Delete device packages
    await prisma.devicePackage.deleteMany({}).catch(() => null);
    
    // Delete devices
    for (const id of context.devices) {
      await prisma.device.delete({ where: { id } }).catch(() => null);
    }
    
    // Delete packages
    for (const id of context.packages) {
      await prisma.package.delete({ where: { id } }).catch(() => null);
    }
    
    // Reset context
    context.devices = [];
    context.packages = [];
    context.updates = [];
    context.plans = [];
    context.executions = [];
    context.currentUpdate = undefined;
    context.oldPackage = undefined;
    context.newPackage = undefined;
    context.plan = undefined;
    context.batches = undefined;
    context.execution = undefined;
    context.executionBatchId = undefined;
    context.testDeviceId = undefined;
    context.otherDeviceId = undefined;
    context.allDevicesInBatch = undefined;
    context.currentBatchIndex = 0;
  } catch (error) {
    // Error during cleanup - can be ignored as this is just test cleanup
  }
} 