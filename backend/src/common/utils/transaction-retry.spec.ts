import { Prisma } from '@prisma/client';
import {
  SERIALIZABLE_TX_OPTIONS,
  hasPrismaCode,
  withSerializableRetry,
} from './transaction-retry';

const serializationFailure = () =>
  Object.assign(new Error('could not serialize access'), { code: 'P2034' });

describe('transaction-retry', () => {
  it('exposes Serializable options with maxWait 5000 and timeout 15000', () => {
    expect(SERIALIZABLE_TX_OPTIONS).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 15000,
    });
  });

  it('hasPrismaCode matches duck-typed prisma errors only', () => {
    expect(hasPrismaCode(serializationFailure(), 'P2034')).toBe(true);
    expect(hasPrismaCode({ code: 'P2002' }, 'P2034')).toBe(false);
    expect(hasPrismaCode(null, 'P2034')).toBe(false);
  });

  it('retries on P2034 and returns the eventual result', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(serializationFailure())
      .mockRejectedValueOnce(serializationFailure())
      .mockResolvedValue('ok');
    await expect(withSerializableRetry(fn, 3, 0)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after `retries` additional attempts', async () => {
    const fn = jest.fn().mockRejectedValue(serializationFailure());
    await expect(withSerializableRetry(fn, 2, 0)).rejects.toMatchObject({
      code: 'P2034',
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-serialization errors', async () => {
    const fn = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(withSerializableRetry(fn, 3, 0)).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
