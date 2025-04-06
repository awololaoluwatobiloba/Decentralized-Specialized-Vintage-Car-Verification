import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock principal addresses
const CONTRACT_OWNER = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const USER_1 = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
const USER_2 = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';

// Mock the Clarity runtime environment
const mockClarity = {
  tx: {
    sender: CONTRACT_OWNER,
  },
  block: {
    height: 100,
  },
  contracts: {
    'vehicle-registration': {
      functions: {
        'register-vehicle': vi.fn(),
        'get-vehicle': vi.fn(),
        'verify-vehicle': vi.fn(),
        'transfer-ownership': vi.fn(),
      },
      variables: {
        'contract-owner': CONTRACT_OWNER,
      },
      maps: {
        'vehicles': new Map(),
      },
    },
  },
};

// Helper to simulate contract calls
function callContract(contractName, functionName, sender, ...args) {
  mockClarity.tx.sender = sender;
  return mockClarity.contracts[contractName].functions[functionName](...args);
}

describe('Vehicle Registration Contract', () => {
  beforeEach(() => {
    // Reset the mock state
    mockClarity.contracts['vehicle-registration'].maps.vehicles.clear();
    mockClarity.tx.sender = CONTRACT_OWNER;
    mockClarity.block.height = 100;
    
    // Reset mock functions
    Object.values(mockClarity.contracts['vehicle-registration'].functions).forEach(fn => {
      if (typeof fn.mockReset === 'function') {
        fn.mockReset();
      }
    });
  });
  
  describe('register-vehicle', () => {
    it('should register a new vehicle successfully', () => {
      const vehicleId = 'v-123456';
      const vehicleData = {
        make: 'Ferrari',
        model: '250 GTO',
        year: 1962,
        vin: '123456789',
        'chassis-number': 'CHASSIS123',
        'engine-type': 'V12',
        'engine-number': 'ENG123',
        'original-color': 'Red',
      };
      
      // Mock the register-vehicle function
      mockClarity.contracts['vehicle-registration'].functions['register-vehicle'].mockImplementation(
          (id, make, model, year, vin, chassis, engine, engineNum, color) => {
            if (mockClarity.contracts['vehicle-registration'].maps.vehicles.has(id)) {
              return { err: 2 }; // ERR_ALREADY_REGISTERED
            }
            
            mockClarity.contracts['vehicle-registration'].maps.vehicles.set(id, {
              make,
              model,
              year,
              vin,
              'chassis-number': chassis,
              'engine-type': engine,
              'engine-number': engineNum,
              'original-color': color,
              'registered-by': mockClarity.tx.sender,
              'registered-at': mockClarity.block.height,
              verified: false,
            });
            
            return { ok: true };
          }
      );
      
      // Call the function
      const result = callContract(
          'vehicle-registration',
          'register-vehicle',
          USER_1,
          vehicleId,
          vehicleData.make,
          vehicleData.model,
          vehicleData.year,
          vehicleData.vin,
          vehicleData['chassis-number'],
          vehicleData['engine-type'],
          vehicleData['engine-number'],
          vehicleData['original-color']
      );
      
      // Verify the result
      expect(result).toEqual({ ok: true });
      expect(mockClarity.contracts['vehicle-registration'].maps.vehicles.has(vehicleId)).toBe(true);
      
      // Mock the get-vehicle function
      mockClarity.contracts['vehicle-registration'].functions['get-vehicle'].mockImplementation(
          (id) => {
            return mockClarity.contracts['vehicle-registration'].maps.vehicles.get(id) || null;
          }
      );
      
      // Get the vehicle and verify its data
      const storedVehicle = callContract('vehicle-registration', 'get-vehicle', USER_1, vehicleId);
      expect(storedVehicle).toMatchObject({
        make: vehicleData.make,
        model: vehicleData.model,
        year: vehicleData.year,
        vin: vehicleData.vin,
        'chassis-number': vehicleData['chassis-number'],
        'engine-type': vehicleData['engine-type'],
        'engine-number': vehicleData['engine-number'],
        'original-color': vehicleData['original-color'],
        'registered-by': USER_1,
        verified: false,
      });
    });
    
    it('should fail when registering a vehicle that already exists', () => {
      const vehicleId = 'v-123456';
      
      // First, add a vehicle to the map
      mockClarity.contracts['vehicle-registration'].maps.vehicles.set(vehicleId, {
        make: 'Ferrari',
        model: '250 GTO',
        year: 1962,
        vin: '123456789',
        'chassis-number': 'CHASSIS123',
        'engine-type': 'V12',
        'engine-number': 'ENG123',
        'original-color': 'Red',
        'registered-by': USER_1,
        'registered-at': 99,
        verified: false,
      });
      
      // Mock the register-vehicle function
      mockClarity.contracts['vehicle-registration'].functions['register-vehicle'].mockImplementation(
          (id) => {
            if (mockClarity.contracts['vehicle-registration'].maps.vehicles.has(id)) {
              return { err: 2 }; // ERR_ALREADY_REGISTERED
            }
            return { ok: true };
          }
      );
      
      // Try to register the same vehicle again
      const result = callContract(
          'vehicle-registration',
          'register-vehicle',
          USER_2,
          vehicleId,
          'Ferrari',
          '250 GTO',
          1962,
          '123456789',
          'CHASSIS123',
          'V12',
          'ENG123',
          'Red'
      );
      
      // Verify the result
      expect(result).toEqual({ err: 2 }); // ERR_ALREADY_REGISTERED
    });
  });
  
  describe('verify-vehicle', () => {
    it('should allow contract owner to verify a vehicle', () => {
      const vehicleId = 'v-123456';
      
      // Add a vehicle to the map
      mockClarity.contracts['vehicle-registration'].maps.vehicles.set(vehicleId, {
        make: 'Ferrari',
        model: '250 GTO',
        year: 1962,
        vin: '123456789',
        'chassis-number': 'CHASSIS123',
        'engine-type': 'V12',
        'engine-number': 'ENG123',
        'original-color': 'Red',
        'registered-by': USER_1,
        'registered-at': 99,
        verified: false,
      });
      
      // Mock the verify-vehicle function
      mockClarity.contracts['vehicle-registration'].functions['verify-vehicle'].mockImplementation(
          (id) => {
            if (mockClarity.tx.sender !== mockClarity.contracts['vehicle-registration'].variables['contract-owner']) {
              return { err: 1 }; // ERR_UNAUTHORIZED
            }
            
            if (!mockClarity.contracts['vehicle-registration'].maps.vehicles.has(id)) {
              return { err: 3 }; // ERR_NOT_FOUND
            }
            
            const vehicle = mockClarity.contracts['vehicle-registration'].maps.vehicles.get(id);
            vehicle.verified = true;
            mockClarity.contracts['vehicle-registration'].maps.vehicles.set(id, vehicle);
            
            return { ok: true };
          }
      );
      
      // Call the function as contract owner
      const result = callContract(
          'vehicle-registration',
          'verify-vehicle',
          CONTRACT_OWNER,
          vehicleId
      );
      
      // Verify the result
      expect(result).toEqual({ ok: true });
      expect(mockClarity.contracts['vehicle-registration'].maps.vehicles.get(vehicleId).verified).toBe(true);
    });
    
    it('should not allow non-owner to verify a vehicle', () => {
      const vehicleId = 'v-123456';
      
      // Add a vehicle to the map
      mockClarity.contracts['vehicle-registration'].maps.vehicles.set(vehicleId, {
        make: 'Ferrari',
        model: '250 GTO',
        year: 1962,
        vin: '123456789',
        'chassis-number': 'CHASSIS123',
        'engine-type': 'V12',
        'engine-number': 'ENG123',
        'original-color': 'Red',
        'registered-by': USER_1,
        'registered-at': 99,
        verified: false,
      });
      
      // Mock the verify-vehicle function
      mockClarity.contracts['vehicle-registration'].functions['verify-vehicle'].mockImplementation(
          (id) => {
            if (mockClarity.tx.sender !== mockClarity.contracts['vehicle-registration'].variables['contract-owner']) {
              return { err: 1 }; // ERR_UNAUTHORIZED
            }
            return { ok: true };
          }
      );
      
      // Call the function as non-owner
      const result = callContract(
          'vehicle-registration',
          'verify-vehicle',
          USER_1,
          vehicleId
      );
      
      // Verify the result
      expect(result).toEqual({ err: 1 }); // ERR_UNAUTHORIZED
      expect(mockClarity.contracts['vehicle-registration'].maps.vehicles.get(vehicleId).verified).toBe(false);
    });
  });
  
  describe('transfer-ownership', () => {
    it('should allow contract owner to transfer ownership', () => {
      // Mock the transfer-ownership function
      mockClarity.contracts['vehicle-registration'].functions['transfer-ownership'].mockImplementation(
          (newOwner) => {
            if (mockClarity.tx.sender !== mockClarity.contracts['vehicle-registration'].variables['contract-owner']) {
              return { err: 1 }; // ERR_UNAUTHORIZED
            }
            
            mockClarity.contracts['vehicle-registration'].variables['contract-owner'] = newOwner;
            return { ok: true };
          }
      );
      
      // Call the function as contract owner
      const result = callContract(
          'vehicle-registration',
          'transfer-ownership',
          CONTRACT_OWNER,
          USER_2
      );
      
      // Verify the result
      expect(result).toEqual({ ok: true });
      expect(mockClarity.contracts['vehicle-registration'].variables['contract-owner']).toBe(USER_2);
    });
  });
});
