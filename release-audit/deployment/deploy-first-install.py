#!/usr/bin/env python3
"""Exact35 first install, using the unchanged approved deployment base.

Only this separately reviewed entry selects the first-install path. The legacy
helper remains the default byte-for-byte for existing callers.
"""
import hashlib
import io
from pathlib import Path
import shutil
from types import FunctionType, ModuleType, SimpleNamespace

APP576_HELPER_SHA256 = '649ae7d639782341375a3b514cab7efadb2c7cd795991a3b949fa18443b4095c'
APP576_HELPER_PATH = Path(__file__).with_name('deploy-candidate.py')
_base_bytes = APP576_HELPER_PATH.read_bytes()
if hashlib.sha256(_base_bytes).hexdigest() != APP576_HELPER_SHA256:
    raise RuntimeError('EXACT_REVIEWED_APP576_BASE_HELPER_REQUIRED')
# Load the pinned routines in this module, inertly. Their normal calls resolve
# to the first-install overrides below; legacy callers import the original file.
_entry_name = __name__
__name__ = '_approved_app576_deployment_base'
try:
    exec(compile(_base_bytes, str(APP576_HELPER_PATH), 'exec'), globals())
finally:
    __name__ = _entry_name
del _base_bytes, _entry_name

FIRST_INSTALL_MODE = 'exact35-first-install-v1'
FIRST_INSTALL_NATIVE_COMMIT = '3b82c46ebc0b49b26005b023c5e97bc779c8628c'
FIRST_INSTALL_NATIVE_SET = '8694c5c7e1bc4b09f9511869f2665e8ec9fad65d6aa832b139a24d47258f998d'
FIRST_INSTALL_APP_COMMIT = 'db624feafd98568b16f91e02a0604ab6e57a3528'
RESTORATION_BUILD_ONLY_COMMIT = 'f5a1a2f91882978c6cdd14eeca9bd9897e5ac86f'
# The R2 current-service source has been fixed. Its actual approved archive has not.
FIRST_INSTALL_APP_ARCHIVE = None
FIRST_R2_WORKSPACE = '/release-review/location-60a946cf70'
FIRST_R2_CARRIER = 't45-fresh35-first-production-20261110-r2-recovery'
FIRST_R2_APP = 'naijue-rewrite-fresh35-first-20261110-r2-app'
FIRST_R3_APP = 'naijue-rewrite-fresh35-first-20261110-r3-app'
FIRST_R3_APP_COMMIT = '7e6626deb7cce6f24fe33f9eda7de6400787de8b'
# D2 READY 4789a0e7ff31bf0197fc2809edbdbd2b91b4a059d7ad514efe3808c5a0c54250.
FIRST_R3_BUILD = 'erp-7e6626deb7cc-post-backup-ordinary09-20261112-assets-r2'
FIRST_R3_ARCHIVE = 'a8382341c90924a69c98d32a0bff4af42ea61b83b218432e58958b119e46d30a'
FIRST_R3_ARCHIVE_BYTES = 3406831
FIRST_R3_MANIFEST = '6f74c3da9ccbccfce3ea311a8dc08ee81a5708a1ee8d4f1ed74e64e17fe5e982'
FIRST_R3_CANONICAL_MANIFEST = 'c1fef9f15fe5a2e69e07eb2d527dbc6c8e4ce06e71aa5b1e18f88d6356afad33'
# Planned successor key. Actual receiver READY and approval remain external.
FIRST_R3_ARTIFACT = 'r3-post-backup-ordinary09-app7e6626de-20261112-02'
FIRST_R3_APP_SET = 'ba5c77d103dc8edeb9233a488d70f4fe3bb2af91b36615dbda55124b568239b8'
# Formal owner material. The finite 09 artifact and its stage retain the pins above.
FORMAL_R3_APP = {
    'sourceCommit': 'ef807b39b5ac8c483e9350dc72108d57716bf291',
    'buildId': 'erp-ef807b39b5ac-r3-service12-lineage-20261113',
    'archiveSha256': '7fb9323db5270951c66fe6bf8b62f95d3ba2520bdbc1fc66cd6035e85cf0f018',
    'archiveBytes': 3416488,
    'manifestSha256': 'd42b6d141d85f778dc68d1019f3865783b7adccc3c58a292e58ec90c482740b9',
    'manifestBytes': 510772,
    'normalizedManifestSha256': '1ab343625a1e97863029d8954888b3c854b8ed3f7304beeec84ba7ff4f8c4584',
    'nativeSourceSetSha256': 'd98c506a183f297906580360904e0a10dbf5f0838c04db4a2d836fd0dbcb235c',
    'sourceManifestSha256': '5ca64709adcddfe40f318d090e83cf2a40594219a5fba0278f3fc7d00bfe6a26',
    'buildManifestSha256': '50413a935bddddb168bdfb92cf67e1dbd6fcc22011ea4187df1bf28387ab6cd1',
    'buildReceiptSha256': '79ad4a58a388ca3848b9051d0d3f71df0476071662f9e2d708c74172b596d7c3',
    'packReceiptSha256': '506bffea06c00ddfa78f1148b15281bb7aada24721060d3dd219db009ea8e02e',
    'runtimeTemplateSha256': 'bf98a6e6089af60153b0f50c026814e8b3470b342129684e20eeb003bda0f9cb',
    'archivePayloadWithoutDependenciesSha256': '7d25bc9beb726719c016a7ac9a0181b3bf25336078ba9ae2aab3338888929e78',
}
FORMAL_R3_FINAL33_APP = {'sourceCommit': 'd728f3749cc8cf504fec6c51720562c5774b72c0', 'buildId': 'erp-d728f3749cc8-r3-final33-ordinary161-20261116', 'archiveSha256': '14f34cd1dccaf0b3cd40c979620889f728307714fddf1b33896ee7c72882701f', 'archiveBytes': 7687919, 'manifestSha256': '48accb35b38018c60402932380c66b46f1ffe4a32edf04f0868858e5203ebcbc', 'manifestBytes': 546469, 'normalizedManifestSha256': 'e3e4098f8f5edcfbfbc73a292f8e4ee9aab40c9fb12410b6e4a60d3e138b0216', 'nativeSourceSetSha256': '6499882af2b206dd5896cd20aad9e297d0e2ca69c052851542faf05c4daf1eac', 'nativeClosureMembers': 284, 'releasePayloadMembers': 522, 'packedMembers': 523, 'sourceManifestSha256': '5addee3cc994256ebb22c506119ed08b730c24364c0caf6c1fa0586e61c7c1de', 'buildManifestSha256': 'a4a29b637981a17ee277c4bafd2c069cd6bdcb276b0cab48ff7e7651d09b2336', 'buildReceiptSha256': '4bcb413506cd2a27865c9b8f0cdf4394ceaa108800bdb6e54a26473ba8065608', 'packReceiptSha256': 'fdcc82a3b741cb7a520b79801ed318eeedac172046bb3377a9c064fa8e8b321d', 'runtimeTemplateSha256': '2ea7d8883a0a8fa2382810db282970ecc1744e1a1614b9e8e92dd032826335f2', 'archivePayloadWithoutDependenciesSha256': '04e2e9649690dc99a86343033271cc188a8547eccb4ff3db79cb3ee442235f3f'}

def formal_r3_app(plan):
    if app289_selected(plan):
        return APP289_RELEASE
    return FORMAL_R3_FINAL33_APP if plan.get("sourceCommit") == FORMAL_R3_FINAL33_APP["sourceCommit"] else FORMAL_R3_APP



FINAL33_RECEIPTS_SHA = '761351f03fa327757143e6f3955c43c064416946b4c323e243c7ada537a8b68e'
def final33_module():
    path=Path(__file__).with_name('final33_receipts.py')
    raw=path.read_bytes()
    need(digest(raw)==FINAL33_RECEIPTS_SHA,'FORMAL_FINAL33_RECEIPT_SOURCE_DIFFERS')
    module=ModuleType('fixed_final33_receipts');module.__file__=str(path)
    exec(compile(raw,str(path),'exec'),module.__dict__)
    return module

def final33_selected(plan):
    return app289_selected(plan) or plan.get('sourceCommit')==FORMAL_R3_FINAL33_APP['sourceCommit']

def final33_recovery(descriptor,coverage,lineage):
    return final33_module().recovery(descriptor,coverage,lineage)


FORMAL_LINUX_JOB = 't45-r3-review-2b8e02934c'
FORMAL_LINUX_TERMINAL = Path('/release-review/location-48f0e6a523')/(FORMAL_LINUX_JOB+'.json')
FORMAL_LINUX_TERMINAL_SHA = '760149917095ed2460bf5774a1ef761184fe122de2d944ae6d92211a20080b14'
FORMAL_LINUX_RESULT = (Path('/release-review/location-2acbd7b442')/
                       FORMAL_LINUX_JOB/'results/linux-dependency-result.json')
FORMAL_LINUX_PAYLOAD = Path('/release-review/location-f8a35930e0')
FORMAL_LINUX_IMAGE = 'sha256:6de44f436389594e4647c8503764f8f6a56bc964b4e33cf31a3fbb9ba8bfa769'
FORMAL_LINUX_NATIVE = {
    'node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node':
        'cf896cc1b7f3ae9c3e8eb3d7b2b198b8de2824ff7d0681d684bab5a825def335',
    'node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.7':
        '4aa73553408c3964071728f4a231a8e86918e39bc49f1fbae75355f7ea933ea9',
}
FIRST_R3_INSTALLED_SET = '6c49bd9218e7cb313e7ac7d7cce83a166651e7418dd1c82322dc42589daefa16'
FIRST_R3_INSTALLED_COMMIT = '44f9b603d6b27f2d16ec3ad2b1505f8f8fa8c2b2'
FIRST_R3_INSTALLED_RECORD = '4ed44478765d20c1ccde4f5a2c29441456a0ee7cd6ed1c16ccd2ee3d3b65c39e'
FIRST_R3_RESTORE_EXECUTOR = {
    'sourceCommit': '30105fdad477fca9ca1956dc606ae941f0c6e380',
    'buildId': 'erp-30105fdad477-service15-restore-only-224-20261113',
    'appArchiveSha256': 'd8376d21950630ef16154a9ce0de032693203d075dac4ff007db975230d655ef',
    'sourceSetSha256': 'a8db30cd398dd075bd59480e732da66dae34ac110e326749d39c162aee9349c3',
}
FIRST_R3_RESTORE_MANIFEST = 'eeb11bd036bb156b73719d0dbb1916b28ccf62302777365692b052b455a9be04'
FIRST_R3_RESTORE_ARCHIVE_BYTES = 3066625
FIRST_R3_RESTORE_MANIFEST_BYTES = 153803
FIRST_R3_D3_MANIFEST = 'f4b86de73073da86fe8e49af5a871aaf1d3e856856a0912d835ea0180f1b0deb'
FIRST_R3_D3_SCOPE = 'caec2056f53910f8e574d16e151974681da437bbf36773365bee52f77467d151'
FIRST_R3_IMPORT_SERVICE = 't45-first-r3-native-service-start-20261114-19'
FIRST_R3_ROOT = Path('/release-review/location-43e7a0f249')
FIRST_R3_AUTHORITY = FIRST_R3_ROOT/'authority'
FIRST_R3_SERVICE = 't45-first-r3-native-service-start-20261112-09'
FIRST_R3_SERVICE_BOOT = FIRST_R3_ROOT/'state/native-services'/FIRST_R3_SERVICE
FIRST_R3_CURRENT = FIRST_R3_AUTHORITY/'fresh35-current-production-service-v2-service-09.json'
FIRST_R3_ADMIN = FIRST_R3_AUTHORITY/'fresh35-admin154-successor-v1.json'
FIRST_R3_SQL38 = FIRST_R3_AUTHORITY/'fresh35-compact-zero-successor-v2.json'
FIRST_R3_PROOF_VALIDATOR_SHA = 'eeaa6b7d6bd9c2ac37c834b47c0c54efef841439fdd8b22e8ec207eff6971ba0'
FIRST_R3_READINESS_SHA = '24a179568c89f3e40d94125cb8f89d02be09c0f1bba968b4ad083e28dfbab950'
FIRST_R3_RECOVERY_HOLD = 'FIRST_INSTALL_R3_SQL38_RECOVERY_CONTRACT_REVIEW_REQUIRED'
R3_UI_TOKENS = 'web/source-styles/ui-tokens.css'

# BEGIN GENERATED R3 RELEASE CONTRACT
# Generated from the frozen 7e66 config/release-contract.json.
R3_RELEASE_CONTRACT = json.loads(r'''{"format":"naijue-release-contract-v1","migrationCount":26,"fontLicense":{"source":"apps/web/demo-replica/frontend/assets/fonts/LICENSE.txt","member":"web/source-styles/assets/fonts/LICENSE.txt"},"runtimeSqlPatches":[{"source":"adapters/postgres/patches/0026-v9-empty-history-publication-dispatch.sql","member":"patches/0026-v9-empty-history-publication-dispatch.sql"},{"source":"adapters/postgres/patches/0026-v11-document-specification-save.sql","member":"patches/0026-v11-document-specification-save.sql"},{"source":"adapters/postgres/patches/0026-v14-core-initialization.sql","member":"patches/0026-v14-core-initialization.sql"},{"source":"adapters/postgres/patches/0026-history-revision-current-base.sql","member":"patches/0026-history-revision-current-base.sql"},{"source":"adapters/postgres/patches/0026-category-reorder-undo.sql","member":"patches/0026-category-reorder-undo.sql"},{"source":"adapters/postgres/patches/0026-v19-barcode-scheme-initialization.sql","member":"patches/0026-v19-barcode-scheme-initialization.sql"},{"source":"adapters/postgres/patches/0026-v20-history-insert-source-identity.sql","member":"patches/0026-v20-history-insert-source-identity.sql"},{"source":"adapters/postgres/patches/0026-v22-staged-prefix-bind.sql","member":"patches/0026-v22-staged-prefix-bind.sql"},{"source":"adapters/postgres/patches/0026-history-responsible-null-successor.sql","member":"patches/0026-history-responsible-null-successor.sql"},{"source":"adapters/postgres/patches/0026-category-depth-successor.sql","member":"patches/0026-category-depth-successor.sql"},{"source":"adapters/postgres/patches/0026-history-revision-set-guards-successor.sql","member":"patches/0026-history-revision-set-guards-successor.sql"},{"source":"adapters/postgres/patches/0026-live-ledger-balance-pairs.sql","member":"patches/0026-live-ledger-balance-pairs.sql"},{"source":"adapters/postgres/patches/0026-history-draft-transfer-line-set-successor.sql","member":"patches/0026-history-draft-transfer-line-set-successor.sql"}],"full":{"profile":"source-confirmed-native-exact26-r3-v1","patchLevel":"26_hv2_history_set_guards_from_v22","catalogProfiles":{"legacy-v1":{"format":"EXACT26_RUNTIME_CATALOG_EXPORT_V1","patchLevel":"26_hv2_history_set_guards_from_v22","aclProofField":null},"complete-write-v6":{"format":"EXACT26_RUNTIME_CATALOG_EXPORT_V6","patchLevel":"26_hv2_history_set_guards_complete_write_xmin_from_v22","aclProofField":"complete_write_xmin_acl_match"},"recorded-live-ledger-v7":{"format":"EXACT26_RUNTIME_CATALOG_EXPORT_V7","patchLevel":"26_hv2_live_ledger_pairs_complete_write_xmin_from_v22","aclProofField":"complete_write_xmin_acl_match","observationProofField":"recorded_live_balance_contract_match","requiredObservation":"RECORDED_LIVE_LEDGER_PAIRS_V7","runtimeSqlPatch":"adapters/postgres/patches/0026-live-ledger-balance-pairs.sql"},"recorded-live-write-v8":{"format":"EXACT26_RUNTIME_CATALOG_EXPORT_V8","patchLevel":"26_hv2_live_pairs_complete_write_acl_v8_from_v7","aclProofField":"complete_write_system_acl_match_v8","deleteAclProofField":"normal_delete_acl_match_v8","observationProofField":"recorded_live_balance_contract_match","requiredObservation":"RECORDED_LIVE_LEDGER_PAIRS_COMPLETE_WRITE_V8","runtimeSqlPatch":"adapters/postgres/patches/0026-live-ledger-balance-pairs.sql"},"history-draft-line-set-v1":{"format":"EXACT26_RUNTIME_CATALOG_EXPORT_HISTORY_DRAFT_LINESET_V1","patchLevel":"26_hv2_history_draft_line_set_from_v8","aclProofField":"complete_write_system_acl_match_v8","deleteAclProofField":"normal_delete_acl_match_v8","observationProofField":"recorded_live_balance_contract_match","requiredObservation":"HISTORY_DRAFT_TRANSFER_LINE_SET_FROM_V8","runtimeSqlPatch":"adapters/postgres/patches/0026-history-draft-transfer-line-set-successor.sql"}}},"node":"24.21.0","requestBodyBudgets":[{"path":"/api/products/media/uploads","bytes":8388608},{"path":"/api/imported-history/sales/revise","bytes":4194304},{"path":"/api/imported-history/transfers/revise","bytes":4194304},{"path":"/api/products/commands","bytes":1048576},{"path":"/api/products/v2/commands","bytes":1048576},{"path":"/api/catalogue/categories/commands","bytes":1048576},{"path":"/api/sales/prepare-create","bytes":131072},{"path":"/api/sales/prepare-existing","bytes":131072},{"path":"/api/sales/commands","bytes":524288},{"path":"/api/transfers/prepare-create","bytes":131072},{"path":"/api/transfers/prepare-existing","bytes":131072},{"path":"/api/transfers/commands","bytes":524288}],"entrypoints":{"frontend":{"source":"apps/web/demo-replica/frontend/production-bootstrap.ts","member":"web/application.js"},"backend":{"source":"apps/api/src/production-main.ts","member":"backend/production-main.js"}},"exact35":{"profile":"source-confirmed-native-exact35-v1","migrationCount":27,"installationRecord":"/etc/naijue-erp/fresh35-combined-installation-v1.json","productionProfile":"source-confirmed-native-exact35-production-v2","productionNetworkMode":"OWNED_POSTGRES_SHARED_NAMESPACE_V1"},"native35":{"root":"backend/native35-source","entry":"tools/unified-import/fresh35-host-session.mjs","external":"./native35-source/tools/unified-import/fresh35-host-session.mjs","fixturePins":[{"path":"tests/fixtures/unified-import/synthetic-package.ts","sha256":"b751a49537d0144e109673e3a8ffd5f205e5e40880afadbac00634fbaa4a8b82"},{"path":"tests/fixtures/unified-import/whole-package-synthetic.ts","sha256":"4f7b4a7e2279302fc7114feb506dff301f0234b1fd8e05717b943a1fb13b9f7f"}],"boundaries":[{"entry":"tools/unified-import/fresh35-host-session.mjs","external":"./native35-source/tools/unified-import/fresh35-host-session.mjs","importers":["apps/api/src/postgres-read-api.ts","adapters/postgres/src/runtime27-command-issuer.ts","apps/api/src/capacity-runtime-probe.ts"]},{"entry":"scripts/release/unified-install/whole-sales-admission-v1.mjs","external":"./native35-source/scripts/release/unified-install/whole-sales-admission-v1.mjs","importers":["packages/application/src/unified-import-execution.ts","packages/application/src/unified-import-whole-package-profile.ts"]}]}}''')
R3_RELEASE_CONTRACT_SOURCE = json.loads(r'''{"path":"config/release-contract.json","bytes":7490,"sha256":"4d30d3f2b32116d83c302b6eef81015b4733d624d9abf09c3fd52d5082445456"}''')
# END GENERATED R3 RELEASE CONTRACT
HISTORICAL_SOURCE = Path('/release-review/location-35c1d80aca')
HISTORICAL_MOUNT = '/release-review/location-e24b037445'
CURRENT_SERVICE_MOUNT = '/release-review/location-55b5a943b4'
CURRENT_SERVICE_ENV = 'NAIJUE_CURRENT_PRODUCTION_SERVICE_SHA256'
CURRENT_ORDINARY_ENTRY = 'tools/unified-import/fresh35-host-session.mjs'
CURRENT_ORDINARY_SHA256 = 'e6d8b7197a34968cf73efb1e5323dd1eb9ac4a83e0b9efcd629a9531659a4887'
CURRENT_APP_NATIVE_SET = 'd18701505f7e90c7736514ad76d08df5f620578b4d4ccc39fd138e954f8b67e3'
CONFIG_BASELINE_NAME = 'runtime-configuration-baseline.private.json'
CONFIG_ARCHIVE_NAME = 'app-media-config.protected.tar'
FIRST_INSTALL_IMPORT_PACKAGE = '1e1e495ad7177b64be65620f3e15a632405e738a1d076e9173e77b282fb3eec9'
FIRST_INSTALL_EXCLUDED_SYSTEM_IDS = {'1021005521121032611', '1230140533921406605'}
FIRST_INSTALL_NPM_CACHE_KEY = 'app576-c0997c16-npm119-cache-20261110-01'
FIRST_INSTALL_NPM_CACHE_SHA256 = '4554097ef04043ea70fddb3b4956bbfebb353cfb46ace42b7cdc6f1ba33b870f'
FIRST_INSTALL_NPM_CACHE_BYTES = 15_064_708
FIRST_INSTALL_NPM_CACHE_MANIFEST = '0a7257bd760c85e0af5a863a6e3283d8e5c33810a3ab676cb140fb9dc9942da6'
FIRST_INSTALL_PACKAGE_SHA256 = 'df132518fffedcac3dd2842f773de1f191b563a12887788a06c196a4ce753902'
FIRST_INSTALL_LOCK_SHA256 = 'c0997c162a31b22a6e2c01c75fe777ff5a68c740994e6765eb3180b11c108048'
NPM_CACHE_MEMBER = re.compile(r'_cacache/(?:index-v5/[a-f0-9]{2}/[a-f0-9]{2}/[a-f0-9]{60}|'
                              r'content-v2/sha512/[a-f0-9]{2}/[a-f0-9]{2}/[a-f0-9]{124})\Z')


