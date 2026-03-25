/**
 * Task 1 Tests: JwtPayload type, JwtStrategy, CustomerGuard, StaffGuard
 */
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../auth/jwt.strategy';
import { CustomerGuard } from './guards/customer.guard';
import { StaffGuard } from './guards/staff.guard';
import { JwtPayload } from '../types/auth';

// Test JwtPayload interface
describe('JwtPayload type contract', () => {
  it('should accept customer payload with customerId and type=customer', () => {
    const payload: JwtPayload = {
      customerId: 'cust-123',
      type: 'customer',
    };
    expect(payload.type).toBe('customer');
    expect(payload.customerId).toBe('cust-123');
  });

  it('should accept staff payload with userId, roleCode, and type=staff', () => {
    const payload: JwtPayload = {
      userId: 'user-123',
      roleCode: 'FOUNDER_ADMIN',
      type: 'staff',
    };
    expect(payload.type).toBe('staff');
    expect(payload.userId).toBe('user-123');
    expect(payload.roleCode).toBe('FOUNDER_ADMIN');
  });
});

// Test JwtStrategy.validate
describe('JwtStrategy.validate', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: () => 'test-secret-key-minimum-32-characters-long!' },
        },
      ],
    }).compile();
    strategy = module.get(JwtStrategy);
  });

  it('should return { customerId, type: customer } for customer payloads', async () => {
    const result = await strategy.validate({
      customerId: 'cust-abc',
      type: 'customer',
    });
    expect(result).toEqual({ customerId: 'cust-abc', type: 'customer' });
  });

  it('should return { id, roleCode, type: staff } for staff payloads', async () => {
    const result = await strategy.validate({
      userId: 'user-xyz',
      roleCode: 'TECH_LEAD',
      type: 'staff',
    });
    expect(result).toEqual({ id: 'user-xyz', roleCode: 'TECH_LEAD', type: 'staff' });
  });
});

// Test CustomerGuard
describe('CustomerGuard', () => {
  let guard: CustomerGuard;

  beforeEach(() => {
    guard = new CustomerGuard();
  });

  it('should allow customer type users', () => {
    const user = { customerId: 'cust-1', type: 'customer' };
    const result = guard.handleRequest(null, user);
    expect(result).toEqual(user);
  });

  it('should reject staff type users', () => {
    const user = { id: 'user-1', roleCode: 'TECH_LEAD', type: 'staff' };
    expect(() => guard.handleRequest(null, user)).toThrow(UnauthorizedException);
  });

  it('should reject null users', () => {
    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });
});

// Test StaffGuard
describe('StaffGuard', () => {
  let guard: StaffGuard;

  beforeEach(() => {
    guard = new StaffGuard();
  });

  it('should allow staff type users', () => {
    const user = { id: 'user-1', roleCode: 'FOUNDER_ADMIN', type: 'staff' };
    const result = guard.handleRequest(null, user);
    expect(result).toEqual(user);
  });

  it('should reject customer type users', () => {
    const user = { customerId: 'cust-1', type: 'customer' };
    expect(() => guard.handleRequest(null, user)).toThrow(UnauthorizedException);
  });

  it('should reject null users', () => {
    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });
});
