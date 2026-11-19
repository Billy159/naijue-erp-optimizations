import type {BoundedPostgresPool} from '../../adapters/postgres/src/bounded-pool.ts';
/** Genuine opaque tokens constructed from the protected installed target and
 * frozen source by loadPhysicalCloneReadbackCatalog; JSON is not equivalent. */
export interface PhysicalCloneCatalogContext { readonly source: object; readonly target: object; readonly catalog: object }
export interface PhysicalCloneCurrent {
  readonly startsAt: number;
  readonly expiresAt: number;
  /** Actual pg_postmaster_start_time()::text, including UTC +00 suffix. */
  readonly postmasterStart: string;
  readonly controllerLoginValidUntil: string;
  /** null preserves the existing ordinary login's null/infinity TTL. */
  readonly runtimeLoginValidUntil: string | null;
  /** T45 verifies actual carrier/copy/auth refs, PGDATA/mount/ns/owner/epoch,
   * original/cold protection, fixed job key and operation deadline; throws on
   * expiry, replacement or missing proof. This is not an authority issuer. */
  assertCurrent(): Promise<void>;
}
export interface PhysicalCloneReadbackBinding {
  readonly database: string;
  readonly baselineBatchId: string;
  readonly documentBatchId: string;
  readonly manifestSha256: string;
  readonly planSha256: string;
  readonly rootOperationId: string;
  readonly publishOperationId: string;
  readonly scopeSha256: string;
}
export interface PhysicalCloneDatabaseInput {
  readonly catalogContext: PhysicalCloneCatalogContext;
  readonly clone: PhysicalCloneCurrent;
  /** Two actual instances imported from this same installed source root. T45
   * owns exact configs, finite query/acquire/job bounds and final pool.dispose. */
  readonly controllerPool: BoundedPostgresPool;
  readonly runtimePool: BoundedPostgresPool;
  readonly binding: PhysicalCloneReadbackBinding;
  readonly initialize: Record<string, unknown>;
  /** Private original verifier credential; never returned in public/detail. */
  readonly encodedScrypt: string;
  readonly sourceCounts: Readonly<Record<string, number>>;
  readonly sourceTotals: Readonly<Record<string, string>>;
  readonly warehouseEvidence: Record<string, unknown>;
  readonly aggregateEvidence: Record<string, unknown>;
  /** Actual approved scope.explicit_values.records_sha256; no old-batch default. */
  readonly expectedExplicitValuesSha256: string;
}
export type PhysicalCloneDatabaseState = 'VERIFIED_CLONE_DATABASE_READBACK_ONLY' | 'CLONE_DATABASE_READBACK_DIFFERS' | 'CLONE_DATABASE_CHECK_FAILED' | 'CLONE_DATABASE_CHECK_CLEANUP_UNKNOWN';
export interface PhysicalClonePublicResult {
  readonly format: 'D1_R3_PHYSICAL_CLONE_DATABASE_READBACK_V1';
  readonly requestKey: 't45-r3-final33-independent-restore-20261116-01';
  readonly state: PhysicalCloneDatabaseState;
  readonly phase: string;
  readonly code: string | null;
  readonly database: string;
  readonly systemIdentifier: string;
  readonly databaseOid: string;
  readonly postmasterStart: string;
  readonly routineCount: 166;
  readonly catalogModelSha256: string;
  readonly physicalMatched: true | null;
  readonly catalogMatched: true | null;
  readonly nativePackageState: string | null;
  readonly scopeExplicitDigestMatched: boolean | null;
  readonly warehouseMismatchCount: number | null;
  readonly cashMismatchCount: number | null;
  readonly currentInventory: { readonly missingKeys: string; readonly changedKeys: string; readonly extraKeys: string } | null;
  readonly currentCashDirectionsDiffer: readonly string[] | null;
  readonly omittedKeyHasEffects: boolean | null;
  readonly transactionsRolledBack: true | null;
  /** Physical leases only; does not assert pool.dispose or clone PG stop. */
  readonly connectionCleanup: 'CLOSED' | 'UNKNOWN';
  readonly restoreClosed: false;
  readonly hostClosure: 'T45_OUTER_STOP_READBACK_REQUIRED';
}
export const PHYSICAL_CLONE_RESTORE_KEY: 't45-r3-final33-independent-restore-20261116-01';
export function loadPhysicalCloneReadbackCatalog(sourceRoot: string, referenceDirectory: string): Promise<PhysicalCloneCatalogContext>;
/** Pre-SQL malformed input errors reject; execution errors return a safe failed
 * publicResult. detail stays private. This never returns whole-restore PASS. */
export function checkPhysicalCloneDatabase(input: PhysicalCloneDatabaseInput): Promise<{ publicResult: PhysicalClonePublicResult; detail: Record<string, unknown> }>;