_base_native35_member_map = native35_member_map
_base_member_allowed = member_allowed
_base_validate_runtime_build = validate_runtime_build
_base_validate_private_runtime_resources = validate_private_runtime_resources
_base_credential_key_binding = credential_key_binding
_base_capacity_install_content = capacity_install_content
_base_same_inode_runtime_write = same_inode_runtime_write
_base_assert_own = assert_own
_base_health = health


def first_install(p):
    return p.get('entryMode') == FIRST_INSTALL_MODE


def first_install_r3(p):
    return first_install(p) and p.get('sourceCommit') == FIRST_R3_APP_COMMIT


class R3NativeMembers(dict):
    """Exact R3 manifest passed the stylesheet registration check."""


def first_install_references(p):
    native = p.get('firstInstall')
    keys = {'restorationBuildReview', 'currentProductionService', 'runtimeConfigurationProof'}
    if first_install_r3(p):
        keys.add('r3')
    need(type(native) is dict and set(native) == keys,
         'FIRST_INSTALL_CLOSED_PROTECTED_REFERENCES_REQUIRED')
    if first_install_r3(p):
        need(type(native['r3']) is dict and set(native['r3']) ==
             {'admin154Record', 'sql38Record', 'serviceAuthorization', 'serviceRetained',
              'serviceRetainedAck', 'artifactReady'},
             'FIRST_INSTALL_R3_PROTECTED_REFERENCES_REQUIRED')
    return native


def first_install_reference_bytes(ref, *, filename, group=None, limit=65536, public_mode=None):
    need(type(ref) is dict and set(ref) == {'path', 'sha256'} and
         isinstance(ref['sha256'], str) and HASH.fullmatch(ref['sha256']), 'FIRST_INSTALL_EXACT_PROTECTED_REFERENCE_REQUIRED')
    private = group is None and public_mode is None
    path = canonical(ref['path'], private=private, root=Path('/release-review/location-58c98b29b3'))
    before = path.lstat()
    need(path.name == filename and before.st_uid == 0 and
         all(q.lstat().st_uid == 0 and not q.lstat().st_mode & 0o022 for q in path.parents) and
         (group is None or (before.st_gid, stat.S_IMODE(before.st_mode)) == (group, 0o440)) and
         (public_mode is None or stat.S_IMODE(before.st_mode) == public_mode),
         'FIRST_INSTALL_OS_PROTECTED_REFERENCE_REQUIRED')
    def identity(st):
        return (st.st_dev,st.st_ino,st.st_size,st.st_uid,st.st_gid,st.st_mode,st.st_nlink,st.st_mtime_ns,st.st_ctime_ns)
    data = bytes_file(path, limit, private=private)
    need(identity(before) == identity(path.lstat()) and 0 < len(data) and digest(data) == ref['sha256'],
         'FIRST_INSTALL_PROTECTED_REFERENCE_CHANGED')
    return path, data


def first_install_reference(ref, *, filename, group=None):
    path, data = first_install_reference_bytes(ref, filename=filename, group=group)
    return path, data, capacity_transport_json(data)


def current_app_native_source(historical):
    # db624fea changes the sole native closure member below. The ordinary
    # consumer and the installed source are checked as two separate closures.
    need(type(historical) is dict and historical.get('sourceSetSha256') == FIRST_INSTALL_NATIVE_SET
         and type(historical.get('currentSourcePins')) is list, 'FIRST_INSTALL_HISTORICAL_SOURCE_REQUIRED')
    pins = historical['currentSourcePins']
    need(sum(pin['path'] == CURRENT_ORDINARY_ENTRY for pin in pins) == 1,
         'FIRST_INSTALL_HISTORICAL_SOURCE_REQUIRED')
    current = [({**pin, 'sha256': CURRENT_ORDINARY_SHA256} if pin['path'] == CURRENT_ORDINARY_ENTRY else pin) for pin in pins]
    old = {pin['path']: pin['sha256'] for pin in historical['capturedSourcePins']}
    delta = [{'path': pin['path'], 'predecessorSha256': old.get(pin['path']), 'currentSha256': pin['sha256']}
             for pin in current if old.get(pin['path']) != pin['sha256']]
    binding = {key: historical[key] for key in ('format', 'baseArtifacts', 'capturedSourcePins',
                                               'currentSourcePins', 'currentSourceDelta', 'patches')}
    binding.update(currentSourcePins=current, currentSourceDelta=delta)
    current_sha = digest(json.dumps(binding,ensure_ascii=False,separators=(',', ':'),allow_nan=False).encode())
    need(current_sha==CURRENT_APP_NATIVE_SET, 'FIRST_INSTALL_EXACT_CURRENT_APP_NATIVE_SOURCE_REQUIRED')
    return {**historical, **binding, 'sourceSetSha256':current_sha}


def native35_member_map(manifest, source=None):
    commit = manifest.get('sourceCommit')
    if app289_selected(manifest):
        if source is not None:
            need(isinstance(source, dict) and source.get('sourceSetSha256') == FIRST_R3_INSTALLED_SET,
                 'FIRST_INSTALL_R3_EXACT_INSTALLED_SOURCE_REQUIRED')
        return R3NativeMembers(_base_native35_member_map(manifest, source))
    if commit in (FIRST_R3_APP_COMMIT, FORMAL_R3_APP['sourceCommit'], FORMAL_R3_FINAL33_APP['sourceCommit']):
        # The fixed D2 release is a different source closure from installed 152.
        # Each stage has its own immutable app pins.
        pins = formal_r3_app(manifest)
        formal = commit == pins['sourceCommit']
        manifest_sha = pins['normalizedManifestSha256'] if formal else FIRST_R3_CANONICAL_MANIFEST
        source_set = pins['nativeSourceSetSha256'] if formal else FIRST_R3_APP_SET
        need(manifest_sha is not None and digest(encoded(manifest)) == manifest_sha and
             type(source) is dict and source.get('sourceSetSha256') == FIRST_R3_INSTALLED_SET,
             'FIRST_INSTALL_R3_EXACT_APP_AND_INSTALLED_SOURCE_REQUIRED')
        native = manifest['native35']
        need(native['sourceProfile'] == 'FRESH35_COMPACT_ZERO_SOURCE_V2' and
             native['sourceSetSha256'] == source_set and len(native['pins']) == (pins.get('nativeClosureMembers', 223) if formal else 223),
             'FIRST_INSTALL_R3_EXACT_APP_CLOSURE_REQUIRED')
        rows = {row['path']:row for row in manifest['members'] if row['role']=='native35'}
        contract = R3_RELEASE_CONTRACT['native35']
        expected = {contract['root']+'/'+pin['path']:pin['sha256'] for pin in native['pins']}
        need({name:row['sha256'] for name,row in rows.items()} == expected,
             'FIRST_INSTALL_R3_EXACT_APP_MEMBER_BINDING_REQUIRED')
        need(all(expected.get(contract['root']+'/'+pin['path']) == pin['sha256'] for pin in contract['fixturePins']),
             'FIRST_INSTALL_R3_EXACT_APP_FIXTURE_REQUIRED')
        styles = [row for row in manifest['members'] if row['path'] == R3_UI_TOKENS]
        need(len(styles) == 1 and styles[0]['role'] == 'frontend',
             'FIRST_INSTALL_R3_EXACT_FRONTEND_STYLE_REQUIRED')
        return R3NativeMembers(rows)
    if manifest.get('sourceCommit') == FIRST_INSTALL_APP_COMMIT:
        source = current_app_native_source(source)
    return _base_native35_member_map(manifest, source)


def member_allowed(name, approvedPatchMap=None, nativeMembers=None):
    if name == R3_UI_TOKENS and isinstance(nativeMembers, R3NativeMembers):
        return
    return _base_member_allowed(name, approvedPatchMap, nativeMembers)


def validate_runtime_build(p, manifest, refs):
    if app289_selected(p):
        return _base_validate_runtime_build(p, manifest, refs)
    if not first_install_r3(p) and p.get('sourceCommit') != formal_r3_app(p)['sourceCommit']:
        return _base_validate_runtime_build(p, manifest, refs)
    # Reuse the checked base validator with R3 inputs without changing the
    # shared contract used by legacy paths or the approved base helper bytes.
    r3_globals = dict(globals(), RELEASE_CONTRACT=R3_RELEASE_CONTRACT,
                      RELEASE_CONTRACT_SOURCE=R3_RELEASE_CONTRACT_SOURCE)
    validate = FunctionType(_base_validate_runtime_build.__code__, r3_globals)
    return validate(p, manifest, refs)


def credential_key_binding(p):
    if not first_install_r3(p) and p.get('sourceCommit') != formal_r3_app(p)['sourceCommit']:
        return _base_credential_key_binding(p)
    native = p['runtime35']
    key = native['credentialRequestKey']
    need(type(key) is dict and set(key) == {'hostFile', 'containerFile'} and
         key.get('containerFile') == '/release-review/location-f573618dce',
         'R3_EXACT_STAFF_CREDENTIAL_CONTAINER_FILE_REQUIRED')
    legacy_view = {**p, 'runtime35': {**native, 'credentialRequestKey':
                   {**key, 'containerFile': '/release-review/location-d69e61c5ec'}}}
    binding = _base_credential_key_binding(legacy_view)
    return {**binding, 'containerFile': key['containerFile']}


def validate_private_runtime_resources(p):
    if not first_install_r3(p) and p.get('sourceCommit') != formal_r3_app(p)['sourceCommit']:
        return _base_validate_private_runtime_resources(p)
    native = p['runtime35']
    media = native['media']
    need(media.get('containerRoot') == '/private/media', 'FORMAL_R3_EXACT_MEDIA_MOUNT_REQUIRED')
    # All original host path, resource isolation and credential checks still
    # apply. The formal image has a separately fixed container destination.
    legacy_view = {**p,'runtime35':{**native,'media':{**media,'containerRoot':'/release-review/location-3170d020a9'}}}
    return _base_validate_private_runtime_resources(legacy_view)


def formal_app_plan(p, application):
    """Validate only the formal owner APP. The finite 09 plan is separate."""
    if public_http_mode(p) is not None:
        verify_nginx_configuration(p)
    pins = formal_r3_app(p)
    refs = p['runtime35']['references']
    need(exact35_selected(p) and p.get('sourceCommit') == pins['sourceCommit']
         and p.get('buildId') == pins['buildId']
         and Path(p['releaseDirectory']) == ROOT/'releases'/pins['buildId']
         and p['archive'].get('sha256') == pins['archiveSha256']
         and p['archive'].get('bytes') == pins['archiveBytes']
         and p['manifest'].get('sha256') == pins['manifestSha256']
         and p['packReceipt'].get('sha256') == pins['packReceiptSha256']
         and application['runtimeTemplate'].get('sha256') == pins['runtimeTemplateSha256']
         and refs['installationRecord'].get('sha256') == FIRST_R3_INSTALLED_RECORD
         and all(refs[key].get('sha256') == pins[key+'Sha256']
                 for key in ('sourceManifest','buildManifest','buildReceipt')),
         'FORMAL_R3_EXACT_FAA8_APP_PLAN_REQUIRED')
    installed = application.get('installedPayloadSha256')
    identity = application.get('linuxDependencyRootIdentity')
    need(isinstance(installed,str) and HASH.fullmatch(installed)
         and installed != pins['archivePayloadWithoutDependenciesSha256']
         and isinstance(application.get('linuxDependencyResultSha256'),str)
         and HASH.fullmatch(application['linuxDependencyResultSha256'])
         and type(identity) is dict and set(identity)=={'device','inode','uid','gid','mode'}
         and all(type(v) is int and v>=0 for v in identity.values()) and identity['inode']>0,
         'FORMAL_R3_LINUX_INSTALLED_PAYLOAD_REQUIRED')
    manifest = reference(p['manifest'], pins['manifestBytes'])
    pack = reference(p['packReceipt'])
    need(pack.get('status') == 'PACKED_AND_EXTRACTED_READBACK_MATCH'
         and pack.get('archiveExtractions') == 1 and pack.get('members') == pins.get('packedMembers', 462)
         and pack.get('sourceCommit') == p['sourceCommit'] and pack.get('buildId') == p['buildId']
         and pack.get('manifestSha256') == pins['manifestSha256']
         and pack.get('archive', {}).get('sha256') == pins['archiveSha256']
         and pack['archive'].get('bytes') == pins['archiveBytes'],
         'FORMAL_R3_EXACT_FAA8_PACK_RECEIPT_REQUIRED')
    validate_runtime_build(p,manifest,refs)
    template = reference(application['runtimeTemplate'])
    media = p['runtime35']['media']
    need(template.get('build') == {k:p[k] for k in ('sourceCommit','buildId')}
         and 'productionGeneration' in template and template['productionGeneration'] is None
         and 'capacityLaunch' not in template and template['postgres']['target']['password'] is None
         and template.get('productMedia') == {'root':media['containerRoot'],'rootKey':media['rootKey']},
         'FORMAL_R3_EXACT_FAA8_TEMPLATE_REQUIRED')


def linux_dependency_identity(dependencies):
    need(dependencies.is_dir() and not dependencies.is_symlink(),'FORMAL_R3_ACTUAL_LINUX_MODULES_REQUIRED')
    s = canonical(dependencies,kind='directory').lstat()
    return {'device':s.st_dev,'inode':s.st_ino,'uid':s.st_uid,'gid':s.st_gid,'mode':stat.S_IMODE(s.st_mode)}


def linux_dependency_rows(root):
    dependencies = root/'node_modules'
    rows = []
    total = 0
    for directory, dirs, files in os.walk(dependencies,followlinks=False):
        for name in dirs:
            canonical(Path(directory)/name,kind='directory')
        for name in files:
            path = Path(directory)/name
            data = bytes_file(path,64*1024**2)
            rows.append({'path':str(path.relative_to(root)),'bytes':len(data),'sha256':digest(data)})
            total += len(data)
            need(len(rows)<19500 and total<=1024**3,'FORMAL_R3_LINUX_DEPENDENCY_TREE_LIMIT')
    paths = {row['path']:row['sha256'] for row in rows}
    need(all('node_modules/'+name+'/package.json' in paths for name in ('fastify','pg','sharp'))
         and all(paths.get(path)==sha for path,sha in FORMAL_LINUX_NATIVE.items()),
         'FORMAL_R3_ACTUAL_LINUX_MODULES_REQUIRED')
    return rows


