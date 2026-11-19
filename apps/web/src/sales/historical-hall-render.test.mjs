import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('approved V2 migration evidence renders five unknown source facts without replacing them with target facts', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const temp = await mkdtemp(path.join(here, '.historical-hall-render-'));
  try {
    const out = path.join(temp, 'entry.mjs');
    await build({
      stdin: { resolveDir: here, loader: 'tsx', contents: `
        export {createElement} from 'react';
        export {renderToStaticMarkup} from 'react-dom/server';
        export {buildHistoricalSalesHallEvidenceV2,parseHistoricalSalesHallEvidence} from '../../../../packages/application/src/historical-sales-hall-evidence.ts';
        export {HistoricalHallNote} from './historical-hall-note.tsx';
        export {historicalHallFacts,salesHallLabel} from './historical-hall.ts';
        export {detail} from './commands/fixtures.test-support.ts';
        export {salesDocumentOutput} from '../components/document-output-contracts.ts';
        export {createDocumentPrintHtml} from '../components/document-output.tsx';
      ` },
      outfile: out, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' },
      external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
      banner: { js: "import{createRequire}from'node:module';const require=createRequire(import.meta.url);" },
      logLevel: 'warning',
    });
    const lib = await import(pathToFileURL(out).href);
    const original = lib.detail(), { hallId, warehouseId } = original.document.header;
    const evidence = lib.parseHistoricalSalesHallEvidence(JSON.parse(JSON.stringify(lib.buildHistoricalSalesHallEvidenceV2({
      basis: 'MIGRATION_DERIVED', original_hall_id: null, selected_hall_id: hallId, warehouse_id: warehouseId,
      target_snapshot: { warehouse_id: warehouseId, hall_id: hallId, version: 8, captured_at: '2026-11-05T04:00:00Z' },
      source_capture: null, identity_bridge: null, resolution: null, has_difference: false, review_required: false,
      migration_decision: { basis: 'USER_APPROVED_NEW_WAREHOUSE_HALL', decision_ref: 'synthetic:approval:1', evidence_sha256: 'a'.repeat(64),
        source_refs: [{ file_sha256: 'a'.repeat(64), sheet: 'SYNTHETIC', row: 1 }] },
    }))));
    const source = ['来源仓库编号', '来源原生版本', '来源有效版本', '来源仓库所属厅编号', '来源归属采集时间'];
    const facts = new Map(lib.historicalHallFacts(evidence));
    for (const label of source) assert.strictEqual(facts.get(label), null, label);
    assert.equal(facts.get('目标仓库所属厅编号'), hallId);
    assert.equal(facts.get('目标仓库版本'), '8');
    assert.equal(facts.get('目标仓库采集时间'), '2026-11-05T04:00:00Z');
    assert.match(lib.salesHallLabel('采用厅', hallId, evidence, true), /经批准的迁移裁决/);
    assert.match(lib.salesHallLabel('调整厅', hallId, evidence, true, true), /已调整/);

    const rendered = new JSDOM(lib.renderToStaticMarkup(lib.createElement(lib.HistoricalHallNote, { evidence })));
    try {
      const doc = rendered.window.document;
      assert.match(doc.querySelector('summary').textContent, /经批准的迁移裁决/);
      const displayed = new Map([...doc.querySelectorAll('dt')].map(dt => [dt.textContent, dt.nextElementSibling.textContent]));
      for (const label of source) assert.equal(displayed.get(label), '未记录', label);
      assert.equal(displayed.get('目标仓库版本'), '8');
    } finally { rendered.window.close(); }

    const resolved = lib.buildHistoricalSalesHallEvidenceV2({
      basis: 'MIGRATION_DERIVED', original_hall_id: null, selected_hall_id: hallId, warehouse_id: warehouseId,
      target_snapshot: { warehouse_id: warehouseId, hall_id: hallId, version: 8, captured_at: '2026-11-05T04:00:00Z' },
      source_capture: { capture_evidence_sha256: 'a'.repeat(64), source_namespace: 'qa:hall-v2',
        warehouse_source_key: 'warehouse:1', runtime_warehouse_id: warehouseId, source_native_version: 0,
        effective_version: 0, runtime_hall_ids: [hallId, warehouseId].sort(), captured_at: '2026-11-05T03:00:00Z',
        transaction_snapshot: '1:2:', relation_basis: 'VERIFIED_SOURCE_CAPTURE' },
      identity_bridge: { evidence_sha256: 'b'.repeat(64), record_key: 'bridge:1' },
      resolution: { evidence_sha256: 'c'.repeat(64), record_key: 'resolution:1' }, has_difference: true, review_required: false,
    });
    const summaryFor = (evidence, differsFromCurrent = false) => {
      const view = new JSDOM(lib.renderToStaticMarkup(lib.createElement(lib.HistoricalHallNote, { evidence, differsFromCurrent })));
      try { return view.window.document.querySelector('summary').textContent; }
      finally { view.window.close(); }
    };
    assert.match(summaryFor(resolved), /按已确认仓库归属采用/);
    assert.doesNotMatch(summaryFor(resolved), /待核/);
    assert.match(summaryFor(resolved, true), /当前厅或仓已调整/);
    assert.match(summaryFor({ basis: 'ORIGINAL', original_hall_id: hallId, selected_hall_id: hallId, warehouse_id: warehouseId, warehouse_hall_id_at_capture: warehouseId, warehouse_version: 1, captured_at: '2026-11-05T04:00:00Z', has_difference: true, review_required: true, format_version: 'HISTORICAL_SALES_HALL_EVIDENCE_V1' }), /差异，待核/);

    const output = lib.salesDocumentOutput({ ...original, stockBasis: 'CUTOFF_HISTORY', historicalHallEvidence: evidence, historicalHallDiffersFromCurrent: false });
    const printed = new JSDOM(lib.createDocumentPrintHtml(output));
    try {
      const metadata = [...printed.window.document.querySelectorAll('.meta span')].map(span => span.textContent);
      for (const label of source) assert.ok(metadata.includes(label + '：未记录'), label);
      assert.ok(metadata.includes('目标仓库版本：8'));
      assert.ok(metadata.some(line => line.startsWith('营业厅取值依据：经批准的迁移裁决')));
    } finally { printed.window.close(); }
  } finally { await rm(temp, { recursive: true, force: true }); }
});
