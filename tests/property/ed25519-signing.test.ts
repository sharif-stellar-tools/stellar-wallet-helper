import * as fc from 'fast-check';
import { Keypair } from '@stellar/stellar-sdk';

/**
 * Ed25519 Signing Property-Based Test Suite
 * 
 * Issue #122: Develop property-based tests for Ed25519 signing under high load
 * 
 * This test suite validates Ed25519 signing correctness, performance,
 * and memory allocation stability during 1000+ parallel executions.
 */

// Constants for test configuration
const HIGH_ITERATIONS = 1000;
const PARALLEL_BATCH_SIZE = 100;
const MEMORY_THRESHOLD_MB = 50; // Maximum allowed heap growth in MB
const PERFORMANCE_THRESHOLD_MS = 10; // Maximum allowed average time per sign in ms

describe('Ed25519 Signing - High Load Property-Based Tests', () => {
  let initialHeapUsed: number;

  beforeAll(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    initialHeapUsed = process.memoryUsage().heapUsed;
  });

  describe('Correctness at Scale (1000+ iterations)', () => {
    it('should always correctly sign and verify with 1000+ random seed keys', () => {
      const signingResults: boolean[] = [];

      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 32, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 256 }),
          (seed, messageStr) => {
            const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
            const message = Buffer.from(messageStr, 'utf-8');
            
            // Sign the message
            const signature = kp.sign(message);
            
            // Verify the signature
            const isVerified = kp.verify(message, signature);
            
            // Verify with wrong key fails
            const wrongKp = Keypair.random();
            const wrongVerify = wrongKp.verify(message, signature);
            
            // Verify with wrong message fails
            const wrongMessage = Buffer.from('wrong-message-' + messageStr);
            const wrongMessageVerify = kp.verify(wrongMessage, signature);
            
            const result = isVerified && !wrongVerify && !wrongMessageVerify;
            signingResults.push(result);
            
            return result;
          }
        ),
        { 
          numRuns: HIGH_ITERATIONS,
          seed: 42, // Deterministic for reproducibility
          endOnFailure: false // Continue to collect all results
        }
      );

      // All iterations should pass
      expect(signingResults.length).toBe(HIGH_ITERATIONS);
      expect(signingResults.every(r => r === true)).toBe(true);
    });

    it('should handle edge cases (empty buffer, max length) correctly', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 32, maxLength: 32 }),
          fc.oneof(
            fc.constant(Buffer.alloc(0)),           // Empty message
            fc.constant(Buffer.alloc(1024, 0xff)),  // Max-length-ish buffer
            fc.uint8Array({ minLength: 1, maxLength: 4096 }) // Random length
          ),
          (seed, message) => {
            const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
            const buf = Buffer.from(message);
            const signature = kp.sign(buf);
            const isVerified = kp.verify(buf, signature);
            
            expect(isVerified).toBe(true);
            return true;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should produce deterministic signatures for same inputs', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 32, maxLength: 32 }),
          fc.uint8Array({ minLength: 1, maxLength: 256 }),
          (seed, message) => {
            const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
            const buf = Buffer.from(message);
            
            const sig1 = kp.sign(buf);
            const sig2 = kp.sign(buf);
            
            // Ed25519 signatures are deterministic (RFC 8032)
            expect(sig1.toString('hex')).toBe(sig2.toString('hex'));
            return true;
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should sign 1000+ messages within acceptable time bounds', () => {
      const startTime = process.hrtime.bigint();
      const timings: number[] = [];

      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 32, maxLength: 32 }),
          fc.uint8Array({ minLength: 1, maxLength: 512 }),
          (seed, message) => {
            const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
            const buf = Buffer.from(message);
            
            const signStart = process.hrtime.bigint();
            const signature = kp.sign(buf);
            const signEnd = process.hrtime.bigint();
            
            const signTimeMs = Number(signEnd - signStart) / 1e6;
            timings.push(signTimeMs);
            
            const isVerified = kp.verify(buf, signature);
            expect(isVerified).toBe(true);
            
            return true;
          }
        ),
        { numRuns: HIGH_ITERATIONS }
      );

      const totalTimeMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      const avgTimeMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const p95TimeMs = timings.sort((a, b) => a - b)[Math.floor(timings.length * 0.95)];
      const p99TimeMs = timings.sort((a, b) => a - b)[Math.floor(timings.length * 0.99)];

      // Log performance metrics for CI visibility
      console.log('\n=== Signing Performance Metrics ===');
      console.log(`Total iterations: ${HIGH_ITERATIONS}`);
      console.log(`Total time: ${totalTimeMs.toFixed(2)}ms`);
      console.log(`Average time per sign: ${avgTimeMs.toFixed(4)}ms`);
      console.log(`P95 time: ${p95TimeMs.toFixed(4)}ms`);
      console.log(`P99 time: ${p99TimeMs.toFixed(4)}ms`);
      console.log(`Throughput: ${(HIGH_ITERATIONS / (totalTimeMs / 1000)).toFixed(0)} signs/sec`);
      console.log('===================================\n');

      // Performance assertions
      expect(avgTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(totalTimeMs).toBeLessThan(HIGH_ITERATIONS * PERFORMANCE_THRESHOLD_MS);
    });

    it('should verify 1000+ signatures within acceptable time bounds', () => {
      // Pre-generate test data
      const testData: Array<{ kp: Keypair; message: Buffer; signature: Buffer }> = [];
      
      for (let i = 0; i < HIGH_ITERATIONS; i++) {
        const kp = Keypair.random();
        const message = Buffer.from(`test-message-${i}-${Date.now()}`);
        const signature = kp.sign(message);
        testData.push({ kp, message, signature });
      }

      const startTime = process.hrtime.bigint();
      const timings: number[] = [];

      for (const { kp, message, signature } of testData) {
        const verifyStart = process.hrtime.bigint();
        const isVerified = kp.verify(message, signature);
        const verifyEnd = process.hrtime.bigint();
        
        const verifyTimeMs = Number(verifyEnd - verifyStart) / 1e6;
        timings.push(verifyTimeMs);
        
        expect(isVerified).toBe(true);
      }

      const totalTimeMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      const avgTimeMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const p95TimeMs = timings.sort((a, b) => a - b)[Math.floor(timings.length * 0.95)];

      console.log('\n=== Verification Performance Metrics ===');
      console.log(`Total iterations: ${HIGH_ITERATIONS}`);
      console.log(`Total time: ${totalTimeMs.toFixed(2)}ms`);
      console.log(`Average time per verify: ${avgTimeMs.toFixed(4)}ms`);
      console.log(`P95 time: ${p95TimeMs.toFixed(4)}ms`);
      console.log(`Throughput: ${(HIGH_ITERATIONS / (totalTimeMs / 1000)).toFixed(0)} verifies/sec`);
      console.log('========================================\n');

      expect(avgTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });

  describe('Memory Allocation Stability', () => {
    it('should not leak memory during 1000+ signing operations', () => {
      const heapBefore = process.memoryUsage().heapUsed;
      const heapSnapshots: number[] = [heapBefore];

      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 32, maxLength: 32 }),
          fc.uint8Array({ minLength: 1, maxLength: 256 }),
          (seed, message) => {
            const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
            const buf = Buffer.from(message);
            const signature = kp.sign(buf);
            kp.verify(buf, signature);
            
            return true;
          }
        ),
        { numRuns: HIGH_ITERATIONS }
      );

      // Force GC if available to get accurate measurement
      if (global.gc) {
        global.gc();
      }

      const heapAfter = process.memoryUsage().heapUsed;
      const heapDeltaMB = (heapAfter - heapBefore) / (1024 * 1024);

      console.log('\n=== Memory Allocation Metrics ===');
      console.log(`Heap before: ${(heapBefore / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Heap after: ${(heapAfter / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Heap delta: ${heapDeltaMB.toFixed(2)}MB`);
      console.log('=================================\n');

      // Memory should not grow excessively
      expect(heapDeltaMB).toBeLessThan(MEMORY_THRESHOLD_MB);
    });

    it('should not leak memory during 1000+ verification operations', () => {
      // Pre-generate test data
      const testData: Array<{ kp: Keypair; message: Buffer; signature: Buffer }> = [];
      
      for (let i = 0; i < HIGH_ITERATIONS; i++) {
        const kp = Keypair.random();
        const message = Buffer.from(`memory-test-${i}`);
        const signature = kp.sign(message);
        testData.push({ kp, message, signature });
      }

      const heapBefore = process.memoryUsage().heapUsed;

      for (const { kp, message, signature } of testData) {
        kp.verify(message, signature);
      }

      if (global.gc) {
        global.gc();
      }

      const heapAfter = process.memoryUsage().heapUsed;
      const heapDeltaMB = (heapAfter - heapBefore) / (1024 * 1024);

      console.log('\n=== Verification Memory Metrics ===');
      console.log(`Heap before: ${(heapBefore / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Heap after: ${(heapAfter / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Heap delta: ${heapDeltaMB.toFixed(2)}MB`);
      console.log('===================================\n');

      expect(heapDeltaMB).toBeLessThan(MEMORY_THRESHOLD_MB);
    });
  });

  describe('Parallel Execution Tests', () => {
    it('should handle 1000+ parallel signing operations correctly', async () => {
      const startTime = process.hrtime.bigint();
      const heapBefore = process.memoryUsage().heapUsed;

      // Create 1000+ signing promises
      const signingPromises: Promise<boolean>[] = [];
      
      for (let i = 0; i < HIGH_ITERATIONS; i++) {
        signingPromises.push(
          (async () => {
            const kp = Keypair.random();
            const message = Buffer.from(`parallel-sign-${i}-${Date.now()}-${Math.random()}`);
            const signature = kp.sign(message);
            return kp.verify(message, signature);
          })()
        );
      }

      // Execute all signing operations in parallel
      const results = await Promise.all(signingPromises);
      
      const totalTimeMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      
      if (global.gc) {
        global.gc();
      }
      
      const heapAfter = process.memoryUsage().heapUsed;
      const heapDeltaMB = (heapAfter - heapBefore) / (1024 * 1024);

      console.log('\n=== Parallel Signing Metrics ===');
      console.log(`Total parallel operations: ${HIGH_ITERATIONS}`);
      console.log(`Total time: ${totalTimeMs.toFixed(2)}ms`);
      console.log(`Throughput: ${(HIGH_ITERATIONS / (totalTimeMs / 1000)).toFixed(0)} signs/sec`);
      console.log(`Heap delta: ${heapDeltaMB.toFixed(2)}MB`);
      console.log('================================\n');

      // All operations should succeed
      expect(results.length).toBe(HIGH_ITERATIONS);
      expect(results.every(r => r === true)).toBe(true);
      
      // Performance should be reasonable under parallel load
      expect(totalTimeMs).toBeLessThan(HIGH_ITERATIONS * PERFORMANCE_THRESHOLD_MS);
      
      // Memory should remain stable
      expect(heapDeltaMB).toBeLessThan(MEMORY_THRESHOLD_MB);
    });

    it('should handle 1000+ parallel verification operations correctly', async () => {
      // Pre-generate test data
      const testData: Array<{ kp: Keypair; message: Buffer; signature: Buffer }> = [];
      
      for (let i = 0; i < HIGH_ITERATIONS; i++) {
        const kp = Keypair.random();
        const message = Buffer.from(`parallel-verify-${i}-${Date.now()}`);
        const signature = kp.sign(message);
        testData.push({ kp, message, signature });
      }

      const startTime = process.hrtime.bigint();
      const heapBefore = process.memoryUsage().heapUsed;

      // Create 1000+ verification promises
      const verificationPromises = testData.map(({ kp, message, signature }) =>
        (async () => kp.verify(message, signature))()
      );

      // Execute all verification operations in parallel
      const results = await Promise.all(verificationPromises);
      
      const totalTimeMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      
      if (global.gc) {
        global.gc();
      }
      
      const heapAfter = process.memoryUsage().heapUsed;
      const heapDeltaMB = (heapAfter - heapBefore) / (1024 * 1024);

      console.log('\n=== Parallel Verification Metrics ===');
      console.log(`Total parallel operations: ${HIGH_ITERATIONS}`);
      console.log(`Total time: ${totalTimeMs.toFixed(2)}ms`);
      console.log(`Throughput: ${(HIGH_ITERATIONS / (totalTimeMs / 1000)).toFixed(0)} verifies/sec`);
      console.log(`Heap delta: ${heapDeltaMB.toFixed(2)}MB`);
      console.log('=====================================\n');

      // All operations should succeed
      expect(results.length).toBe(HIGH_ITERATIONS);
      expect(results.every(r => r === true)).toBe(true);
      
      // Performance should be reasonable under parallel load
      expect(totalTimeMs).toBeLessThan(HIGH_ITERATIONS * PERFORMANCE_THRESHOLD_MS);
      
      // Memory should remain stable
      expect(heapDeltaMB).toBeLessThan(MEMORY_THRESHOLD_MB);
    });

    it('should maintain correctness under mixed parallel sign+verify load', async () => {
      const startTime = process.hrtime.bigint();
      const heapBefore = process.memoryUsage().heapUsed;

      // Create mixed batch: half sign, half verify
      const mixedPromises: Promise<boolean>[] = [];
      
      // Pre-generate some keys for verification tests
      const preGenerated: Array<{ kp: Keypair; message: Buffer; signature: Buffer }> = [];
      for (let i = 0; i < HIGH_ITERATIONS / 2; i++) {
        const kp = Keypair.random();
        const message = Buffer.from(`mixed-pre-${i}`);
        const signature = kp.sign(message);
        preGenerated.push({ kp, message, signature });
      }

      // Add signing operations
      for (let i = 0; i < HIGH_ITERATIONS / 2; i++) {
        mixedPromises.push(
          (async () => {
            const kp = Keypair.random();
            const message = Buffer.from(`mixed-sign-${i}-${Date.now()}`);
            const signature = kp.sign(message);
            return kp.verify(message, signature);
          })()
        );
      }

      // Add verification operations
      for (const { kp, message, signature } of preGenerated) {
        mixedPromises.push(
          (async () => kp.verify(message, signature))()
        );
      }

      // Shuffle and execute
      const shuffled = mixedPromises.sort(() => Math.random() - 0.5);
      const results = await Promise.all(shuffled);
      
      const totalTimeMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      
      if (global.gc) {
        global.gc();
      }
      
      const heapAfter = process.memoryUsage().heapUsed;
      const heapDeltaMB = (heapAfter - heapBefore) / (1024 * 1024);

      console.log('\n=== Mixed Parallel Metrics ===');
      console.log(`Total parallel operations: ${results.length}`);
      console.log(`Total time: ${totalTimeMs.toFixed(2)}ms`);
      console.log(`Throughput: ${(results.length / (totalTimeMs / 1000)).toFixed(0)} ops/sec`);
      console.log(`Heap delta: ${heapDeltaMB.toFixed(2)}MB`);
      console.log('==============================\n');

      // All operations should succeed
      expect(results.length).toBe(HIGH_ITERATIONS);
      expect(results.every(r => r === true)).toBe(true);
      
      // Memory should remain stable
      expect(heapDeltaMB).toBeLessThan(MEMORY_THRESHOLD_MB);
    });
  });

  describe('Stress Test - Sustained Load', () => {
    it('should handle sequential batches of 1000+ operations without degradation', () => {
      const batchSize = 500;
      const numberOfBatches = 3; // Total: 1500 operations
      const batchTimings: number[] = [];
      const heapSnapshots: number[] = [];

      for (let batch = 0; batch < numberOfBatches; batch++) {
        const batchStart = process.hrtime.bigint();
        const heapBefore = process.memoryUsage().heapUsed;

        fc.assert(
          fc.property(
            fc.uint8Array({ minLength: 32, maxLength: 32 }),
            fc.uint8Array({ minLength: 1, maxLength: 256 }),
            (seed, message) => {
              const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
              const buf = Buffer.from(message);
              const signature = kp.sign(buf);
              const isVerified = kp.verify(buf, signature);
              expect(isVerified).toBe(true);
              return true;
            }
          ),
          { numRuns: batchSize }
        );

        const batchTimeMs = Number(process.hrtime.bigint() - batchStart) / 1e6;
        const heapAfter = process.memoryUsage().heapUsed;
        const heapDeltaMB = (heapAfter - heapBefore) / (1024 * 1024);
        
        batchTimings.push(batchTimeMs);
        heapSnapshots.push(heapDeltaMB);

        console.log(`Batch ${batch + 1}: ${batchTimeMs.toFixed(2)}ms, heap delta: ${heapDeltaMB.toFixed(2)}MB`);
      }

      console.log('\n=== Sustained Load Summary ===');
      console.log(`Total batches: ${numberOfBatches}`);
      console.log(`Total operations: ${batchSize * numberOfBatches}`);
      console.log(`Average batch time: ${(batchTimings.reduce((a, b) => a + b, 0) / batchTimings.length).toFixed(2)}ms`);
      console.log(`Average heap delta per batch: ${(heapSnapshots.reduce((a, b) => a + b, 0) / heapSnapshots.length).toFixed(2)}MB`);
      console.log('==============================\n');

      // Performance should not degrade across batches
      const firstBatchTime = batchTimings[0];
      const lastBatchTime = batchTimings[batchTimings.length - 1];
      expect(lastBatchTime).toBeLessThan(firstBatchTime * 2); // No more than 2x degradation

      // Memory should remain stable across batches
      const totalHeapDelta = heapSnapshots.reduce((a, b) => a + b, 0);
      expect(totalHeapDelta).toBeLessThan(MEMORY_THRESHOLD_MB);
    });
  });
});