def verify_formal_linux_payload(p, application, manifest, ops):
    """Read the original dependency install and the exact two read-only APP mounts."""
    terminal_raw = ops.read_file(FORMAL_LINUX_TERMINAL,65536,False,False)
    result_raw = ops.read_file(FORMAL_LINUX_RESULT,65536,True)
    terminal, result = ops.strict(terminal_raw), ops.strict(result_raw)
    need(digest(terminal_raw)==FORMAL_LINUX_TERMINAL_SHA
         and digest(result_raw)==application['linuxDependencyResultSha256']
         and terminal.get('jobId')==result.get('jobId')==FORMAL_LINUX_JOB
         and terminal.get('taskId')=='T45' and terminal.get('status')=='COMPLETED'
         and terminal.get('exitCode')==0 and 'linux-dependency-result.json' in terminal.get('exports',[])
         and result.get('status')=='PASS_REAL_LINUX_OFFLINE_NPM_AND_THREE_MODULE_LOAD_ONLY'
         and all(result.get(k)==0 for k in ('containerExitCode','npmExitCode','loadExitCode','pgConnections','listeners','builds'))
         and result.get('containerRemoved') is True and result.get('privateWritableCacheRemoved') is True
         and result.get('cacheInputUnchanged') is True and result.get('network')=='none'
         and result.get('node')=='24.21.0' and result.get('npm')=='11.9.0'
         and result.get('nodeSha256')=='7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c'
         and result.get('probe',{}).get('status')=='PASS'
         and result['probe'].get('modules')=={'fastify':'5.12.5','pg':'8.23.1','sharp':'0.35.5'}
         and result.get('payloadDirectory')==str(FORMAL_LINUX_PAYLOAD)
         and result.get('nativeArtifacts')==FORMAL_LINUX_NATIVE
         and result.get('packageSha256')==FIRST_INSTALL_PACKAGE_SHA256
         and result.get('lockSha256')==FIRST_INSTALL_LOCK_SHA256
         and p['images']['node']['id']==FORMAL_LINUX_IMAGE,
         'FORMAL_R3_ORIGINAL_LINUX_INSTALL_RECEIPT_REQUIRED')
    old_root = ops.trusted(FORMAL_LINUX_PAYLOAD.parent)
    need(stat.S_IMODE(old_root.lstat().st_mode)==0o700,'FORMAL_R3_LINUX_INSTALL_ROOT_CHANGED')
    release = Path(p['releaseDirectory'])/'payload'
    pins = formal_r3_app(p)
    embedded = bytes_file(release/'release-manifest.json',pins['manifestBytes'])
    need(len(embedded)==pins['manifestBytes'] and digest(embedded)==pins['manifestSha256'],
         'FORMAL_R3_EMBEDDED_RELEASE_MANIFEST_CHANGED')
    # The nested read-only bind uses a pre-existing empty directory. Docker
    # need not create a mountpoint in the mounted FAA8 archive tree.
    mountpoint = canonical(release/'node_modules',kind='directory')
    need(mountpoint.lstat().st_uid==0 and not any(mountpoint.iterdir()),
         'FORMAL_R3_EMPTY_DEPENDENCY_MOUNTPOINT_REQUIRED')
    need(payload_identity(release,manifest)==pins['archivePayloadWithoutDependenciesSha256'],
         'FORMAL_R3_APPROVED_ARCHIVE_TREE_CHANGED')
    need(all(file_hash(root/name)==sha for root in (release,FORMAL_LINUX_PAYLOAD)
             for name,sha in (('package.json',FIRST_INSTALL_PACKAGE_SHA256),('package-lock.json',FIRST_INSTALL_LOCK_SHA256))),
         'FORMAL_R3_LINUX_INSTALL_PACKAGE_LOCK_CHANGED')
    rows = [{'path':row['path'],'bytes':row['bytes'],'sha256':row['sha256']} for row in manifest['members']]
    rows.append({'path':'release-manifest.json','bytes':len(embedded),'sha256':digest(embedded)})
    deps = FORMAL_LINUX_PAYLOAD/'node_modules'
    expected = application['linuxDependencyRootIdentity']
    need(linux_dependency_identity(deps)==expected,'FORMAL_R3_LINUX_DEPENDENCY_ROOT_CHANGED')
    rows.extend(linux_dependency_rows(FORMAL_LINUX_PAYLOAD))
    need(linux_dependency_identity(deps)==expected
         and digest(encoded(sorted(rows,key=lambda row:row['path'])))==application['installedPayloadSha256'],
         'FORMAL_APP_APPROVED_PAYLOAD_CHANGED')
    return deps


