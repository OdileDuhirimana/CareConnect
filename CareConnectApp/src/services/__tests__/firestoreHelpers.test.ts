import { Timestamp } from 'firebase/firestore';
import { convertTimestamps, mapDoc, ServiceError } from '../firestoreHelpers';

jest.mock('firebase/firestore', () => {
  class FakeTimestamp {
    ms: number;
    constructor(ms: number) {
      this.ms = ms;
    }
    toDate() {
      return new Date(this.ms);
    }
  }
  return { Timestamp: FakeTimestamp };
});

describe('firestoreHelpers', () => {
  describe('convertTimestamps', () => {
    it('converts Firestore Timestamp fields to JS Date instances', () => {
      const timestamp = new (Timestamp as unknown as new (ms: number) => InstanceType<typeof Timestamp>)(
        1735689600000
      );
      const input = { name: 'Alice', date: timestamp, count: 3 };

      const result = convertTimestamps(input);

      expect(result.date).toBeInstanceOf(Date);
      expect(result.name).toBe('Alice');
      expect(result.count).toBe(3);
    });

    it('leaves non-Timestamp fields untouched, including nested plain objects', () => {
      const input = { meta: { nested: true }, tags: ['a', 'b'] };

      const result = convertTimestamps(input);

      expect(result).toEqual(input);
    });
  });

  describe('mapDoc', () => {
    it('spreads document data and injects the document id', () => {
      const snapshot = {
        id: 'doc-123',
        data: () => ({ name: 'Bob' }),
      } as any;

      const result = mapDoc<{ id: string; name: string }>(snapshot);

      expect(result).toEqual({ id: 'doc-123', name: 'Bob' });
    });
  });

  describe('ServiceError', () => {
    it('preserves the original cause for debugging without leaking it into the message', () => {
      const cause = new Error('raw firestore error');
      const error = new ServiceError('Friendly message', cause);

      expect(error.message).toBe('Friendly message');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('ServiceError');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
