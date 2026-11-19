"""Verify the public snapshot and exercise the actual Writer input predicate without opening a database."""
import ast
import copy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "release-audit/snapshot-index.json"
WRITER_HOST = ROOT / "release-audit/continuation/final33_host.py"
ERROR = "FINAL33_EXACT_LIVE_416_MATERIALIZATION_REQUIRED"


def require(condition, code):
    if not condition:
        raise ValueError(code)


def verify_file_index():
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    for group in ("app", "writer", "wrappers"):
        records = index[group]
        require(len({row["path"] for row in records}) == len(records), f"duplicate {group} path")
        for row in records:
            target = (ROOT / row["reviewFile"]).resolve()
            require(target.is_relative_to(ROOT), f"unsafe path {row['reviewFile']}")
            require(hashlib.sha256(target.read_bytes()).hexdigest() == row["reviewSha256"],
                    f"review checksum mismatch: {row['reviewFile']}")
            if not row.get("redactions"):
                require(row["reviewSha256"] == row["releaseSha256"],
                        f"unexplained source delta: {row['reviewFile']}")
    version = index["version"]
    require(len(index["writer"]) + version["writerPrivateBindingsOmitted"] == version["writerFilesOfficial"],
            "source closure count mismatch")
    require(version["appCatalog"]["modelSha256"] == version["catalogModelSha256"],
            "APP / Writer catalog model mismatch")
    return version


def verify_materialization_guard(version):
    source = ast.parse(WRITER_HOST.read_text(encoding="utf-8"))
    bindings = {"ACTIVE_SOURCE_MARKER_FIELDS", "ACTIVE_SOURCE_CATALOG"}
    nodes = [
        item for item in source.body
        if isinstance(item, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id in bindings for target in item.targets
        ) or isinstance(item, ast.FunctionDef) and item.name == "verify_active_input"
    ]
    require(len(nodes) == 3, "Writer guard shape changed")
    env = {"need": require}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(WRITER_HOST), "exec"), env)
    expected = env["ACTIVE_SOURCE_MARKER_FIELDS"]
    catalog = env["ACTIVE_SOURCE_CATALOG"]
    require(expected["sourceFiles"] == version["writerFilesOfficial"], "guard expects wrong source count")
    require(catalog["modelSha256"] == version["catalogModelSha256"], "guard expects wrong model")
    require(catalog["sourceSetSha256"] == version["writerSourceSetSha256"], "guard expects wrong writer source")
    require(catalog["catalogSpecSha256"] == version["writerCatalogSpecSha256"], "guard expects wrong catalog spec")

    guard = env["verify_active_input"]
    synthetic = {**expected, "runtimeCatalog": catalog, "ordinaryActorReadability": {
        "openedCodeFilesWithoutBodyRead": version["writerFilesOfficial"] - version["writerPrivateBindingsOmitted"]
    }}
    guard(synthetic)
    negative = [
        ("old source count", {"sourceFiles": 408}),
        ("incomplete source", {"sourceFiles": 415}),
        ("wrong content fingerprint", {"sourceSetSha256": "0" * 64}),
        ("wrong runtime fingerprint", {"operatorRuntimeSourceSetSha256": "0" * 64}),
        ("wrong directory model", {"runtimeCatalog": {**catalog, "modelSha256": "0" * 64}}),
        ("wrong readable count", {"ordinaryActorReadability": {"openedCodeFilesWithoutBodyRead": 414}}),
    ]
    for label, override in negative:
        altered = copy.deepcopy(synthetic)
        altered.update(override)
        try:
            guard(altered)
        except ValueError as error:
            require(str(error) == ERROR, f"unexpected guard rejection: {label}")
        else:
            raise ValueError(f"invalid fixture passed: {label}")
    print(f"Verified snapshot hashes, common catalog model, and {len(negative) + 1} offline Writer inputs.")


if __name__ == "__main__":
    verify_materialization_guard(verify_file_index())