def r3_protected_record(ref, path, mode):
    need(type(ref) is dict and set(ref)=={'path','sha256'} and ref['path']==str(path)
         and isinstance(ref['sha256'],str) and HASH.fullmatch(ref['sha256']),
         'FIRST_INSTALL_R3_EXACT_ORIGINAL_REFERENCE_REQUIRED')
    path=canonical(path,root=FIRST_R3_ROOT)
    before=path.lstat()
    need(before.st_uid==0 and stat.S_IMODE(before.st_mode)==mode and
         all(q.lstat().st_uid==0 and not q.lstat().st_mode&0o022 for q in path.parents),
         'FIRST_INSTALL_R3_PROTECTED_FILE_IDENTITY_REQUIRED')
    raw=bytes_file(path,65536,private=not mode&0o077)
    after=path.lstat()
    fields=('st_dev','st_ino','st_uid','st_gid','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
    need(tuple(getattr(before,k) for k in fields)==tuple(getattr(after,k) for k in fields)
         and digest(raw)==ref['sha256'],'FIRST_INSTALL_R3_PROTECTED_RECORD_CHANGED')
    return raw


def r3_service_validator():
    path=Path(__file__).with_name('normal_service09_after_cold_proof.py')
    raw=bytes_file(path,65536)
    need(digest(raw)==FIRST_R3_PROOF_VALIDATOR_SHA,'FIRST_INSTALL_R3_EXACT_SERVICE_VALIDATOR_REQUIRED')
    module=ModuleType('fixed_r3_service09_proof')
    exec(compile(raw,str(path),'exec'),module.__dict__)
    return module


def r3_current_production_service(p, record, *, retained_history=False):
    native=first_install_references(p)
    refs=native['r3']
    current=r3_protected_record(native['currentProductionService'],FIRST_R3_CURRENT,0o444)
    proof=capacity_transport_json(current)
    auth=r3_protected_record(refs['serviceAuthorization'],FIRST_R3_SERVICE_BOOT/'service-start-authorization.json',0o400)
    retained=r3_protected_record(refs['serviceRetained'],FIRST_R3_SERVICE_BOOT/'service-retained.json',0o600)
    parent=r3_protected_record(refs['admin154Record'],FIRST_R3_ADMIN,0o644)
    successor=r3_protected_record(refs['sql38Record'],FIRST_R3_SQL38,0o644)
    install_ref=p['runtime35']['references']['installationRecord']
    need(install_ref['path']==RELEASE_CONTRACT['exact35']['installationRecord'],
         'FIRST_INSTALL_R3_EXACT_152_RECORD_REQUIRED')
    installed=bytes_file(install_ref['path'],65536)
    need(digest(installed)==install_ref['sha256'] and capacity_transport_json(installed)==record,
         'FIRST_INSTALL_R3_EXACT_152_RECORD_REQUIRED')
    source=capacity_transport_json(auth)
    need(source.get('proofSourceSha256')==FIRST_R3_PROOF_VALIDATOR_SHA,
         'FIRST_INSTALL_R3_EXACT_SERVICE_VALIDATOR_REQUIRED')
    built=r3_service_validator().build(installed,auth,retained,proof['checkedAt'],parent,successor)
    shared=proof['sharedPostgresNamespace']
    ack=r3_protected_record(refs['serviceRetainedAck'],FIRST_R3_SERVICE_BOOT/'retained-ack.json',0o600)
    checked_now=time.time()*1000
    need(built==current and p['runtime35'].get('sharedPostgresNamespace')==shared and
         p['names']['app']==FIRST_R3_APP and FIRST_R3_APP in shared['container']['frontEndpoint']['aliases'] and
         proof['checkedAt']<=checked_now and proof['checkedAt']<shared['serviceLeaseExpiresAt'] and
         (retained_history or checked_now<shared['serviceLeaseExpiresAt']) and
         capacity_transport_json(ack)=={'requestKey':FIRST_R3_SERVICE,'proofSha256':digest(current),
                                        'serviceLeaseExpiresAt':shared['serviceLeaseExpiresAt']},
         'FIRST_INSTALL_R3_ACTUAL_CURRENT_SERVICE_REQUIRED')
    return FIRST_R3_CURRENT,proof


def current_production_service(p, record=None):
    if first_install_r3(p):
        return r3_current_production_service(p,runtime35_record(p) if record is None else record)
    ref = first_install_references(p)['currentProductionService']
    gid = int(p['limits']['app']['user'].split(':')[1])
    path, data, proof = first_install_reference(ref, filename='current-production-service.json', group=gid)
    keys = {'format','requestKey','oldStopRequestKey','authorizationSha256','checkedAt','installationRecordSha256',
            'targetSha256','sourceSetSha256','previousStopReceiptSha256','previousStopTerminalSha256','dataDirectory',
            'dataDirectoryIdentity','physical','sharedPostgresNamespace','postmaster','guardian','runtimeRole','runtimeLoginValidUntil'}
    need(type(proof) is dict and set(proof) == keys and proof['format'] == 'FRESH35_CURRENT_PRODUCTION_SERVICE_V1'
         and encoded(proof) == data, 'FIRST_INSTALL_CURRENT_SERVICE_FORMAT_REQUIRED')
    record = runtime35_record(p) if record is None else record
    target = record['target']
    proposal, historical = target['proposal'], target['physical']
    refs = p['runtime35']['references']
    hashes = ('installationRecordSha256','targetSha256','sourceSetSha256')
    need(record['format'] == 'FRESH35_COMBINED_INSTALLATION_RECORD_V2' and target['purpose'] == 'PRODUCTION_NEW_EMPTY_EXACT35'
         and proposal == {'workspaceDirectory': FIRST_R2_WORKSPACE,'database':'erp_fresh35_20261110_r2','host':'127.0.0.1',
                          'port':56791, **{role:'erp35_'+role+'_20261110_r2' for role in ('admin','owner','controller','runtime')}}
         and proof['runtimeRole'] == proposal['runtime'] and proof['dataDirectory'] == FIRST_R2_WORKSPACE+'/data'
         and all(isinstance(proof[k],str) and HASH.fullmatch(proof[k]) for k in (*hashes,'authorizationSha256',
             'previousStopReceiptSha256','previousStopTerminalSha256'))
         and proof['installationRecordSha256'] == refs['installationRecord']['sha256']
         and proof['targetSha256'] == record['binding']['targetSha256']
         and proof['sourceSetSha256'] == record['binding']['sourceSetSha256'] == FIRST_INSTALL_NATIVE_SET
         and all(isinstance(proof[k],str) and re.fullmatch(r't45-first-20261110-r2-recovery-'+phase+r'-[0-9]{8}-[0-9]{2}', proof[k])
                 for k,phase in (('requestKey','restart'),('oldStopRequestKey','stop'))),
         'FIRST_INSTALL_CURRENT_SERVICE_PROVENANCE_DIFFERS')
    ordinary = target['ordinary']
    need(ordinary['connectHost']==ordinary['serverAddress']==proposal['host'] and
         ordinary['connectPort']==ordinary['serverPort']==proposal['port'] and
         ordinary['referenceDirectory']==HISTORICAL_MOUNT+'/reference-inputs', 'EXACT35_SHARED_LOOPBACK_ENDPOINT_REQUIRED')
    directory = proof['dataDirectoryIdentity']
    need(type(directory) is dict and set(directory) == {'device','inode','uid','gid','mode'}
         and (directory['uid'],directory['gid'],directory['mode']) == (61035,61035,0o700)
         and all(capacity_number(directory[k]) for k in ('device','inode')), 'FIRST_INSTALL_CURRENT_SERVICE_PGDATA_DIFFERS')
    for process in (proof['postmaster'],proof['guardian']):
        need(type(process) is dict and set(process)=={'pid','starttime','exe'} and capacity_number(process['pid'])
             and isinstance(process['starttime'],str) and re.fullmatch(r'[1-9][0-9]*',process['starttime'])
             and isinstance(process['exe'],str) and process['exe'].startswith('/') and process['exe']!='/'
             and process['exe']==os.path.normpath(process['exe']) and not re.search(r'[\x00-\x1f\x7f]',process['exe']),
             'FIRST_INSTALL_CURRENT_SERVICE_PROCESS_REQUIRED')
    need(proof['postmaster']['pid']!=proof['guardian']['pid'], 'FIRST_INSTALL_CURRENT_SERVICE_PROCESS_REQUIRED')
    shared = proof['sharedPostgresNamespace']
    need(type(shared) is dict and set(shared)=={'format','container','creationOperationId','sourceSetSha256','targetSha256',
            'installationRecordSha256','serviceLeaseExpiresAt'} and shared==p['runtime35'].get('sharedPostgresNamespace')
         and shared['format']==RELEASE_CONTRACT['exact35']['productionNetworkMode']
         and all(shared[k]==proof[k] for k in hashes)
         and isinstance(shared['creationOperationId'],str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,95}',shared['creationOperationId']),
         'FIRST_INSTALL_CURRENT_SERVICE_NAMESPACE_DIFFERS')
    c = shared['container']
    need(type(c) is dict and set(c)=={'id','name','imageId','startedAt','hostPid','startTicks','networkNamespace','frontEndpoint'}
         and isinstance(c['id'],str) and HASH.fullmatch(c['id']) and isinstance(c['imageId'],str) and IMAGE.fullmatch(c['imageId'])
         and c['name']==FIRST_R2_CARRIER and capacity_number(c['hostPid']) and c['hostPid']>1
         and isinstance(c['startTicks'],str) and re.fullmatch(r'[1-9][0-9]*',c['startTicks']),
         'EXACT35_PG_CARRIER_IDENTITY_REQUIRED')
    namespace, endpoint = c['networkNamespace'], c['frontEndpoint']
    need(type(namespace) is dict and set(namespace)=={'device','inode'} and all(capacity_number(n) for n in namespace.values())
         and type(endpoint) is dict and set(endpoint)=={'id','aliases'} and isinstance(endpoint['id'],str) and HASH.fullmatch(endpoint['id'])
         and type(endpoint['aliases']) is list and all(isinstance(alias,str) and alias for alias in endpoint['aliases'])
         and len(set(endpoint['aliases']))==len(endpoint['aliases']) and FIRST_R2_APP==p['names']['app'] and FIRST_R2_APP in endpoint['aliases'],
         'EXACT35_PINNED_FRONT_ENDPOINT_REQUIRED')
    physical = proof['physical']
    need(type(physical) is dict and set(physical)==set(historical)=={'systemIdentifier','databaseOid','serverVersionNum','postmasterStart'}
         and all(physical[k]==historical[k] for k in ('systemIdentifier','databaseOid','serverVersionNum'))
         and physical['serverVersionNum']=='170011', 'FIRST_INSTALL_CURRENT_SERVICE_PHYSICAL_DIFFERS')
    def utc_ms(value, pattern):
        need(isinstance(value,str) and re.fullmatch(pattern,value), 'FIRST_INSTALL_CURRENT_SERVICE_UTC_REQUIRED')
        iso = value.replace('Z','+00:00')
        if iso.endswith('+00'):
            iso += ':00'
        iso = re.sub(r'\.(\d{1,9})(?=\+)', lambda m: '.'+m[1][:6].ljust(6,'0'), iso)
        try:
            return dt.datetime.fromisoformat(iso).timestamp()*1000
        except ValueError:
            raise Refused('FIRST_INSTALL_CURRENT_SERVICE_UTC_REQUIRED') from None
    pg_stamp = r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?\+00'
    iso_stamp = r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z'
    birth = utc_ms(physical['postmasterStart'],pg_stamp)
    prior = utc_ms(historical['postmasterStart'],pg_stamp)
    carrier_birth = utc_ms(c['startedAt'],r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z')
    login = utc_ms(proof['runtimeLoginValidUntil'],iso_stamp)
    lease = shared['serviceLeaseExpiresAt']
    need(capacity_number(lease) and capacity_number(proof['checkedAt']) and
         target['expiresAt'] < birth and prior < birth and carrier_birth <= birth <= proof['checkedAt'] <= time.time()*1000 < lease <= login,
         'FIRST_INSTALL_CURRENT_SERVICE_WINDOW_REQUIRED')
    return path, proof


def production_shared_namespace_binding(p):
    return current_production_service(p)[1]['sharedPostgresNamespace']


def r3_app_evidence(p):
    finite_r3_app_binding(p)
    archive=p['archive']
    stage=Path(archive['path']).parent
    need(re.fullmatch(r'/release-review/location-a62f6f3b73[a-f0-9]{16}/artifacts/'+FIRST_R3_ARTIFACT,
                      str(stage)) and archive['path']==str(stage/'archive.bin'),
         'FIRST_INSTALL_R3_ORIGINAL_ARTIFACT_PATH_REQUIRED')
    ready=first_install_references(p)['r3']['artifactReady']
    ready_path=stage/'ready.json'
    need(type(ready) is dict and set(ready)=={'path','sha256'} and ready['path']==str(ready_path),
         'FIRST_INSTALL_R3_EXACT_ARTIFACT_RECEIPT_REQUIRED')
    for path,kind in ((stage,'directory'),(stage/'archive.bin','file'),(ready_path,'file')):
        need(canonical(path,kind=kind,private=True).lstat().st_uid==1000,
             'FIRST_INSTALL_R3_ARTIFACT_RECEIVER_OWNER_CHANGED')
    actual=reference(ready,65536)
    st=(stage/'archive.bin').lstat()
    need(actual.get('status')=='READY' and actual.get('artifactKey')==FIRST_R3_ARTIFACT and
         actual.get('archiveSha256')==FIRST_R3_ARCHIVE and actual.get('archiveBytes')==st.st_size==FIRST_R3_ARCHIVE_BYTES and
         actual.get('sourceSetSha256')==FIRST_R3_APP_SET and actual.get('stagingMode')=='BOUNDED_ORDINARY_FRESH_V1' and
         actual.get('fileIdentity')==[st.st_dev,st.st_ino,st.st_size,st.st_mtime_ns,st.st_ctime_ns],
         'FIRST_INSTALL_R3_ARTIFACT_RECEIPT_OR_IDENTITY_CHANGED')


def finite_r3_app_binding(p):
    archive=p['archive'];manifest=p['manifest']
    need(all((FIRST_R3_BUILD,FIRST_R3_ARCHIVE,FIRST_R3_ARCHIVE_BYTES,
              FIRST_R3_MANIFEST,FIRST_R3_CANONICAL_MANIFEST,FIRST_R3_ARTIFACT)),
         'FIRST_INSTALL_R3_SUCCESSOR_ARTIFACT_REVIEW_REQUIRED')
    need(first_install_r3(p) and p['buildId']==FIRST_R3_BUILD and archive.get('sha256')==FIRST_R3_ARCHIVE and
         archive.get('bytes')==FIRST_R3_ARCHIVE_BYTES and manifest.get('sha256')==FIRST_R3_MANIFEST,
         'FIRST_INSTALL_R3_EXACT_SEALED_7E66_REQUIRED')


def r3_lineage_environment(p):
    native=first_install_references(p)
    refs=native['r3']
    parent=capacity_transport_json(r3_protected_record(refs['admin154Record'],FIRST_R3_ADMIN,0o644))
    return {
        CURRENT_SERVICE_ENV: native['currentProductionService']['sha256'],
        'NAIJUE_ADMIN154_SUCCESSOR_SHA256': refs['admin154Record']['sha256'],
        'NAIJUE_ADMIN154_PARENT_SOURCE_SHA256': parent['successor']['sourceSetSha256'],
        'NAIJUE_ADMIN154_PARENT_CATALOG_SPEC_SHA256': parent['successor']['catalogSpecSha256'],
        'NAIJUE_COMPACT_ZERO_SUCCESSOR_SHA256': refs['sql38Record']['sha256'],
    }


def runtime35_readonly_mount_arguments(p):
    path, _ = current_production_service(p)
    history = canonical(HISTORICAL_SOURCE, kind='directory')
    original = history.lstat()
    need((original.st_dev,original.st_ino)==(66304,13240826) and
         all(q.lstat().st_uid==0 and not q.lstat().st_mode & 0o022 for q in (*history.parents,history)),
         'FIRST_INSTALL_HISTORICAL_SOURCE_ROOT_CHANGED')
    manifest = reference(p['manifest'],16*1024*1024)
    refs = history/'reference-inputs'
    index = bytes_file(refs/'INDEX.json',16*1024*1024)
    need(digest(index)==manifest.get('native35',{}).get('referenceIndexSha256'), 'EXACT35_REFERENCE_INDEX_CHANGED')
    rows = capacity_transport_json(index)
    need(type(rows) is list and len(rows)==len(EXACT35_REFERENCE_INPUTS), 'EXACT35_REFERENCE_INDEX_REQUIRED')
    seen = set()
    for row in rows:
        need(type(row) is dict and isinstance(row.get('package_path'),str) and type(row.get('bytes')) is int
             and 0<row['bytes']<=16*1024*1024, 'EXACT35_REFERENCE_INDEX_REQUIRED')
        name = row['package_path'].removeprefix('delivery/reference-inputs/')
        need(name not in seen and name in EXACT35_REFERENCE_INPUTS and row['package_path']=='delivery/reference-inputs/'+name
             and row['sha256']==EXACT35_REFERENCE_INPUTS[name], 'EXACT35_REFERENCE_INDEX_REQUIRED')
        raw = bytes_file(refs/name,16*1024*1024)
        need(len(raw)==row['bytes'] and digest(raw)==row['sha256'], 'EXACT35_REFERENCE_INPUT_CHANGED')
        seen.add(name)
    record_path = RELEASE_CONTRACT['exact35']['installationRecord']
    ref = p['firstInstall']['currentProductionService']
    args=[*mount(record_path,record_path),*mount(history,HISTORICAL_MOUNT),*mount(path,CURRENT_SERVICE_MOUNT)]
    if first_install_r3(p):
        args+=mount(FIRST_R3_ADMIN,'/etc/naijue-erp/'+FIRST_R3_ADMIN.name)
        args+=mount(FIRST_R3_SQL38,'/etc/naijue-erp/'+FIRST_R3_SQL38.name)
        for key,value in r3_lineage_environment(p).items():
            args+=['--env',key+'='+value]
        return args
    return args+['--env',CURRENT_SERVICE_ENV+'='+ref['sha256']]


def assert_own(info,p,role,public=False):
    _base_assert_own(info,p,role,public)
    if role=='app':
        ref = first_install_references(p)['currentProductionService']
        expected = r3_lineage_environment(p) if first_install_r3(p) else {CURRENT_SERVICE_ENV:ref['sha256']}
        env = [v for v in info['Config'].get('Env',[]) if v.split('=',1)[0] in expected]
        mounts = {v['Destination']:(v.get('Source'),v.get('RW'),v.get('Type')) for v in info.get('Mounts',[])}
        need(sorted(env)==sorted(key+'='+value for key,value in expected.items())
             and mounts.get(CURRENT_SERVICE_MOUNT)==(ref['path'],False,'bind')
             and mounts.get(HISTORICAL_MOUNT)==(str(HISTORICAL_SOURCE),False,'bind'),
             'FIRST_INSTALL_APP_PROTECTED_MOUNTS_CHANGED')
        if first_install_r3(p):
            need(all(mounts.get('/etc/naijue-erp/'+path.name)==(str(path),False,'bind')
                     for path in (FIRST_R3_ADMIN,FIRST_R3_SQL38)),
                 'FIRST_INSTALL_R3_MAINTENANCE_MOUNTS_CHANGED')


def runtime_configuration_baseline(p, capacity_pending=None):
    value = first_install_references(p)['runtimeConfigurationProof']
    need(type(value) is dict and set(value) in ({'baseline'},{'baseline','capacityLaunchSha256'})
         and ('capacityLaunchSha256' not in value or
              isinstance(value['capacityLaunchSha256'],str) and HASH.fullmatch(value['capacityLaunchSha256']))
         and (capacity_pending is None or ('capacityLaunchSha256' in value) != capacity_pending),
         'FIRST_INSTALL_RUNTIME_CONFIGURATION_PROOF_PHASE_DIFFERS')
    return runtime_archive_baseline(value['baseline'],p['runtimeConfiguration']['path'])


def runtime_archive_baseline(ref, source_path):
    _, _, baseline = first_install_reference(ref,filename=CONFIG_BASELINE_NAME)
    need(type(baseline) is dict and set(baseline)=={'format','archiveSha256','member','sourcePath','sourceIdentity',
         'sourceCtimeNs','rawSha256','businessSha256'} and baseline['format']=='FRESH35_RUNTIME_CONFIGURATION_BASELINE_V1'
         and baseline['sourcePath']==source_path and type(baseline['sourceIdentity']) is dict
         and set(baseline['sourceIdentity'])=={'device','inode','bytes','mtimeNs','uid','gid','mode'}
         and all(type(v) is int for v in baseline['sourceIdentity'].values())
         and type(baseline['sourceCtimeNs']) is int and baseline['sourceCtimeNs']>0
         and all(isinstance(baseline[k],str) and HASH.fullmatch(baseline[k]) for k in ('archiveSha256','rawSha256','businessSha256'))
         and isinstance(baseline['member'],str) and re.fullmatch(r'source-[0-9]+',baseline['member']),
         'FIRST_INSTALL_RUNTIME_CONFIGURATION_BASELINE_DIFFERS')
    return baseline


def validate_runtime_configuration_proof(p, runtime, pending):
    baseline = runtime_configuration_baseline(p, pending)
    path = p['runtimeConfiguration']['path']
    before = capacity_frozen_identity(path)
    raw = bytes_file(path,65536,private=True)
    value = capacity_transport_json(raw)
    need(before==capacity_frozen_identity(path) and
         {k:v for k,v in before.items() if k!='ctimeNs'}==p['runtimeConfiguration']['identity'] and
         type(value) is dict and value==runtime, 'FIRST_INSTALL_RUNTIME_CONFIGURATION_CHANGED')
    business = dict(value)
    if pending:
        need('capacityLaunch' not in business and p['runtimeConfiguration']['identity']==baseline['sourceIdentity']
             and before['ctimeNs']==baseline['sourceCtimeNs'] and digest(raw)==baseline['rawSha256'],
             'FIRST_INSTALL_RUNTIME_BASELINE_BYTES_CHANGED')
    else:
        need(all(before[k]==baseline['sourceIdentity'][k] for k in ('device','inode','uid','gid','mode')),
             'FIRST_INSTALL_RUNTIME_BASELINE_INODE_CHANGED')
        capacity = business.pop('capacityLaunch',None)
        need(type(capacity) is dict and digest(encoded(capacity))==p['firstInstall']['runtimeConfigurationProof']['capacityLaunchSha256'],
             'FIRST_INSTALL_RUNTIME_CAPACITY_BYTES_CHANGED')
    need(digest(encoded(business))==baseline['businessSha256'], 'FIRST_INSTALL_RUNTIME_BUSINESS_BYTES_CHANGED')
    return baseline


def first_install_capacity_target(record, service):
    target = record['target']
    return {'host':target['ordinary']['connectHost'],'port':target['ordinary']['connectPort'],
            'database':target['proposal']['database'],'role':target['proposal']['runtime'],
            'databaseOid':service['physical']['databaseOid'],'postmasterStart':service['physical']['postmasterStart']}


def runtime_fd_identity(st):
    need(stat.S_ISREG(st.st_mode) and st.st_nlink == 1 and not st.st_mode & 0o077
         and 0 < st.st_size <= 65536, 'FIRST_INSTALL_RUNTIME_BASELINE_FD_CHANGED')
    return {'device':st.st_dev,'inode':st.st_ino,'bytes':st.st_size,'mtimeNs':st.st_mtime_ns,
            'uid':st.st_uid,'gid':st.st_gid,'mode':stat.S_IMODE(st.st_mode),'ctimeNs':st.st_ctime_ns}


def original_runtime_bytes(path, fd, baseline):
    expected = {**baseline['sourceIdentity'], 'ctimeNs':baseline['sourceCtimeNs']}
    need(runtime_fd_identity(os.fstat(fd)) == expected == runtime_fd_identity(path.lstat()),
         'FIRST_INSTALL_RUNTIME_BASELINE_FD_CHANGED')
    raw = os.pread(fd, expected['bytes']+1, 0)
    need(len(raw)==expected['bytes'] and digest(raw)==baseline['rawSha256']
         and runtime_fd_identity(os.fstat(fd))==expected==runtime_fd_identity(path.lstat()),
         'FIRST_INSTALL_RUNTIME_BASELINE_FD_CHANGED')
    return raw


def same_inode_runtime_write(filename, expected, contents, *, checked_fd=None, baseline=None):
    if checked_fd is None:
        return _base_same_inode_runtime_write(filename, expected, contents)
    # Same original in-place write, truncate, fsync and readback. The
    # first-install branch uses the very descriptor verified against backup.
    need(isinstance(contents, bytes) and 0 < len(contents) <= 65536
         and baseline['sourceIdentity']==expected, 'PRIVATE_RUNTIME_WRITE_CAS_REQUIRED')
    path = Path(filename)
    original_runtime_bytes(path, checked_fd, baseline)
    os.lseek(checked_fd, 0, os.SEEK_SET)
    with os.fdopen(checked_fd, 'r+b', closefd=False) as file:
        file.write(contents); file.truncate(); file.flush(); os.fsync(checked_fd); file.seek(0)
        need(file.read(65537)==contents, 'PRIVATE_RUNTIME_READBACK_FAILED')
    written = runtime_fd_identity(os.fstat(checked_fd))
    need(written==runtime_fd_identity(path.lstat()) and
         all(written[k]==expected[k] for k in ('device','inode','uid','gid','mode')),
         'PRIVATE_RUNTIME_INODE_REPLACED')
    return {k:v for k,v in written.items() if k!='ctimeNs'}


def capacity_install_content(p, scope, files, provisional, provisional_profile, private):
    if not first_install(p):
        return _base_capacity_install_content(p,scope,files,provisional,provisional_profile,private)
    baseline = runtime_configuration_baseline(p,True)
    need(p['runtimeConfiguration']['identity']==provisional==baseline['sourceIdentity'],
         'PROVISIONAL_PRIVATE_INODES_CHANGED')
    path = canonical(p['runtimeConfiguration']['path'],private=True)
    fd = os.open(path, os.O_RDWR | os.O_NOFOLLOW)
    try:
        raw = original_runtime_bytes(path,fd,baseline)
        runtime = capacity_transport_json(raw)
        need(type(runtime) is dict and 'capacityLaunch' not in runtime, 'PROVISIONAL_MUST_NOT_REUSE_CAPACITY_APPROVAL')
        need(digest(encoded(runtime))==baseline['businessSha256'], 'FIRST_INSTALL_RUNTIME_BUSINESS_BYTES_CHANGED')

        capacity = capacity_transport_json(files['capacity-launch.json'])
        profile_bytes = encoded(capacity_transport_json(files['owner-profile.json']))
        need(type(capacity) is dict and set(capacity) == {'schemaVersion','profile','target','window','process','budgets',
             'minimumFreeBytes','safetyBytes','probeTtlMillis','probeTimeoutMillis','maxProbeWaiters','retryAfterSeconds','producer'},
             'ONLY_CAPACITY_CONTENT_ALLOWED')
        need(capacity['process']==scope['process'] and digest(encoded(capacity['target']))==scope['targetFingerprint']
             and capacity.get('window',{}).get('binding',{}).get('candidateFingerprint')==scope['sourceCommit']
             and capacity.get('window',{}).get('binding',{}).get('targetFingerprint')==scope['targetFingerprint']
             and capacity.get('window',{}).get('expiresAt',float('inf'))<=scope['deadlineAt'],
             'CAPACITY_CONTENT_APPROVED_SCOPE_MISMATCH')
        record = runtime35_record(p)
        _, service = current_production_service(p,record)
        need(capacity['target']==first_install_capacity_target(record,service), 'EXACT35_SAME_PHYSICAL_CAPACITY_TARGET_REQUIRED')
        expires = capacity['window'].get('expiresAt')
        need(capacity_number(expires) and expires<=service['sharedPostgresNamespace']['serviceLeaseExpiresAt'],
             'FIRST_INSTALL_CAPACITY_OUTLIVES_CURRENT_SERVICE')
        need(len(profile_bytes)<=65536, 'CAPACITY_PROFILE_SIZE_LIMIT')
        profile = p['capacityHost']['profile']['hostFile']
        need(file_identity(profile)==provisional_profile, 'PROVISIONAL_PRIVATE_INODES_CHANGED')
        final = json.loads(json.dumps(p))
        final['firstInstall']['runtimeConfigurationProof']['capacityLaunchSha256'] = digest(encoded(capacity))
        final['capacityHost']['profile']['sha256'] = digest(profile_bytes)
        final_runtime = {**runtime, 'capacityLaunch':capacity}

        # The original owner remains the only writer. Recheck the runtime
        # before touching the profile, and again on the runtime write FD.
        original_runtime_bytes(path,fd,baseline)
        same_inode_runtime_write(profile,provisional_profile,profile_bytes)
        capacity_runtime_configuration(final,final_runtime)
        final['runtimeConfiguration']['identity'] = same_inode_runtime_write(
            path,provisional,encoded(final_runtime),checked_fd=fd,baseline=baseline)
    finally:
        os.close(fd)
    final_ref = {'path':str(private/'approved-capacity-final-plan.json'),'sha256':digest(encoded(final))}
    new_json(final_ref['path'],final)
    return final,final_ref


def runtime_binding(p):
    # Public reference/stat binding only; never hash the private runtime bytes.
    mode = public_http_mode(p)
    if exact35_selected(p):
        native = p['runtime35']
        value = {'selector': 'exact35', 'references': native['references'], 'runtimeFile': p['runtimeConfiguration'],
                 'capacityHost': p.get('capacityHost'), 'capacityGate': p.get('capacityGate'),
                 'capacityFinalInput': p.get('capacityFinalInput'), 'media': native['media'],
                 'inventorySpool': native.get('inventorySpool')}
        if 'capacityQaObserver' in p:
            value['capacityQaObserver'] = p['capacityQaObserver']
        if 'credentialRequestKey' in native:
            value['credentialRequestKey'] = credential_key_binding(p)
        if 'sharedPostgresNamespace' in native:
            value['sharedPostgresNamespace'] = native['sharedPostgresNamespace']
        if mode is not None:
            value['publicHttpMode'] = mode
            value['nginxConfiguration'] = p['nginxConfiguration']
        if first_install(p):
            value['entryMode'] = p['entryMode']
            value['firstInstall'] = p['firstInstall']
            value['entryBaseline'] = p['beforeCAS']
        return digest(encoded(value))
    if not exact26_selected(p):
        return None
    value = {'selector': p['runtimeSelector'], 'references': runtime_references(p), 'runtimeFile': p['runtimeConfiguration'],
             'capacityHost': p.get('capacityHost'), 'capacityGate': p.get('capacityGate'), 'capacityFinalInput': p.get('capacityFinalInput')}
    if 'capacityQaObserver' in p: value['capacityQaObserver'] = p['capacityQaObserver']
    if exact26_full(p):
        profile = full_catalog_profile(p)
        if p['runtime26Full'].get('catalogProfile', 'legacy-v1') != 'legacy-v1':
            value['catalogBindingVersion'] = 2
            value['catalogProfile'] = profile
        value['media'] = p['runtime26Full']['media']
        value['inventorySpool'] = p['runtime26Full'].get('inventorySpool')
        if 'credentialRequestKey' in p['runtime26Full']:
            value['credentialRequestKey'] = credential_key_binding(p)
    return digest(encoded(value))


def validate_exact35_media_archive_source(p, backup, restored):
    media_source = backup.get('mediaArchiveSource', {})
    need(media_source.get('path') == p['runtime35']['media']['hostRoot'] and
         media_source.get('mapping') == p['runtime35']['media'] and media_source.get('archiveMember') == 'source-0' and
         backup.get('archiveSources', [None])[0] == media_source['path'] and
         restored.get('mediaArchiveSource') == media_source and
         restored.get('opaqueFilesRestore', {}).get('sourceMedia') == media_source,
         'EXACT35_ACTUAL_MEDIA_ARCHIVE_SOURCE_REQUIRED')
    media_stat = canonical(media_source['path'], kind='directory', root=ROOT).stat()
    need(media_source.get('identity') == {'device': media_stat.st_dev, 'inode': media_stat.st_ino,
         'uid': media_stat.st_uid, 'gid': media_stat.st_gid, 'mode': stat.S_IMODE(media_stat.st_mode)},
         'EXACT35_MEDIA_ARCHIVE_SOURCE_IDENTITY_CHANGED')


def validate_exact35_control_system_restoration(record, restored):
    need(restored.get('controlSystemAclRestored') is True and
         restored.get('controlSystemAclNewConnectionReadback') is True and
         restored.get('builtinAclMapping') == {'function': 'pg_catalog.pg_control_system()',
             'sourceAdmin': record['target']['proposal']['admin'],
             'restoreAdmin': restored.get('restoreTarget', {}).get('role'),
             'scope': 'ONLY_BUILTIN_OWNER_GRANTOR_OID10'} and
         isinstance(restored.get('restoreTarget', {}).get('role'), str),
         'EXACT35_ORIGINAL_CONTROL_SYSTEM_ACL_NOT_RESTORED')


def r3_backup_artifact(backup, filename):
    entry = backup.get('artifacts', {}).get(filename)
    need(type(entry) is dict and set(entry) == {'path', 'sha256', 'bytes'} and
         type(entry['bytes']) is int and 0 < entry['bytes'] <= 65536,
         'FIRST_INSTALL_R3_ARCHIVED_EVIDENCE_REQUIRED')
    _, raw = first_install_reference_bytes({'path':entry['path'], 'sha256':entry['sha256']}, filename=filename)
    need(len(raw) == entry['bytes'], 'FIRST_INSTALL_R3_ARCHIVED_EVIDENCE_REQUIRED')
    return raw, entry['sha256']


def validate_r3_recovery_lineage(p, record, backup, restored, *, formal=False):
    _, service09 = r3_current_production_service(p, record, retained_history=formal)
    refs = p['firstInstall']['r3']
    authority09 = capacity_transport_json(r3_protected_record(
        refs['serviceAuthorization'], FIRST_R3_SERVICE_BOOT/'service-start-authorization.json', 0o400))
    parent, parent_sha = r3_backup_artifact(backup, 'source-admin154-successor.private.json')
    post38, post38_sha = r3_backup_artifact(backup, 'source-sql38-successor.private.json')
    provision, _ = r3_backup_artifact(backup, 'source-admin-provision.private.json')
    captured05, captured05_sha = r3_backup_artifact(backup, 'r3-serviceProof.private.json')
    need(parent == r3_protected_record(refs['admin154Record'], FIRST_R3_ADMIN, 0o644) and
         post38 == r3_protected_record(refs['sql38Record'], FIRST_R3_SQL38, 0o644),
         'FIRST_INSTALL_R3_ARCHIVED_154_OR_SQL38_DIFFERS')
    proof = r3_service_validator()
    proof.validate_phase_result('ADMIN_PROVISION_ONLY', provision, authority09)
    after = capacity_transport_json(post38)['successor']
    lineage = {'installationCatalogSha256':record['catalogSha256'],
               'catalogSha256':after['catalogSha256'], 'catalogSpecSha256':after['catalogSpecSha256'],
               'maintenanceSourceSetSha256':after['sourceSetSha256'],
               'record154Sha256':parent_sha, 'record38Sha256':post38_sha}
    manifest_sha = FORMAL_R3_APP['manifestSha256']
    closure_sha = FORMAL_R3_APP['sourceManifestSha256']
    need(all(backup.get(k) == restored.get(k) == v for k, v in lineage.items()) and
         backup.get('appReleaseManifestSha256') == restored.get('appReleaseManifestSha256') == manifest_sha and
         backup.get('appSourceClosureSha256') == restored.get('appSourceClosureSha256') == closure_sha,
         'FIRST_INSTALL_R3_LOGICAL_03_BINDING_DIFFERS')
    service05 = capacity_transport_json(captured05)
    stopped = authority09['postImportStop']
    physical = service05.get('physical', {})
    need(service05.get('format') == 'FRESH35_CURRENT_PRODUCTION_SERVICE_V2' and
         service05.get('requestKey') == stopped['serviceKey'] == FIRST_R3_IMPORT_SERVICE and
         service05.get('installationRecordSha256') == FIRST_R3_INSTALLED_RECORD and
         service05.get('sourceSetSha256') == FIRST_R3_INSTALLED_SET and
         service05.get('targetSha256') == record['binding']['targetSha256'] and
         backup.get('sourcePhysical') == restored.get('sourcePhysical') == physical and
         all(physical.get(k) == service09['physical'][k] for k in ('systemIdentifier','databaseOid','serverVersionNum')) and
         physical.get('postmasterStart') == stopped['postmasterStart'],
         'FIRST_INSTALL_R3_ORIGINAL_05_TO_09_EPOCH_DIFFERS')

    prepare, _ = r3_backup_artifact(backup, 'r3-prepareResult.private.json')
    read_input, read_input_sha = r3_backup_artifact(backup, 'r3-readbackInput.private.json')
    read_result, _ = r3_backup_artifact(backup, 'r3-readbackResult.private.json')
    writer, writer_sha = r3_backup_artifact(backup, 'r3-writerCommit.private.json')
    prep = capacity_transport_json(prepare)
    inp = capacity_transport_json(read_input)
    result = capacity_transport_json(read_result)
    commit = capacity_transport_json(writer)
    prepared, read = prep.get('binding', {}), inp.get('binding', {})
    imported = backup.get('originalImport', {})
    expected = {'batchId':read.get('baselineBatchId'), 'documentBatchId':read.get('documentBatchId'),
                'initializerOperationId':read.get('rootOperationId'), 'initializerRequestKey':prepared.get('initializerRequestKey'),
                'publishOperationId':read.get('publishOperationId'), 'packageSha256':FIRST_R3_D3_MANIFEST,
                'planSha256':read.get('planSha256'), 'scopeSha256':FIRST_R3_D3_SCOPE}
    need(imported == expected and
         imported['initializerRequestKey'] == imported['initializerOperationId'] and
         prep.get('state') == 'COMPACT_ZERO_PREPARED' and prep.get('purpose') == 'FIRST_REAL_BUSINESS_IMPORT' and
         prep.get('connection_cleanup') == 'CLOSED' and prep.get('business_database_writes') is False and
         all(prepared.get(k) == v for k, v in {'baselineBatchId':expected['batchId'],
             'documentBatchId':expected['documentBatchId'], 'initializerOperationId':expected['initializerOperationId'],
             'manifestSha256':FIRST_R3_D3_MANIFEST, 'planSha256':expected['planSha256'],
             'currentServiceSha256':captured05_sha, 'successorRecordSha256':post38_sha}.items()) and
         read.get('manifestSha256') == commit.get('manifestSha256') == FIRST_R3_D3_MANIFEST and
         read.get('scopeSha256') == FIRST_R3_D3_SCOPE and commit.get('planSha256') == expected['planSha256'] and
         commit.get('state') in ('COMMITTED','ALREADY_COMMITTED') and commit.get('connectionCleanup') == 'CLOSED' and
         commit.get('childReaped') is True and inp.get('successorSha256') == post38_sha and
         inp.get('parentPins', {}).get('sha256') == parent_sha and
         inp.get('currentService', {}).get('sha256') == captured05_sha and
         result.get('inputSha256') == read_input_sha and
         result.get('writerCommitEvidenceSha256') == inp.get('writer', {}).get('commitEvidenceSha256') == writer_sha and
         result.get('originalWriterKey') == inp.get('writer', {}).get('requestKey') == commit.get('originalWriterKey') and
         result.get('requestKey') == inp.get('requestKey') and result.get('state') == 'FIRST_IMPORT_RECONCILED' and
         result.get('connectionCleanup') == 'CLOSED' and result.get('snapshot') == 'REPEATABLE_READ_READ_ONLY' and
         result.get('scopeExplicitDigestMatched') is True,
         'FIRST_INSTALL_R3_ORIGINAL_D3_READBACK_DIFFERS')


def validate_r3_restored_application(app, backup, restore, record, backup_sha, restore_sha, maximum_age):
    artifact = app.get('restorationArtifact')
    need(type(artifact) is dict and set(artifact) == {'archive','manifest'} and
         isinstance(artifact['archive'], dict) and isinstance(artifact['manifest'], dict) and
         artifact['archive'].get('sha256') == FIRST_R3_RESTORE_EXECUTOR['appArchiveSha256'] and
         artifact['manifest'].get('sha256') == FIRST_R3_RESTORE_MANIFEST,
         'FIRST_INSTALL_R3_EXACT_RESTORATION_ARTIFACT_REQUIRED')
    _, raw_archive = first_install_reference_bytes(artifact['archive'], filename='restoration-224.tar.gz',
                                                  limit=FIRST_R3_RESTORE_ARCHIVE_BYTES)
    _, raw_manifest = first_install_reference_bytes(artifact['manifest'], filename='restoration-manifest.json',
                                                   limit=FIRST_R3_RESTORE_MANIFEST_BYTES)
    manifest = capacity_transport_json(raw_manifest)
    need(len(raw_archive) == FIRST_R3_RESTORE_ARCHIVE_BYTES and len(raw_manifest) == FIRST_R3_RESTORE_MANIFEST_BYTES and
         manifest.get('purpose') == 'ISOLATED_RESTORATION_ONLY' and
         all(manifest.get(k) == FIRST_R3_RESTORE_EXECUTOR[k] for k in ('sourceCommit','buildId')) and
         manifest.get('native35', {}).get('sourceSetSha256') == FIRST_R3_RESTORE_EXECUTOR['sourceSetSha256'],
         'FIRST_INSTALL_R3_EXACT_RESTORATION_ARTIFACT_REQUIRED')
    ref = app.get('restoredInstallationRecord')
    _, record_bytes = first_install_reference_bytes(ref, filename='fresh35-combined-installation-v1.json',
                                                    public_mode=0o644)
    restored_record = capacity_transport_json(record_bytes)
    target = restored_record.get('target', {})
    proposal, physical = target.get('proposal', {}), restore['restoreTarget']
    restored_binding = restored_record.get('binding', {})
    origin = {'sourceInstallationRecordSha256':FIRST_R3_INSTALLED_RECORD,
              'sourceSourceSetSha256':FIRST_R3_INSTALLED_SET, 'sourceProgramSha256':record['programSha256'],
              'sourceTargetSha256':record['binding']['targetSha256'], 'sourceCatalogSha256':record['catalogSha256'],
              'databaseDumpSha256':backup['artifacts']['database.dump']['sha256'],
              'backupReceiptSha256':backup_sha, 'databaseRestoreReceiptSha256':restore_sha,
              'sourceRolesAclSha256':backup['artifacts']['source-catalog.private.json']['sha256']}
    need(ref['sha256'] == app['restoredInstallationRecordSha256'] and
         restored_record.get('format') == 'FRESH35_RESTORED_INSTALLATION_RECORD_V1' and
         restored_record.get('state') == target.get('purpose') == 'RESTORED_FROM_VERIFIED_INSTALLATION' and
         target.get('format') == 'FRESH35_RESTORED_TARGET_BINDING_V1' and
         restored_binding.get('sourceSetSha256') == FIRST_R3_RESTORE_EXECUTOR['sourceSetSha256'] and
         restored_binding.get('targetSha256') == digest(json.dumps(
             target, ensure_ascii=False, separators=(',',':'), allow_nan=False).encode()) and
         restored_record.get('origin') == origin and
         all(proposal.get(k) == record['target']['proposal'][k] for k in ('database','owner','controller','runtime')) and
         proposal.get('admin') == physical['role'] and proposal.get('host') == physical['address'] and
         proposal.get('port') == physical['port'] and
         proposal.get('workspaceDirectory') != record['target']['proposal']['workspaceDirectory'] and
         all(target.get('physical', {}).get(k) == physical[k]
             for k in ('systemIdentifier','databaseOid','serverVersionNum','postmasterStart')),
         'FIRST_INSTALL_R3_ACTUAL_RESTORED_RECORD_REQUIRED')
    fresh_time(restored_record.get('restoredAt'), maximum_age)
    need(dt.datetime.fromisoformat(restore['finishedAtUtc']) <= dt.datetime.fromisoformat(restored_record['restoredAt']) <=
         dt.datetime.fromisoformat(app['finishedAtUtc']), 'FIRST_INSTALL_R3_RESTORED_RECORD_TIME_DIFFERS')
    ready, cleanup = app.get('ownedAppReadiness', {}), app.get('ownedAppCleanup', {})
    need(re.fullmatch(r'[a-f0-9]{64}', app.get('containerId', '')) and
         app.get('ordinaryRole') == proposal['runtime'] and app.get('runtimeUser') == '10001:10001' and
         ready.get('readyz') is True and ready.get('samePidNodeExec') is True and
         ready.get('port3000AndResponseOwnedByPid1') is True and ready.get('process', {}).get('pid') == 1 and
         cleanup.get('cid') == app['containerId'] and cleanup.get('appStoppedOrNeverCreated') is True and
         cleanup.get('createWasUnknown') is False and cleanup.get('PGStopOrSignal') is False,
         'FIRST_INSTALL_R3_OWNED_RESTORED_APP_PROOF_REQUIRED')


def require_same_r3_recovery_receipts(finite, formal):
    need(type(finite) is dict and type(formal) is dict,'FORMAL_R3_FINITE_RECOVERY_RECEIPTS_DIFFER')
    for field in ('logicalBackupReceipt', 'logicalRestoreReceipt', 'applicationRestoreReceipt'):
        finite_ref = finite.get(field)
        formal_ref = formal.get(field)
        need(type(finite_ref) is dict and type(formal_ref) is dict
             and type(finite_ref.get('sha256')) is str and HASH.fullmatch(finite_ref['sha256'])
             and finite_ref['sha256'] == formal_ref.get('sha256'),
             'FORMAL_R3_FINITE_RECOVERY_RECEIPTS_DIFFER')


def formal_candidate_acceptance(plan, ref, *, fresh):
    def protected(ref):
        need(type(ref) is dict and set(ref)=={'path','sha256'},'FORMAL_R3_FAA8_ACCEPTANCE_REQUIRED')
        path = canonical(ref['path'])
        need(all(q.lstat().st_uid==0 and not q.lstat().st_mode&0o022 for q in (path,*path.parents)),
             'FORMAL_R3_FAA8_PROTECTED_ACCEPTANCE_REQUIRED')
        return reference(ref)
    result = protected(ref)
    for owner in ('QF','QB'):
        protected(result.get('evidence',{}).get(owner))
    if fresh:
        acceptance({**plan,'candidateAcceptance':ref})
    return result


def validate_exact35_logical_recovery(p, coverage, record, *, formal_plan=None):
    """Consume actual new35 capture AND independent restore; never publish evidence here."""
    r3 = first_install_r3(p)
    formal = formal_plan is not None
    need(not formal or r3, 'FORMAL_R3_FINITE_STAGE_PROOF_REQUIRED')
    backup_ref, restore_ref = coverage.get('logicalBackupReceipt'), coverage.get('logicalRestoreReceipt')
    if r3:
        finite_r3_app_binding(p)
        backup_path, _, backup = first_install_reference(backup_ref, filename='result.private.json')
        restore_path, _, restored = first_install_reference(restore_ref, filename='result.private.json')
        need(backup_path.parent != restore_path.parent, 'FIRST_INSTALL_R3_INDEPENDENT_RECEIPTS_REQUIRED')
    else:
        backup, restored = reference(backup_ref), reference(restore_ref)
    target = record['target']
    source_set = record['binding']['sourceSetSha256']
    install_set = FIRST_R3_INSTALLED_SET if r3 else FIRST_INSTALL_NATIVE_SET
    install_commit = FIRST_R3_INSTALLED_COMMIT if r3 else FIRST_INSTALL_NATIVE_COMMIT
    need(source_set == install_set, 'FIRST_INSTALL_NATIVE_SOURCE_DIFFERS')
    published = {'sourceCommit': p['sourceCommit'], 'buildId': p['buildId'], 'appArchiveSha256': p['archive']['sha256']}
    media = p['runtime35']['media']
    if r3:
        # 7e66 is a finite read-only APP. Its data proof is the one FAA8
        # capture/restore chain, and its own artifact remains pinned above.
        published = {**{k:FORMAL_R3_APP[k] for k in ('sourceCommit','buildId')},
                     'appArchiveSha256':FORMAL_R3_APP['archiveSha256']}
        media = formal_plan['runtime35']['media'] if formal else backup['media']
    if formal or not r3:
        review_plan = formal_plan if formal else p
        review_ref = review_plan['firstInstall']['restorationBuildReview']
        review_path = canonical(review_ref['path'], root=ROOT)
        need(review_path.stat().st_uid == 0, 'EXACT35_OS_PROTECTED_RESTORATION_BUILD_REVIEW_REQUIRED')
        restored_build = reference(review_ref)
        need(restored_build.get('format') == 'naijue-exact35-restoration-build-review-v1' and
             restored_build.get('result') == 'PASS' and restored_build.get('publishedApplication') == published and
             restored_build.get('nativeInstallation') == {'sourceCommit': install_commit, 'sourceSetSha256': source_set},
             'EXACT35_RESTORATION_BUILD_REVIEW_REQUIRED')
        executor = restored_build.get('restorationApplication', {})
    else:
        executor = FIRST_R3_RESTORE_EXECUTOR
    need(set(executor) == {'sourceCommit', 'buildId', 'appArchiveSha256', 'sourceSetSha256'} and
         re.fullmatch(r'[a-f0-9]{40}', executor.get('sourceCommit', '')) and executor['sourceCommit'] not in (published['sourceCommit'], RESTORATION_BUILD_ONLY_COMMIT) and
         isinstance(executor.get('buildId'), str) and executor['buildId'] and executor['buildId'] != published['buildId'] and
         HASH.fullmatch(executor.get('appArchiveSha256', '')) and executor['appArchiveSha256'] != published['appArchiveSha256'] and
         HASH.fullmatch(executor.get('sourceSetSha256', '')) and executor['sourceSetSha256'] != source_set,
         'EXACT35_DISTINCT_RESTORATION_EXECUTOR_REQUIRED')
    need(not r3 or executor == FIRST_R3_RESTORE_EXECUTOR, 'FIRST_INSTALL_R3_EXACT_RESTORATION_BUILD_REQUIRED')
    common = {**published,'target': target,
              'roleAclProjection': 'INCLUDES_ATTACL_AND_CONTROL_SYSTEM_V1',
              'installationRecordSha256': p['runtime35']['references']['installationRecord']['sha256'],
              'sourceSetSha256': record['binding']['sourceSetSha256'], 'media': media}
    if r3:
        need(common['installationRecordSha256'] == FIRST_R3_INSTALLED_RECORD,
             'FIRST_INSTALL_R3_EXACT_152_RECORD_REQUIRED')
    else:
        common.update(buildRoot=FIRST_INSTALL_NATIVE_COMMIT,
                      integrationSourceCommit='e422d07390c5a58c44b54452983638a2de5655b7',
                      catalogSha256=record['catalogSha256'])
    need(backup.get('format') == restored.get('format') == 'NEW35_LOGICAL_BACKUP_RESTORE_V1' and
         backup.get('mode') == 'backup' and backup.get('state') == 'BACKUP_CAPTURED_OFFLINE_TOC_ONLY' and
         restored.get('mode') == 'restore' and
         restored.get('state') == 'DB_RESTORED_APP_NOT_VERIFIED' and
         all(backup.get(k) == v and restored.get(k) == v for k, v in common.items()),
         'EXACT35_ACTUAL_LOGICAL_BACKUP_AND_RESTORE_REQUIRED')
    if r3:
        config_ref = restored['runtimeConfigurationBaseline']
        source_path = backup['runtimeArchiveSource']['path']
        need(source_path != p['runtimeConfiguration']['path'],
             'FORMAL_R3_ARCHIVE_CONFIG_MUST_BE_INDEPENDENT')
        baseline = runtime_archive_baseline(config_ref,source_path)
    else:
        baseline = runtime_configuration_baseline(p)
        config_ref = p['firstInstall']['runtimeConfigurationProof']['baseline']
    archive_source = {'path':baseline['sourcePath'],'member':baseline['member'],'identity':baseline['sourceIdentity'],
                      'ctimeNs':baseline['sourceCtimeNs']}
    sources = backup.get('archiveSources')
    need(type(sources) is list and sources.count(baseline['sourcePath'])==1
         and baseline['member']=='source-'+str(sources.index(baseline['sourcePath']))
         and backup.get('runtimeArchiveSource')==archive_source
         and backup.get('runtimeIdentity')==restored.get('sourceRuntimeIdentity')==baseline['sourceIdentity']
         and restored.get('runtimeConfigurationBaseline')==config_ref
         and baseline['archiveSha256']==backup.get('artifacts',{}).get(CONFIG_ARCHIVE_NAME,{}).get('sha256'),
         'EXACT35_SOURCE_RUNTIME_CONFIGURATION_CHANGED')
    imported = backup.get('originalImport', {})
    import_package = FIRST_R3_D3_MANIFEST if r3 else FIRST_INSTALL_IMPORT_PACKAGE
    uuid_keys = ('batchId', 'documentBatchId', 'initializerOperationId', 'initializerRequestKey')
    if r3:
        uuid_keys += ('publishOperationId',)
    need(isinstance(imported, dict) and imported.get('packageSha256') == import_package and
         all(isinstance(imported.get(k), str) and re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', imported[k])
             for k in uuid_keys) and
         imported['batchId'] != imported['documentBatchId'] and HASH.fullmatch(imported.get('planSha256', '')),
         'EXACT35_ORIGINAL_COMMITTED_IMPORT_BINDING_REQUIRED')
    required = {'database', 'rolesAuthAcl', 'app', 'media', 'configuration', 'installationAndSource', 'originalImport'}
    files = backup.get('artifacts', {})
    names = {'database.dump', 'roles-auth-acl.protected.sql', 'application.protected.pack',
             'app-media-config.protected.tar', 'source-catalog.private.json', 'representative-source.private.json'}
    need(set(backup.get('completeClosure', [])) == set(restored.get('completeClosure', [])) == required and
         names <= set(files) and all(isinstance(files[n], dict) and files[n].get('bytes', 0) > 0 and
         HASH.fullmatch(files[n].get('sha256', '')) for n in names) and
         files['application.protected.pack']['sha256'] == published['appArchiveSha256'] and
         restored.get('backupArtifacts') == files and restored.get('backupReceiptSha256') == backup_ref['sha256'] and
         restored.get('originalImport') == backup.get('originalImport') and restored.get('rolesAclCompared') is True and
         restored.get('ordinaryDatabaseRepresentativeRead') == 'PASS' and
         restored.get('currentAppLoginRepresentativeRead') == 'NOT_TESTED' and
         restored.get('opaqueFilesRestore', {}).get('extracted') is True and
         restored['opaqueFilesRestore'].get('archiveSha256') == files['app-media-config.protected.tar']['sha256'] and
         restored.get('sourceInstallationRecordReusableForRestore') is False and
         restored.get('restoredInstallationRecordCreated') is False,
         'EXACT35_LOGICAL_RESTORE_CLOSURE_REQUIRED')
    validate_exact35_media_archive_source({'runtime35':{'media':media}}, backup, restored)
    validate_exact35_control_system_restoration(record, restored)
    physical = restored.get('restoreTarget', {})
    need(restored.get('sourceTarget') == target and physical.get('database') == target['proposal']['database'] and
         isinstance(physical.get('systemIdentifier'), str) and physical['systemIdentifier'].isdigit() and
         physical['systemIdentifier'] not in FIRST_INSTALL_EXCLUDED_SYSTEM_IDS | {target['physical']['systemIdentifier']} and
         physical.get('role') != target['proposal']['admin'] and physical.get('databaseOid', '').isdigit() and physical.get('postmasterStart') and
         physical.get('serverVersionNum') == target['physical']['serverVersionNum'],
         'EXACT35_INDEPENDENT_RESTORE_PHYSICAL_BINDING_REQUIRED')
    fresh_time(backup.get('finishedAtUtc'), p['backupMaxAgeSeconds'])
    fresh_time(restored.get('finishedAtUtc'), p['backupMaxAgeSeconds'])
    need(dt.datetime.fromisoformat(restored['finishedAtUtc']) >= dt.datetime.fromisoformat(backup['finishedAtUtc']),
         'EXACT35_RESTORE_PRECEDES_BACKUP')
    app_ref = coverage.get('applicationRestoreReceipt')
    app = (first_install_reference(app_ref, filename='restored-application-result.private.json')[2]
           if r3 else reference(app_ref))
    need(app.get('format') == 'NEW35_CURRENT_APP_RESTORE_VERIFY_V1' and
         app.get('state') == 'CURRENT_APPLICATION_LOGIN_SESSION_AND_REPRESENTATIVE_QUERY_PASSED' and
         app.get('databaseRestoreReceiptSha256') == restore_ref['sha256'] and
         app.get('backupReceiptSha256') == backup_ref['sha256'] and app.get('restoreTarget') == physical and
         all(app.get(k) == v for k, v in executor.items()) and
         app.get('currentAppLoginRepresentativeRead') == 'PASS' and
         app.get('checks') == {'login': True, 'session': True, 'representativeQuery': True} and
         HASH.fullmatch(app.get('restoredInstallationRecordSha256', '')) and
         app['restoredInstallationRecordSha256'] != common['installationRecordSha256'] and
         isinstance(app.get('restoredRuntimeIdentity'), dict) and app['restoredRuntimeIdentity'] and
         app['restoredRuntimeIdentity'] != baseline['sourceIdentity'] and
         (app['restoredRuntimeIdentity'].get('device'),app['restoredRuntimeIdentity'].get('inode')) !=
         (baseline['sourceIdentity']['device'],baseline['sourceIdentity']['inode']),
         'EXACT35_CURRENT_APP_RECOVERY_NOT_VERIFIED')
    fresh_time(app.get('finishedAtUtc'), p['backupMaxAgeSeconds'])
    need(dt.datetime.fromisoformat(app['finishedAtUtc']) >= dt.datetime.fromisoformat(restored['finishedAtUtc']),
         'EXACT35_APP_VERIFICATION_PRECEDES_RESTORE')
    if r3:
        validate_r3_recovery_lineage(p, record, backup, restored,formal=formal)
        validate_r3_restored_application(app, backup, restored, record,
                                         backup_ref['sha256'], restore_ref['sha256'], p['backupMaxAgeSeconds'])
    return backup_ref['sha256']


def validate_runtime35(p, manifest, runtime, capacity_pending=False):
    native, refs = p['runtime35'], p['runtime35']['references']
    record = runtime35_record(p)
    target = validate_exact35_installation_data(record, reference(refs['sourceSet'], 16 * 1024 * 1024),
                                               reference(refs['program'], 16 * 1024 * 1024))
    proposal, physical = target['proposal'], target['physical']
    production = record['format']=='FRESH35_COMBINED_INSTALLATION_RECORD_V2'
    if first_install(p):
        need(production and physical['systemIdentifier'] not in FIRST_INSTALL_EXCLUDED_SYSTEM_IDS,
             'FIRST_INSTALL_INDEPENDENT_NATIVE_TARGET_REQUIRED')
        _, service = current_production_service(p, record)
        baseline = validate_runtime_configuration_proof(p,runtime,capacity_pending)
    connection = target['ordinary'] if production else {'connectHost':proposal['host'],'connectPort':proposal['port']}
    expected = (first_install_capacity_target(record,service) if first_install(p) else
                {'host':connection['connectHost'],'port':connection['connectPort'],'database':proposal['database'],
                 'role':proposal['runtime'],'databaseOid':physical['databaseOid'],'postmasterStart':physical['postmasterStart']})
    if not capacity_pending:
        need(runtime.get('capacityLaunch', {}).get('target') == expected, 'EXACT35_SAME_PHYSICAL_CAPACITY_TARGET_REQUIRED')
        if first_install(p):
            expires = runtime['capacityLaunch'].get('window',{}).get('expiresAt')
            need(capacity_number(expires) and expires<=service['sharedPostgresNamespace']['serviceLeaseExpiresAt'],
                 'FIRST_INSTALL_CAPACITY_OUTLIVES_CURRENT_SERVICE')
    runtime = capacity_runtime_configuration(p, runtime, capacity_pending)
    required = {'schemaVersion', 'profile', 'documentCommands', 'publicOrigin', 'http', 'assets', 'build', 'postgres', 'authentication', 'productMedia'}
    maintenance = {'organizationMaintenance', 'catalogueMaintenance', 'paymentMaintenance', 'partyMaintenance', 'staffMaintenance', 'productMaintenance'}
    optional = maintenance | {'inventoryOutputSpool', 'staffCredentialRequestKeyFile'}
    need(required <= set(runtime) <= required | optional and runtime['schemaVersion'] == 1 and
         runtime['profile'] == RELEASE_CONTRACT['exact35']['productionProfile' if production else 'profile'] and runtime['documentCommands'] == 'NATIVE_RUNTIME' and
         all(runtime[k] is True for k in maintenance if k in runtime), 'CLOSED_EXACT35_RUNTIME_REQUIRED')
    config_target = runtime.get('postgres', {}).get('target', {})
    need(all(config_target.get(k) == v for k, v in {'host': connection['connectHost'], 'port': connection['connectPort'], 'database': proposal['database'],
         'user': proposal['runtime'], 'ssl': False}.items()), 'EXACT35_ORDINARY_LOGIN_TARGET_REQUIRED')
    need(runtime['productMedia'] == {'root': native['media']['containerRoot'], 'rootKey': native['media']['rootKey']}, 'EXACT35_MEDIA_BINDING_CHANGED')
    validate_full_credential(p, runtime)
    need(('inventoryOutputSpool' in runtime) == ('inventorySpool' in native), 'EXACT35_SPOOL_SELECTION_CHANGED')
    if 'inventoryOutputSpool' in runtime:
        need(runtime['inventoryOutputSpool'] == {'directory': '/private/inventory-exports', 'maxBytes': 536870912, 'maxConcurrent': 1, 'maxDurationMs': 120000},
             'EXACT35_OUTPUT_SPOOL_REQUIRED')
    validate_runtime_build(p, manifest, refs)
    build_source = reference(refs['sourceManifest'], 16 * 1024 * 1024)
    install_source = reference(refs['sourceSet'], 16 * 1024 * 1024)
    if first_install_r3(p) or app289_selected(p):
        native35_member_map(manifest, install_source)
        pins = manifest['native35']['pins']
    else:
        pins = current_app_native_source(install_source)['currentSourcePins'] if first_install(p) else install_source['currentSourcePins']
    need(isinstance(pins, list) and pins and all(isinstance(row, dict) and set(row) == {'path', 'sha256'} and
         HASH.fullmatch(row.get('sha256', '')) for row in pins) and len({row['path'] for row in pins}) == len(pins), 'EXACT35_SOURCE_PINS_REQUIRED')
    source_pins = {relative(row['path']): row['sha256'] for row in pins}
    need(all(row['sha256'] == source_pins[row['path']] for row in build_source['files'] if row['path'] in source_pins), 'EXACT35_BUILD_INSTALL_SOURCE_CHANGED')
    validate_sql_members(manifest, build_source, APPROVED_SQL_PATCHES, RELEASE_CONTRACT['exact35']['migrationCount'])
    metadata = reference(refs['metadata'], 16 * 1024 * 1024)
    need(refs['metadata']['sha256'] == record['catalogSha256'] and metadata.get('format') == 'FRESH35_COMBINED_ACTUAL_CATALOG_V1' and
         metadata.get('sourceSetSha256') == install_source['sourceSetSha256'] and
         [row.get('version') for row in metadata.get('lineage', [])] == list(range(1, 28)), 'EXACT35_INSTALLED_CATALOG_REQUIRED')
    need(metadata.get('identity') == {'systemIdentifier': physical['systemIdentifier'], 'databaseOid': physical['databaseOid'],
         'database': proposal['database'], 'owner': proposal['owner'], 'actor': proposal['owner'], 'serverVersionNum': physical['serverVersionNum'],
         'host': proposal['host'], 'port': proposal['port']}, 'EXACT35_CATALOG_PHYSICAL_TARGET_CHANGED')
    coverage = reference(refs['backupCoverage'])
    backup_sha = validate_exact35_logical_recovery(p, coverage, record) if first_install(p) else p['backupReceipt']['sha256']
    need(coverage.get('database') == proposal['database'] and coverage.get('target') == target and
         coverage.get('buildId') == p['buildId'] and coverage.get('sourceCommit') == p['sourceCommit'] and
         coverage.get('schemaVersions') == p['schemaVersions'] and coverage.get('catalogSha256') == record['catalogSha256'] and
         coverage.get('backupReceiptSha256') == backup_sha and
         coverage.get('runtimeIdentity') == (baseline['sourceIdentity'] if first_install(p) else p['runtimeConfiguration']['identity'])
         and coverage.get('media') == native['media'] and
         (first_install(p) or coverage.get('r1Protected') is True) and
         coverage.get('isolatedRestore', {}).get('currentAppLoginRepresentativeRead') == 'PASS',
         'EXACT35_CURRENT_CONFIG_MEDIA_RESTORE_COVERAGE_REQUIRED')
    media = canonical(native['media']['hostRoot'], kind='directory', root=ROOT)
    need(media.stat().st_uid == int(p['limits']['app']['user'].split(':')[0]), 'EXACT35_PRIVATE_MEDIA_APP_OWNER_REQUIRED')
    if 'inventorySpool' in native:
        need(canonical(native['inventorySpool']['hostRoot'], kind='directory', root=ROOT).stat().st_uid == media.stat().st_uid,
             'EXACT35_PRIVATE_SPOOL_APP_OWNER_REQUIRED')
    # A V1 synthetic install cannot authorize a production bridge, even when all
    # other references agree. V2 uses its exact native production target contract.
    need(production, 'EXACT35_LOOPBACK_INSTALL_RECORD_NOT_A_BRIDGE_PRODUCTION_TARGET')


def read_plan(filename):
    p = json_file(filename)
    required = {'format', 'operationId', 'buildId', 'sourceCommit', 'publicOrigin', 'archive', 'manifest', 'packReceipt',
                'backupMaxAgeSeconds', 'newDatabaseReceipt', 'schemaVersions', 'releaseDirectory', 'images', 'networks', 'names',
                'limits', 'runtimeConfiguration', 'nginxConfiguration', 'beforeCAS'}
    need(isinstance(p, dict) and required <= set(p) and p['format'] == 'naijue-candidate-deployment-v1', 'EXPLICIT_DEPLOYMENT_PLAN_REQUIRED')
    public_http_mode(p)
    need(first_install(p), 'EXPLICIT_FIRST_INSTALL_ENTRY_MODE_REQUIRED')
    if first_install(p):
        selected_archive = FIRST_R3_ARCHIVE if first_install_r3(p) else FIRST_INSTALL_APP_ARCHIVE
        need(selected_archive is not None, 'FIRST_INSTALL_CURRENT_APP_ARCHIVE_REVIEW_REQUIRED')
        selected_app=FIRST_R3_APP_COMMIT if first_install_r3(p) else FIRST_INSTALL_APP_COMMIT
        need(exact35_selected(p) and 'backupReceipt' not in p and 'legacyLogicalRecovery' not in p and
             p['sourceCommit'] == selected_app and p['archive'].get('sha256') == selected_archive,
             'FIRST_INSTALL_EXACT_APP_WITHOUT_OLD_BACKUP_REQUIRED')
        ref = first_install_references(p)['restorationBuildReview']
        need(type(ref) is dict and set(ref) == {'path', 'sha256'} and
             HASH.fullmatch(ref.get('sha256', '')), 'FIRST_INSTALL_REVIEWED_RESTORATION_BUILD_REFERENCE_REQUIRED')
        canonical(ref['path'], root=ROOT)
        if first_install_r3(p):
            r3_app_evidence(p)
            current_production_service(p)
        runtime_configuration_baseline(p)
        current_production_service(p)
    else:
        need('backupReceipt' in p and 'firstInstall' not in p, 'LEGACY_BACKUP_AND_EXPLICIT_ENTRY_MODE_REQUIRED')
    need(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,70}', p['operationId']) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', p['buildId']) and
         re.fullmatch(r'[a-f0-9]{40}', p['sourceCommit']) and p['publicOrigin'] == ORIGIN, 'EXACT_BUILD_AND_OPERATION_IDENTITY_REQUIRED')
    need(p['schemaVersions'] == list(range(1, RELEASE_CONTRACT['exact35']['migrationCount'] + 1) if exact35_selected(p) else range(1, 27) if exact26_selected(p) else range(1, 20)), 'EXACT_SELECTED_SCHEMA_REQUIRED')
    need(isinstance(p['backupMaxAgeSeconds'], int) and 1 <= p['backupMaxAgeSeconds'] <= 86400, 'EXPLICIT_BACKUP_MAX_AGE_REQUIRED')
    release = Path(p['releaseDirectory'])
    need(release.parent == ROOT / 'releases' and release.name == p['buildId'], 'EXACT_NEW_RELEASE_DIRECTORY_REQUIRED')
    need(set(p['images']) == {'node', 'web'}, 'EXACT_TWO_RUNTIME_IMAGES_REQUIRED')
    for key in ('node', 'web'):
        need(isinstance(p['images'].get(key), dict) and IMAGE.fullmatch(p['images'][key].get('id', '')), 'IMMUTABLE_LOCAL_IMAGE_ID_REQUIRED')
    need(p['images']['node'].get('nodeVersion') == RELEASE_CONTRACT['node'] and re.fullmatch(r'11\.[0-9]+\.[0-9]+', p['images']['node'].get('npmVersion', '')), 'EXACT_NODE_AND_NPM_VERSION_REQUIRED')
    need(p['images']['node'].get('platform') == 'linux/amd64' and p['images']['web'].get('platform') == 'linux/amd64', 'LINUX_AMD64_IMAGE_REQUIRED')
    network_pattern = r'naijue-fresh35-[a-z0-9-]+-(front|data|ingress)' if first_install(p) else r'naijue-prod-(front|data|ingress)'
    for key in ('front', 'data', 'install'):
        row = p['networks'].get(key)
        need(isinstance(row, dict) and HASH.fullmatch(row.get('id', '')) and isinstance(row.get('name'), str)
             and re.fullmatch(network_pattern, row['name']), 'EXPLICIT_EXISTING_NETWORK_REQUIRED')
    front, data, ingress = (p['networks'][k] for k in ('front', 'data', 'install'))
    need(front['name'].endswith('-front') and data['name'].endswith('-data') and ingress['name'].endswith('-ingress') and
         len({front['name'].removesuffix('-front'), data['name'].removesuffix('-data'), ingress['name'].removesuffix('-ingress')}) == 1 and
         (not first_install(p) or len({front['id'], data['id'], ingress['id']}) == 3), 'NO_NEW_OR_HOST_NETWORK_ALLOWED')
    need(set(p['names']) == {'app', 'stageWeb', 'publicWeb', 'installer'}, 'EXACT_FOUR_CANDIDATE_NAMES_REQUIRED')
    for key, suffix in [('app', 'app'), ('stageWeb', 'stage-web'), ('publicWeb', 'web'), ('installer', 'installer')]:
        need(re.fullmatch(r'naijue-rewrite-[a-z0-9-]{1,55}-' + suffix, p['names'].get(key, '')), 'EXACT_OWNED_CONTAINER_NAMES_REQUIRED')
    need(len(set(p['names'].values())) == 4, 'DISTINCT_CANDIDATE_NAMES_REQUIRED')
    for key in ('app', 'web', 'install'):
        row = p['limits'].get(key)
        need(isinstance(row, dict) and isinstance(row.get('memoryMiB'), int) and 64 <= row['memoryMiB'] <= 2048
             and isinstance(row.get('cpus'), (int, float)) and 0.1 <= row['cpus'] <= 2, 'EXPLICIT_FINITE_CONTAINER_LIMITS_REQUIRED')
        logging_config(p, key)
    need(re.fullmatch(r'[1-9][0-9]{0,5}:[1-9][0-9]{0,5}', p['limits']['app'].get('user', '')) and p['limits']['web'].get('user') == '101:101', 'NONROOT_APPLICATION_AND_NGINX_UID_REQUIRED')
    services = p['beforeCAS'].get('services', {})
    need(set(services) == (set() if first_install(p) else set(OLD_NAMES)), 'EXACT_ENTRY_SERVICE_CAS_REQUIRED')
    need(isinstance(p['beforeCAS'].get('files'), list) and p['beforeCAS']['files'], 'EXACT_ENTRY_CONFIG_CAS_REQUIRED')
    for row in p['beforeCAS']['files']:
        path = canonical(row.get('path'), root=None if first_install(p) else OLD)
        if first_install(p):
            need(not path.is_relative_to(OLD) and path.is_relative_to('/release-review/location-58c98b29b3'),
                 'FIRST_INSTALL_SHARED_PROXY_CONFIG_REQUIRED')
        need(row['path'].endswith(('.json', '.conf')) and '/secrets/' not in row['path'] and
             HASH.fullmatch(row.get('sha256', '')), 'PINNED_ENTRY_CONFIG_REFERENCE_REQUIRED')
    for expected in services.values():
        need(HASH.fullmatch(expected.get('id', '')) and IMAGE.fullmatch(expected.get('imageId', '')) and
             isinstance(expected.get('startedAt'), str) and isinstance(expected.get('restartCount'), int), 'COMPLETE_OLD_CONTAINER_IDENTITY_REQUIRED')
    runtime = p['runtimeConfiguration']
    need(isinstance(runtime, dict) and Path(runtime.get('path', '')).is_relative_to(ROOT) and isinstance(runtime.get('identity'), dict), 'PRIVATE_RUNTIME_FILE_REFERENCE_REQUIRED')
    return p


