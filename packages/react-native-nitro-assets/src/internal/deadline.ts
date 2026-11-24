import { AssetsError } from '../AssetsError.ts';

/**
 * Rejects with `timeout` when `promise` has not settled after `ms`. The underlying work is not
 * cancelled; its late result is ignored.
 */
export function withDeadline<T>(
  promise: Promise<T>,
  ms: number | undefined,
  what: string,
  packId?: string,
): Promise<T> {
  if (ms === undefined) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AssetsError('timeout', `${what} took longer than ${ms} ms`, { packId }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
