/**
 * Why a call on {@linkcode AssetsClient} failed, as {@linkcode AssetsError.code}. Native backends
 * report these codes; the client adds `invalid_argument` and `timeout`.
 */
export type AssetsErrorCode =
  /** No backend exists here (web, or the native module on a platform it does not support). */
  | 'unsupported_platform'
  /** The OS is too old for every enabled backend (for example iOS below 26 with ODR turned off). */
  | 'unsupported_os'
  /**
   * The app is not set up for the backend: native module not linked (Expo Go, not rebuilt),
   * Info.plist keys or the downloader extension missing, pack not tagged for On-Demand Resources.
   * A developer error.
   */
  | 'misconfigured'
  /** The store does not know this pack (not uploaded, not released to this channel, or obsolete). */
  | 'pack_not_found'
  /** The pack is known but not on the device. Call `ensureAvailable` first. */
  | 'pack_not_downloaded'
  /** The pack is on the device, but it has no file at this path. */
  | 'file_not_found'
  /**
   * The store cannot serve packs to this install: a debug or sideloaded build (Play), a build not
   * installed from TestFlight or the App Store (Apple hosting), or a version not published yet.
   */
  | 'store_unavailable'
  /** The user has to confirm the download first (Play: cellular download, or app not from Play). */
  | 'user_confirmation_required'
  /** Offline, or the connection dropped. Retry later. */
  | 'network'
  /** Not enough free space on the device. */
  | 'insufficient_storage'
  /** The system refused the download right now (app in the background, download allowance used up). */
  | 'not_allowed'
  | 'invalid_argument'
  /** The call took longer than its timeout. A download may continue in the background. */
  | 'timeout'
  | 'cancelled'
  | 'unknown';

const CODES: ReadonlySet<string> = new Set<AssetsErrorCode>([
  'unsupported_platform',
  'unsupported_os',
  'misconfigured',
  'pack_not_found',
  'pack_not_downloaded',
  'file_not_found',
  'store_unavailable',
  'user_confirmation_required',
  'network',
  'insufficient_storage',
  'not_allowed',
  'invalid_argument',
  'timeout',
  'cancelled',
  'unknown',
]);

const RETRYABLE: ReadonlySet<AssetsErrorCode> = new Set<AssetsErrorCode>([
  'network',
  'timeout',
  'not_allowed',
]);

/** Narrows any string to a known {@linkcode AssetsErrorCode} (`unknown` otherwise). */
export function toErrorCode(code: string): AssetsErrorCode {
  return CODES.has(code) ? (code as AssetsErrorCode) : 'unknown';
}

/** Whether trying the same call again later can succeed (network, timeout, not allowed now). */
export function isRetryable(code: AssetsErrorCode): boolean {
  return RETRYABLE.has(code);
}

/**
 * A failed {@linkcode AssetsClient} call. Branch on {@linkcode AssetsError.code}.
 *
 * @example
 * ```ts
 * try {
 *   await assets.ensureAvailable('intent-model');
 * } catch (error) {
 *   if (error instanceof AssetsError && error.retryable) scheduleRetry();
 * }
 * ```
 */
export class AssetsError extends Error {
  override readonly name = 'AssetsError';
  /** Why the call failed. */
  readonly code: AssetsErrorCode;
  /** The pack the call was about, when there was one. */
  readonly packId: string | undefined;

  constructor(
    code: AssetsErrorCode,
    message: string,
    options: { packId?: string | undefined; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.code = code;
    this.packId = options.packId;
  }

  /** Whether trying again later can succeed. @see {@linkcode isRetryable} */
  get retryable(): boolean {
    return isRetryable(this.code);
  }
}

const PREFIX = /\[nitro-assets:([a-z_]+)\]\s*/;

/**
 * Turns whatever an adapter threw into an {@linkcode AssetsError}. Native errors carry
 * `[nitro-assets:<code>] message` anywhere in their text (Nitro may prefix it).
 */
export function toAssetsError(error: unknown, packId?: string): AssetsError {
  if (error instanceof AssetsError) return error;
  const text = error instanceof Error ? error.message : String(error);
  const match = PREFIX.exec(text);
  if (!match) return new AssetsError('unknown', text, { packId, cause: error });
  const [whole, code = 'unknown'] = match;
  const message = text.slice(match.index + whole.length).trim() || code;
  return new AssetsError(toErrorCode(code), message, { packId, cause: error });
}