def validate_references(p, capacity_pending=False):
    native_source = reference(p['runtime35']['references']['sourceSet'], 16 * 1024 * 1024) if exact35_selected(p) else None
    manifest, entries = verified_archive(p['archive'], p['manifest'], p['buildId'], p['sourceCommit'], native_source)
    pack = reference(p['packReceipt'])
    need(pack.get('status') == 'PACKED_AND_EXTRACTED_READBACK_MATCH' and pack.get('archiveExtractions') == 1 and
         pack.get('buildId') == p['buildId'] and pack.get('sourceCommit') == p['sourceCommit'] and
         pack.get('archive', {}).get('sha256') == p['archive']['sha256'] and pack.get('manifestSha256') == p['manifest']['sha256'] and
         pack.get('members') == len(entries), 'EXACT_PACK_ACCEPTANCE_REQUIRED')
    if not first_install(p):
        backup = reference(p['backupReceipt'])
        need(backup.get('status') == 'PASS_FRESH_CURRENT_APP_DB_WAL_MEDIA_CONFIG_PRESERVED' and backup.get('physicalVerifiedOnce') is True and
             backup.get('mediaAndConfigurationShapesStable') is True and backup.get('databaseFiles', 0) > 0 and backup.get('walRanges'), 'COMPLETE_CURRENT_BACKUP_REQUIRED')
        fresh_time(backup.get('finishedAtUtc'), p['backupMaxAgeSeconds'])
        for name, before in p['beforeCAS']['services'].items():
            b = backup.get('services', {}).get(name, {})
            need(b.get('imageId') == before.get('imageId') and b.get('startedAt') == before.get('startedAt'), 'BACKUP_OLD_RUNTIME_CAS_MISMATCH')
    db = reference(p['newDatabaseReceipt'])
    if not exact35_selected(p) and not exact26_full(p):
        need(db.get('status') == 'PASS_NEW_DATABASE_SCHEMA19_ONLY_NOT_IMPORT_NOT_AUTH' and db.get('actual', {}).get('database') == DATABASE and
             db['actual'].get('versions') == (list(range(1, 20)) if exact26_selected(p) else p['schemaVersions']) and db['actual'].get('tables') == 50, 'EXACT_NEW_DATABASE_SCHEMA_RECEIPT_REQUIRED')
    if not exact35_selected(p) and not exact26_selected(p):
        migrations = {int(PurePosixPath(row['path']).name.split('_', 1)[0]): row['sha256'] for row in manifest['members'] if row.get('role') == 'migration'}
        need(migrations == {row['version']: row['sha256'] for row in db.get('appliedMigrations', [])} and set(migrations) == set(range(1, 20)), 'RELEASE_SCHEMA_MIGRATION_HASH_MISMATCH')
    need(file_identity(p['runtimeConfiguration']['path']) == p['runtimeConfiguration']['identity'], 'PRIVATE_RUNTIME_FILE_IDENTITY_CHANGED')
    runtime = json_file(p['runtimeConfiguration']['path'], private=True)
    need(runtime.get('build') == {'buildId': p['buildId'], 'sourceCommit': p['sourceCommit']} and runtime.get('publicOrigin') == ORIGIN and
         runtime.get('documentCommands') == ('NATIVE_RUNTIME' if exact35_selected(p) or exact26_full(p) else 'DISABLED') and runtime.get('http') == {'host': '0.0.0.0', 'port': 3000, 'acceptedHosts': [HOST]} and
         runtime.get('assets') == {'root': '/app/web', 'entry': 'index.html'} and
         (exact35_selected(p) or runtime.get('profile') == (FULL_PROFILE if exact26_full(p) else RUNTIME26_PROFILE if exact26_selected(p) else 'source-confirmed-native-v1')), 'R1_RUNTIME_CONFIGURATION_MISMATCH')
    if exact35_selected(p):
        # The protected native record selects the exact V1/V2 profile below.
        validate_runtime35(p, manifest, runtime, capacity_pending)
    elif exact26_selected(p):
        validate_runtime26(p, manifest, db, runtime, capacity_pending)
    else:
        capacity_runtime_configuration(p, runtime, capacity_pending)
    target = runtime.get('postgres', {}).get('target', {})
    if not exact35_selected(p):
        need(target.get('database') == DATABASE and target.get('user') == ROLE and target.get('host') == 'naijue-prod-db-1' and target.get('port') == 5432,
             'OLD_OR_WRONG_DATABASE_CONFIGURATION_REFUSED')
    need(bool(target.get('password')) and file_identity(p['runtimeConfiguration']['path'])['uid'] == int(p['limits']['app']['user'].split(':')[0]),
         'APPLICATION_PRIVATE_RUNTIME_OWNER_REQUIRED')
    verify_nginx_configuration(p)
    need(file_identity(p['runtimeConfiguration']['path']) == p['runtimeConfiguration']['identity'], 'PRIVATE_RUNTIME_FILE_CHANGED_DURING_VALIDATION')
    return manifest, entries


