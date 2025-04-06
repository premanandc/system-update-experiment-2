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
};

const context: TestContext = {
  devices: [],
  packages: [],
  updates: [],
  plans: [],
  executions: [],
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
      
      // Get the batches for the plan
      context.batches = await planRepository.getBatches(context.plan.id);
      
      // Verify the batch structure (2 test + 1 mass)
      expect(context.batches.length).toBe(3);
      expect(context.batches[0].type).toBe(BatchType.TEST);
      expect(context.batches[1].type).toBe(BatchType.TEST);
      expect(context.batches[2].type).toBe(BatchType.MASS);
      
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
     * And pending updates are available for other devices
     */
    test('AND pending updates are available for other devices', async () => {
      if (!context.otherDeviceId) {
        console.log('No other device ID found, skipping this test');
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
      
      console.log('Full update workflow test completed successfully');
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
    
    console.log('Cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
} 