def check_first_install_entry(p, docker, public_id=None, active=False):
    for row in p['beforeCAS']['files']:
        need(file_hash(row['path']) == row['sha256'], 'FIRST_INSTALL_PROXY_CONFIGURATION_CHANGED')
    need(check_production_shared_namespace(p, docker) is not None, 'FIRST_INSTALL_REQUIRES_EXISTING_NEW_POSTGRES')
    found = False
    ids = docker.run(['ps', '--all', '--quiet', '--no-trunc']).decode().split()
    for cid in ids:
        info = docker.inspect(cid)
        published = any(row.get('HostPort') == '18080' for ports in
                        (info['HostConfig'].get('PortBindings') or {}).values() for row in (ports or []))
        if published:
            need(info['Id'] == public_id, 'FIRST_INSTALL_ENTRY_ALREADY_RESERVED')
            assert_own(info, p, 'web', True)
            need(info['State']['Running'] is active, 'FIRST_INSTALL_OWNED_ENTRY_STATE_CHANGED')
            found = True
    need(public_id is None or found, 'FIRST_INSTALL_OWNED_ENTRY_BINDING_MISSING')
    if not active:
        for family, address in ((socket.AF_INET, '0.0.0.0'), (socket.AF_INET6, '::')):
            try:
                with socket.socket(family, socket.SOCK_STREAM) as probe:
                    if family == socket.AF_INET6:
                        probe.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
                    probe.bind((address, 18080))
            except OSError as error:
                if family != socket.AF_INET6 or error.errno not in (errno.EAFNOSUPPORT, errno.EPROTONOSUPPORT):
                    raise Refused('FIRST_INSTALL_ENTRY_PORT_OCCUPIED_OR_UNVERIFIED') from None


def check_first_install_boot_actors():
    for unit in ('naijue-prod.service', 'naijue-t48-prod-runtime.service'):
        result = subprocess.run(['/usr/bin/systemctl', 'show', unit, '-p', 'LoadState', '-p', 'UnitFileState',
                                 '-p', 'ActiveState', '-p', 'SubState'], capture_output=True, text=True, timeout=5)
        values = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
        absent = values.get('LoadState') == 'not-found' and values.get('ActiveState') == 'inactive'
        retired = (values.get('UnitFileState') == 'disabled' and
                   (values.get('ActiveState'), values.get('SubState')) in (('inactive', 'dead'), ('active', 'exited')))
        need(result.returncode in (0, 1, 4) and (absent or result.returncode == 0 and retired),
             'FIRST_INSTALL_LEGACY_BOOT_ACTOR_NOT_RETIRED')


def check_stage_entry(p, docker):
    if first_install(p):
        check_first_install_entry(p, docker)
    else:
        check_old(p, docker)


def run_capacity_gate_controller(p, docker, journal):
    """No detached provisional return. On every failure/deadline stop only this candidate and preserve its evidence."""
    gate = capacity_gate_binding(p)
    provisional = file_identity(p['runtimeConfiguration']['path'])
    need(provisional == p['runtimeConfiguration']['identity'], 'PROVISIONAL_PRIVATE_IDENTITY_CHANGED')
    # Missing actual authority/channel refuses BEFORE allocating a container.
    delivery = capacity_bag(p.get('capacityFinalInput'), ('path', 'authority'))
    reference(capacity_bag(delivery['authority'], ('path', 'sha256')))
    cid = create_capacity_gate_app(p, docker)
    finished = threading.Event(); expired = threading.Event(); watchdog_failure = []
    remaining = max(0, (gate['deadlineAt'] - time.time()*1000)/1000)
    def watch_deadline():
        if not finished.wait(remaining):
            expired.set()
            try: capacity_gate_stop(p, docker, cid)
            except Exception: watchdog_failure.append(True)
    watchdog = threading.Thread(target=watch_deadline, name='capacity-candidate-deadline', daemon=False)
    watchdog.start()
    try:
        spec = docker.inspect(cid, 3)
        need(spec['Id'] == cid and spec['Config'].get('Entrypoint') == ['/bin/sh'] and
             spec['Config'].get('Cmd') == capacity_gate_arguments(p)[3:] and not spec['HostConfig'].get('Init') and
             spec['Config'].get('User') == p['limits']['app']['user'] and
             any(m.get('Source') == gate['hostFifo'] and m.get('Destination') == CAPACITY_GATE_PATH and m.get('RW') is False for m in spec.get('Mounts', [])), 'EXACT_PID1_GATE_AND_READONLY_FIFO_REQUIRED')
        docker.run(['start', cid], 5)
        process = capacity_process_tuple(p, docker, cid)
        profile_identity = file_identity(p['capacityHost']['profile']['hostFile'])
        journal.event('CAPACITY_GATE_WAITING_OWNER_FINAL_INPUT', containerId=cid, process=process, provisionalRuntimeIdentity=provisional,
                      deadlineAt=gate['deadlineAt'], provisionalProfileIdentity=profile_identity)
        final, final_ref = wait_capacity_owner_final(p, docker, cid, process, provisional, profile_identity, journal)
        final_profile_identity = file_identity(final['capacityHost']['profile']['hostFile'])
        final_profile_ctime = Path(final['capacityHost']['profile']['hostFile']).lstat().st_ctime_ns
        def final_guard(plan, candidate, actual_process, identity):
            need(reference(final_ref) == plan, 'FINAL_PLAN_CHANGED_AFTER_DELIVERY')
            validate_references(plan)  # All original source/backup/metadata/business/target guards.
            check_stage_entry(plan, docker); check_images_networks(plan, docker)
            need(capacity_process_tuple(plan, docker, candidate) == actual_process, 'SAME_PID_EXEC_TUPLE_CHANGED_BEFORE_RELEASE')
            need(file_identity(plan['runtimeConfiguration']['path']) == identity and
                 file_identity(plan['capacityHost']['profile']['hostFile']) == final_profile_identity and
                 Path(plan['capacityHost']['profile']['hostFile']).lstat().st_ctime_ns == final_profile_ctime, 'FINAL_RUNTIME_CHANGED_DURING_CLOSED_GUARDS')
            return True
        release_capacity_fifo(final, docker, cid, process, final['runtimeConfiguration']['identity'], final_guard)
        exec_deadline = min(gate['deadlineAt'], time.time()*1000 + 5000)
        while True:
            try:
                need(capacity_process_tuple(final, docker, cid, phase='node') == process, 'SAME_PID_EXEC_TUPLE_CHANGED_AFTER_RELEASE')
                break
            except Refused:
                need(time.time()*1000 < exec_deadline, 'CAPACITY_NODE_EXEC_NOT_CONFIRMED')
                time.sleep(0.01)
        need(not expired.is_set() and not watchdog_failure, 'CAPACITY_CONTROLLER_DEADLINE_OR_STOP_UNCONFIRMED')
        # Return the FINAL plan explicitly; caller must never persist/reuse provisional identity.
        return cid, final, final_ref
    except Exception:
        capacity_gate_stop(p, docker, cid)
        raise
    finally:
        finished.set(); watchdog.join(17)
        need(not watchdog.is_alive() and not watchdog_failure, 'CAPACITY_DEADLINE_WATCHDOG_STOP_UNCONFIRMED')
        need(not expired.is_set(), 'CAPACITY_CONTROLLER_DEADLINE_EXPIRED')


def write_boundary(p, restore_old=False, docker=None):
    need(not (first_install(p) and restore_old), 'FIRST_INSTALL_HAS_NO_LEGACY_ENTRY_RESTORE')
    if exact35_selected(p) or exact26_full(p):
        return full_write_boundary(p, restore_old, docker)
    value = reference(p.get('writeBoundary'))
    need(value.get('format') == 'naijue-rewrite-write-boundary-v1' and value.get('database') == DATABASE and
         value.get('buildId') == p['buildId'] and value.get('sourceCommit') == p['sourceCommit'] and value.get('writeAdmission') == 'CLOSED' and
         type(value.get('newBusinessWrites')) is int and value['newBusinessWrites'] == 0 and
         value.get('firstBusinessWriteAtUtc') is None and value.get('checkedBy'), 'NEW_WRITES_OR_UNKNOWN_REFUSE_OLD_ENTRY')
    fresh_time(value.get('checkedAtUtc'), 300)
    return value


_approved_current_stage = current_stage
_approved_shared_namespace = check_production_shared_namespace


def stage_creation_operation(p, receipt):
    creator = receipt.get('creationOperationId')
    ref = receipt.get('capacityFinalPlan', {})
    need(receipt.get('format') == 'naijue-candidate-stage-v1' and
         receipt.get('status') == 'CANDIDATE_STAGED_HEALTH_ONLY_NOT_BUSINESS' and
         receipt.get('entryMode') == FIRST_INSTALL_MODE and
         isinstance(creator, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,70}', creator) and
         isinstance(ref, dict) and re.fullmatch(
             r'/release-review/location-669cd1ebb0[a-f0-9]{16}/jobs/' + re.escape(creator) +
             r'/inputs-private/approved-capacity-final-plan[.]json', ref.get('path', '')),
         'FIRST_INSTALL_ORIGINAL_STAGE_CREATION_REQUIRED')
    final = reference(ref)
    need(first_install(final) and final.get('operationId') == creator and
         all(final.get(k) == p.get(k) for k in ('buildId', 'sourceCommit', 'archive', 'releaseDirectory')) and
         receipt.get('capacityFinalRuntimeIdentity') == final.get('runtimeConfiguration', {}).get('identity') and
         receipt.get('capacityProducer') == final.get('capacityHost') and
         receipt.get('runtime35BindingSha256') == runtime_binding(final) == runtime_binding(p),
         'FIRST_INSTALL_ORIGINAL_STAGE_FINAL_PLAN_CHANGED')
    return creator


def check_production_shared_namespace(p, docker, app_id=None):
    if app_id is None or not p.get('stageReceipt'):
        return _approved_shared_namespace(p, docker, app_id)
    stage_receipt = reference(p['stageReceipt'])
    creator = stage_creation_operation(p, stage_receipt)
    need(stage_receipt.get('containers', {}).get('app', {}).get('id') == app_id,
         'FIRST_INSTALL_STAGED_APP_ID_CHANGED')
    return _approved_shared_namespace(dict(p, operationId=creator), docker, app_id)


def current_stage(p, docker, manifest):
    staged = reference(p.get('stageReceipt'))
    creator = stage_creation_operation(p, staged)
    need(creator != p['operationId'], 'FIRST_INSTALL_ACTIVATE_REQUIRES_DISTINCT_STAGE_JOB')
    actual = _approved_current_stage(p, docker, manifest)
    need(actual == staged, 'FIRST_INSTALL_STAGE_RECEIPT_CHANGED')
    for role in ('app', 'stageWeb'):
        cid = actual['containers'][role]['id']
        info = docker.inspect(cid)
        need(info['Id'] == cid and info['State']['Running'] and
             own_container_fingerprint(info) == actual['containers'][role]['specSha256'] and
             info['Config'].get('Labels', {}).get('naijue.rapid-launch.created-by') == creator,
             'FIRST_INSTALL_STAGED_CONTAINER_CREATION_CHANGED')
    return actual


def r3_owned_readiness(p, docker, app_id):
    path=Path(__file__).with_name('app-readiness-owner.cjs')
    raw=bytes_file(path,16384)
    need(digest(raw)==FIRST_R3_READINESS_SHA,'FIRST_INSTALL_R3_EXACT_PID1_READY_PROBE_REQUIRED')
    script=raw.decode()+'\nmodule.exports.run(process.argv[1],process.argv[2]);'
    expected=json_file(p['runtimeConfiguration']['path'],private=True)['capacityLaunch']['process']
    need(type(expected) is dict and expected.get('pid')==1,'FIRST_INSTALL_R3_STAGE_PID1_REQUIRED')
    for _ in range(15):
        need(capacity_process_tuple(p,docker,app_id,phase='node')==expected,
             'FIRST_INSTALL_R3_STAGE_PID1_CHANGED')
        verdict=docker.run(['exec',app_id,'/usr/local/bin/node','-e',script,
                            expected['linuxStartTicks'],expected['linuxBootId']],5).strip()
        if verdict==b'APP_PID1_PORT3000_READY':
            need(capacity_process_tuple(p,docker,app_id,phase='node')==expected,
                 'FIRST_INSTALL_R3_STAGE_PID1_CHANGED')
            return
        if verdict!=b'APP_PID1_PORT3000_NOT_READY':
            safe={b'APP_PID1_PORT3000_OWNER_DIFFERS',b'APP_PID1_PORT3000_RESPONSE_OWNER_DIFFERS',
                  b'APP_PID1_EXEC_IDENTITY_DIFFERS',b'APP_PID1_SOCKET_FACTS_UNAVAILABLE'}
            raise Refused(verdict.decode() if verdict in safe else 'FIRST_INSTALL_R3_OWNED_READY_NOT_CONFIRMED')
        time.sleep(1)
    raise Refused('FIRST_INSTALL_R3_OWNED_READY_NOT_CONFIRMED')


def health(p, docker, app_id, via_web=None):
    r3=first_install_r3(p)
    if r3:
        r3_owned_readiness(p,docker,app_id)
    result=_base_health(p,docker,app_id,via_web)
    if r3 and via_web is not None:
        r3_owned_readiness(p,docker,app_id)
    return result


def unpack_first_install_cache(archive, rows):
    expected = {row['path']: row for row in rows}
    need(len(expected) == len(rows) and all(NPM_CACHE_MEMBER.fullmatch(path) for path in expected),
         'FIRST_INSTALL_NPM_CACHE_MANIFEST_MEMBERS_REFUSED')
    members = {}
    try:
        with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as stream:
            for member in stream:
                name = member.name  # tarfile resolves the PAX path before exposing the member.
                row = expected.get(name)
                need(row is not None and name not in members and member.type == tarfile.REGTYPE and
                     member.sparse is None and member.size == row['bytes'], 'FIRST_INSTALL_NPM_CACHE_MEMBER_REFUSED')
                with stream.extractfile(member) as handle:
                    data = handle.read()
                need(len(data) == row['bytes'] and digest(data) == row['sha256'], 'FIRST_INSTALL_NPM_CACHE_MEMBER_CHANGED')
                members[name] = data
    except (tarfile.TarError, EOFError, OSError):
        raise Refused('FIRST_INSTALL_NPM_CACHE_ARCHIVE_INVALID') from None
    need(members.keys() == expected.keys(), 'FIRST_INSTALL_NPM_CACHE_MEMBERS_MISSING')
    return members


def read_first_install_cache(p, entries):
    image = p['images']['node']
    need(IMAGE.fullmatch(image['id']) and image['platform'] == 'linux/amd64' and
         image['nodeVersion'] == '24.21.0' and image['npmVersion'] == '11.9.0', 'FIRST_INSTALL_NPM_CACHE_IMAGE_REFUSED')
    need(digest(entries.get('package.json', b'')) == FIRST_INSTALL_PACKAGE_SHA256 and
         digest(entries.get('package-lock.json', b'')) == FIRST_INSTALL_LOCK_SHA256, 'FIRST_INSTALL_NPM_CACHE_LOCK_REFUSED')

    job = canonical(os.environ['ERP_SHARED_JOB_DIR'], kind='directory', private=True)
    control = canonical(os.environ['ERP_SHARED_CONTROL_DIR'], kind='directory', private=True)
    bundle = canonical(job / 'bundle', kind='directory')
    need(job.name == control.name == p['operationId'] and bundle.stat().st_uid == 0 and
         Path(__file__).resolve() == bundle / 'deploy-first-install.py', 'FIRST_INSTALL_NPM_CACHE_JOB_BUNDLE_REQUIRED')
    frozen_ready = canonical(bundle / 'npm-cache-stage-receipt.json', private=True)
    manifest = canonical(bundle / 'CACHE-MEMBERS.json', private=True)
    need(frozen_ready.stat().st_uid == manifest.stat().st_uid == 0, 'FIRST_INSTALL_NPM_CACHE_FROZEN_INPUT_REQUIRED')
    manifest_raw = bytes_file(manifest, 65_536, private=True)
    need(digest(manifest_raw) == FIRST_INSTALL_NPM_CACHE_MANIFEST, 'FIRST_INSTALL_NPM_CACHE_MANIFEST_CHANGED')

    artifact = canonical(control.parent.parent / 'artifacts' / FIRST_INSTALL_NPM_CACHE_KEY, kind='directory', private=True)
    ready_path = artifact / 'ready.json'
    archive = artifact / 'archive.bin'
    owner = control.stat().st_uid
    need(owner != 0 and artifact.stat().st_uid == owner and
         file_identity(ready_path)['uid'] == file_identity(archive)['uid'] == owner, 'FIRST_INSTALL_NPM_CACHE_STAGE_OWNER_CHANGED')
    ready_raw = bytes_file(ready_path, 65_536, private=True)
    need(ready_raw == bytes_file(frozen_ready, 65_536, private=True), 'FIRST_INSTALL_NPM_CACHE_STAGE_RECEIPT_CHANGED')
    ready = json.loads(ready_raw)
    before = archive.stat()
    identity = [before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns]
    authority_sha256 = ready.get('authoritySha256', '') if isinstance(ready, dict) else ''
    need(isinstance(authority_sha256, str) and HASH.fullmatch(authority_sha256) and ready == {
        'status': 'READY', 'artifactKey': FIRST_INSTALL_NPM_CACHE_KEY, 'sourceSetSha256': FIRST_INSTALL_NPM_CACHE_MANIFEST,
        'archiveSha256': FIRST_INSTALL_NPM_CACHE_SHA256, 'archiveBytes': FIRST_INSTALL_NPM_CACHE_BYTES,
        'authoritySha256': authority_sha256, 'fileIdentity': identity,
    },
         'FIRST_INSTALL_NPM_CACHE_STAGE_RECEIPT_CHANGED')
    archive_raw = bytes_file(archive, FIRST_INSTALL_NPM_CACHE_BYTES, private=True)
    after = archive.stat()
    need(len(archive_raw) == FIRST_INSTALL_NPM_CACHE_BYTES and digest(archive_raw) == FIRST_INSTALL_NPM_CACHE_SHA256 and
         identity == [after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns] and
         bytes_file(ready_path, 65_536, private=True) == ready_raw, 'FIRST_INSTALL_NPM_CACHE_ARCHIVE_CHANGED')
    return unpack_first_install_cache(archive_raw, json.loads(manifest_raw))


def install_first_install_dependencies(p, docker, release, manifest, cache_members):
    cache = release / 'npm-cache'
    cache.mkdir(mode=0o700)
    for name, data in cache_members.items():
        target = cache / name
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data)

    # Keep the pinned legacy helper byte-for-byte and adapt only its npm call.
    def run(args, *rest):
        if args[2] == p['names']['installer'] + '-npm':
            need(args[-1] == '--cache=/tmp/npm-cache', 'FIRST_INSTALL_NPM_CACHE_ARGV_CHANGED')
            at = args.index('--entrypoint')
            args = [*args[:at], *mount(cache, '/offline-cache', False), *args[at:-1], '--cache=/offline-cache', '--offline']
        return docker.run(args, *rest)

    installed = install_linux_dependencies(p, SimpleNamespace(run=run), release, manifest)
    shutil.rmtree(cache)
    return installed


def stage(p, docker, journal, manifest, entries):
    need('stageReceipt' not in p, 'FIRST_INSTALL_STAGE_NO_PRIOR_STAGE_RECEIPT')
    release = Path(p['releaseDirectory'])
    need(not release.exists() and not release.is_symlink(), 'RELEASE_EXISTS_NO_REPLAY')
    cache_members = read_first_install_cache(p, entries)
    release.mkdir(mode=0o700)
    payload = release / 'payload'
    payload.mkdir(mode=0o755)
    journal.event('EXTRACT_EXACT_RELEASE_MEMBERS')
    for name, content in entries.items():
        target = payload / name
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o444)
        with os.fdopen(fd, 'wb') as f:
            f.write(content)
    journal.event('INSTALL_LOCKED_LINUX_RUNTIME_DEPENDENCIES_ONCE', npmCacheSha256=FIRST_INSTALL_NPM_CACHE_SHA256)
    installed = install_first_install_dependencies(p, docker, release, manifest, cache_members)
    journal.event('CREATE_PRIVATE_CANDIDATE_APP')
    app, final_plan, final_ref = run_capacity_gate_controller(p, docker, journal)
    p.clear(); p.update(final_plan)
    journal.event('APP_CREATED_AND_CAPACITY_GATE_RELEASED', containerId=app)
    app_health = health(p, docker, app)
    web = create_web(p, docker)
    journal.event('PRIVATE_WEB_CREATED', containerId=web)
    docker.run(['start', web])
    web_health = health(p, docker, app, p['names']['stageWeb'])
    check_stage_entry(p, docker)
    containers = {}
    for role, cid in [('app', app), ('stageWeb', web)]:
        info = docker.inspect(cid)
        assert_own(info, p, 'app' if role == 'app' else 'web')
        need(info['Id'] == cid and info['Config'].get('Labels', {}).get('naijue.rapid-launch.created-by') == p['operationId'],
             'FIRST_INSTALL_STAGE_CREATION_CHANGED')
        containers[role] = {'id': cid, 'specSha256': own_container_fingerprint(info), 'imageId': info['Image']}
    value = {'format': 'naijue-candidate-stage-v1', 'status': 'CANDIDATE_STAGED_HEALTH_ONLY_NOT_BUSINESS',
             'entryMode': FIRST_INSTALL_MODE, 'creationOperationId': p['operationId'], 'buildId': p['buildId'],
             'sourceCommit': p['sourceCommit'], 'archiveSha256': p['archive']['sha256'], 'manifestSha256': p['manifest']['sha256'],
             'capacityFinalPlan': final_ref, 'capacityFinalRuntimeIdentity': p['runtimeConfiguration']['identity'],
             'capacityProducer': p['capacityHost'],
             'releaseDirectory': str(release), 'installedPayloadSha256': installed, 'containers': containers,
             'health': {'app': app_health, 'proxy': web_health}, 'schemaVersions': p['schemaVersions'], 'database': runtime_database(p),
             'databaseQueriedByDeploymentTool': False, 'productionEntryChanged': False, 'businessAcceptance': False, 'finishedAtUtc': now()}
    if exact35_selected(p) or exact26_selected(p):
        value[runtime_binding_field(p)] = runtime_binding(p)
    new_json(release / 'stage-receipt.json', value)
    return value


def activate(p, docker, journal, manifest):
    acceptance(p)
    write_boundary(p)
    staged = current_stage(p, docker, manifest)
    health(p, docker, staged['containers']['app']['id'], p['names']['stageWeb'])
    public_id, old_stopped = None, False
    initial = first_install(p)
    try:
        if initial:
            check_first_install_boot_actors()
            check_first_install_entry(p, docker)
        else:
            # Persist intent before touching the entry; unknown outcomes are read back.
            journal.event('STOP_EXACT_OLD_WEB_INTENT')
            docker.run(['stop', '--time', '20', p['beforeCAS']['services'][OLD_NAMES[1]]['id']], 40)
            old_stopped = True
            check_old(p, docker, web_running=False)
        write_boundary(p)
        validate_references(p)
        if initial:
            journal.event('FIRST_INSTALL_CREATE_PUBLIC_WEB_INTENT')
        public_id = create_web(p, docker, True)
        journal.event('PUBLIC_WEB_CREATED', containerId=public_id)
        docker.run(['start', public_id])
        observed = health(p, docker, staged['containers']['app']['id'], p['names']['publicWeb'])
        loopback_health(p)
        if initial:
            check_first_install_boot_actors()
            check_first_install_entry(p, docker, public_id, active=True)
        else:
            check_old(p, docker, web_running=False)
        write_boundary(p)
        info = docker.inspect(public_id)
        assert_own(info, p, 'web', True)
        result = {'format': 'naijue-entry-activation-v1', 'status': 'ENTRY_ACTIVATED_INTERNAL_HEALTH_ONLY_PENDING_PUBLIC_READBACK',
                  'buildId': p['buildId'], 'sourceCommit': p['sourceCommit'], 'archiveSha256': p['archive']['sha256'],
                  'publicContainer': {'id': public_id, 'specSha256': own_container_fingerprint(info)},
                  'health': observed, 'stageReceiptSha256': p['stageReceipt']['sha256'], 'candidateAcceptanceSha256': p['candidateAcceptance']['sha256'],
                  'backupReceiptSha256': (reference(p['runtime35']['references']['backupCoverage'])['logicalBackupReceipt']['sha256']
                                          if initial else p['backupReceipt']['sha256']), 'database': runtime_database(p),
                  'oldAppAndDatabaseUnchanged': True,
                  'databaseRestorePerformed': False, 'publicHttpsReadbackPerformed': False, 'bootPersistenceVerified': False,
                  'businessAcceptanceCreatedByDeployment': False, 'finishedAtUtc': now()}
        if exact35_selected(p) or exact26_selected(p):
            result[runtime_binding_field(p)] = runtime_binding(p)
        if initial:
            result['entryMode'] = FIRST_INSTALL_MODE
            result['creationOperationId'] = p['operationId']
        else:
            result['oldWebId'] = p['beforeCAS']['services'][OLD_NAMES[1]]['id']
        new_json(Path(p['releaseDirectory']) / 'activation-receipt.json', result)
        return result
    except Exception:
        journal.event('ACTIVATION_FAILED_RECOVERY_DECISION_REQUIRED', oldWebStopReturned=old_stopped, publicWebId=public_id)
        if initial:
            if public_id is None:
                journal.event('FIRST_INSTALL_ENTRY_NOT_CONFIRMED_NO_REPLAY')
            else:
                try:
                    info = docker.inspect(public_id)
                    assert_own(info, p, 'web', True)
                    need(info['Id'] == public_id and info['Config']['Labels']['naijue.rapid-launch.created-by'] == p['operationId'],
                         'FIRST_INSTALL_ENTRY_NOT_THIS_OPERATION')
                    if info['State']['Running']:
                        docker.run(['stop', '--time', '15', public_id], 30)
                    need(not docker.inspect(public_id)['State']['Running'], 'FIRST_INSTALL_ENTRY_STOP_UNCONFIRMED')
                    journal.event('FAILED_FIRST_INSTALL_ENTRY_STOP_CONFIRMED', containerId=public_id)
                except Exception:
                    journal.event('FIRST_INSTALL_ENTRY_OUTCOME_UNKNOWN_NO_REPLAY')
            raise
        # Inspect the precise old ID even when stop timed out; recover only a confirmed stopped old web and a closed write boundary.
        try:
            state = docker.inspect(p['beforeCAS']['services'][OLD_NAMES[1]]['id'])
            if not state['State']['Running']:
                restored = restore_old_entry(p, docker, journal, public_id)
                journal.event('OLD_ENTRY_RESTORED', oldWeb=restored)
            else:
                check_old(p, docker, web_restart=True)
        except Exception:
            journal.event('RECOVERY_UNCONFIRMED_REQUIRES_C_OPERATOR_NO_REPLAY')
        raise


def execute(p, phase):
    job = exact_host(p)
    with open('/release-review/location-051e4f31e6', 'a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        journal = Journal(p, phase)
        docker = Docker()
        try:
            manifest, entries = validate_references(p, capacity_pending=phase == 'stage')
            check_stage_entry(p, docker)
            check_images_networks(p, docker)
            value = stage(p, docker, journal, manifest, entries) if phase == 'stage' else activate(p, docker, journal, manifest)
            journal.finish(value['status'], dockerCommands=docker.commands)
            new_json(job / 'results' / ('candidate-' + phase + '.json'), value)
            return value
        except Exception as error:
            if phase == 'stage':
                # Stop only exact new containers carrying this operation's immutable creation label. Keep all files/containers.
                for role, key in [('web', 'stageWeb'), ('app', 'app')]:
                    try:
                        info = docker.inspect(p['names'][key])
                        assert_own(info, p, role)
                        need(info['Config'].get('Labels', {}).get('naijue.rapid-launch.created-by') == p['operationId'], 'NOT_THIS_OPERATION_CONTAINER')
                        if info['State']['Running']:
                            docker.run(['stop', '--time', '15', info['Id']], 30)
                        journal.event('FAILED_STAGE_CONTAINER_STOPPED', containerId=info['Id'])
                    except Exception:
                        journal.event('FAILED_STAGE_CONTAINER_STOP_NOT_CONFIRMED', role=role)
            code = str(error) if isinstance(error, Refused) else type(error).__name__
            failure = journal.finish('FAILED_PRESERVED_NO_REPLAY', failureCode=code, dockerCommands=docker.commands,
                                     requiresOperator=True, oldAppOrDbRollbackAttempted=False)
            new_json(job / 'results' / ('candidate-' + phase + '.json'), failure)
            raise Refused(code) from None


def capacity_original_owner_authority(p, scope, directory, authority, authority_ref):
    """Consume the existing lease and frozen job delegation, not a new dynamic signing/approval system."""
    need(os.geteuid() == 0 and os.environ.get('ERP_SHARED_TASK_ID') == 'T45', 'ORIGINAL_T45_ROOT_PHASE_REQUIRED')
    job = canonical(Path(os.environ.get('ERP_SHARED_JOB_DIR', '/nonexistent')), kind='directory', private=True)
    control = canonical(Path(os.environ.get('ERP_SHARED_CONTROL_DIR', '/nonexistent')), kind='directory', private=True)
    need(job.name == scope['jobId'] == control.name and directory == control/'capacity-final', 'ORIGINAL_LIVE_JOB_CHANNEL_REQUIRED')
    config_path = Path('/usr/local/lib/naijue-erp-night')/('grant-'+scope['grantId'])/'grant.json'
    grant_file = canonical(config_path)
    need(grant_file.stat().st_uid == 0 and not grant_file.stat().st_mode & 0o022, 'ORIGINAL_ROOT_GRANT_CONFIGURATION_REQUIRED')
    grant = json_file(grant_file)
    need(grant.get('grantId') == scope['grantId'] and grant.get('scope') == 'ERP_EXISTING_TASKS_THROUGH_T51' and
         not grant.get('revoked') and type(grant.get('expiresAtEpoch')) in (int, float) and
         time.time()*1000 < scope['deadlineAt'] <= grant['expiresAtEpoch']*1000 and
         grant.get('private') == str(job.parent.parent) and grant.get('control') == str(control.parent.parent) and
         grant.get('humanAuthorization', {}).get('sourceChat') == '9adb1619-14c5-51cb-be26-7268d2594cc6', 'ORIGINAL_ACTIVE_HUMAN_GRANT_REQUIRED')
    account = pwd.getpwnam(grant['user'])
    need(control.stat().st_uid == directory.stat().st_uid == account.pw_uid and
         control.stat().st_gid == directory.stat().st_gid == account.pw_gid and account.pw_uid != 0, 'ORIGINAL_AUTHENTICATED_CONTROL_OWNER_REQUIRED')
    request_file = canonical(job/'request.json', private=True)
    manifest_file = canonical(job/'bundle/bundle-manifest.json', private=True)
    need(job.stat().st_uid == request_file.stat().st_uid == manifest_file.stat().st_uid == 0, 'ROOT_FROZEN_ORIGINAL_REQUEST_REQUIRED')
    request = json_file(request_file, private=True)
    receipt = json_file(control.parent.parent/'results'/(job.name+'.json'))
    need(receipt.get('status') == 'RUNNING' and receipt.get('jobId') == scope['jobId'] and receipt.get('taskId') == 'T45' and
         receipt.get('grantId') == scope['grantId'], 'ORIGINAL_JOB_MUST_STILL_BE_RUNNING')
    manifest_raw = bytes_file(manifest_file, 131072, private=True)
    manifest = capacity_transport_json(manifest_raw)
    need(request.get('jobId') == scope['jobId'] and request.get('taskId') == 'T45' and request.get('grantId') == scope['grantId'] and
         request.get('scope') == grant['scope'] and request.get('manifestSha256') == digest(manifest_raw) and
         manifest.get('jobId') == scope['jobId'] and manifest.get('taskId') == 'T45', 'ORIGINAL_REQUEST_MANIFEST_BINDING_REQUIRED')
    records = {r['name']: r for r in manifest.get('files', [])}
    frozen_authority = canonical(job/'bundle/capacity-input-authority.json', private=True)
    frozen_helper = canonical(job/'bundle/deploy-first-install.py', private=True)
    frozen_base = canonical(job/'bundle/deploy-candidate.py', private=True)
    need(frozen_base.stat().st_uid == 0 and file_hash(frozen_base) == APP576_HELPER_SHA256 and
         records.get('deploy-candidate.py', {}).get('sha256') == APP576_HELPER_SHA256,
         'ROOT_FROZEN_APP576_BASE_HELPER_REQUIRED')
    need(frozen_authority.stat().st_uid == frozen_helper.stat().st_uid == 0 and
         file_hash(frozen_helper) == scope['helperSha256'], 'ROOT_FROZEN_AUTHORITY_AND_HELPER_REQUIRED')
    need(authority_ref['path'] == str(job/'bundle/capacity-input-authority.json') and
         records.get('capacity-input-authority.json', {}).get('sha256') == authority_ref['sha256'] and
         records.get('deploy-first-install.py', {}).get('sha256') == scope['helperSha256'] == file_hash(Path(__file__)) and
         reference(authority_ref) == authority and authority.get('action') == 'ONE_FINAL_CAPACITY_PLAN_ONLY' and
         authority.get('target') is not None and digest(encoded(authority['target'])) == scope['targetFingerprint'] and
         authority.get('sourceCommit') == scope['sourceCommit'] and authority.get('deadlineAt') == scope['deadlineAt'] and
         authority.get('operationId') == p['operationId'] and authority.get('buildId') == p['buildId'], 'ORIGINAL_SCOPED_FINAL_INPUT_DELEGATION_REQUIRED')
    # This original authenticated account already has the scoped ONE_FINAL input
    # delegation. Its later exact decision is DATA consumed under that authority,
    # not an authority inferred from uid0, a JSON claim, nonce or a new signature.
    return _CAPACITY_ORIGINAL_OWNER_PROOF


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, Refused) else 'CANDIDATE_DEPLOYMENT_FAILED_NO_REPLAY', file=__import__('sys').stderr)
        raise SystemExit(2)
