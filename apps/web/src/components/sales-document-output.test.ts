import assert from 'node:assert/strict';
import test from 'node:test';
import { detail } from '../sales/tests/fixtures.ts';
import { salesDocumentOutput } from './document-output-contracts.ts';

function fixture(businessType: 'SALE' | 'RETURN' | 'EXCHANGE') {
  const source = detail(), original = source.document.lines[0]!;
  const incoming = { ...original, id: '00000000-0000-0000-0000-000000000710' as typeof original.id,
    quantity: '-1', dealPrice: '3000', lineAmount: '-3000', isGift: false };
  const outgoing = { ...original, id: '00000000-0000-0000-0000-000000000711' as typeof original.id,
    quantity: '2', dealPrice: '3000', lineAmount: '6000', isGift: false };
  const gift = { ...original, id: '00000000-0000-0000-0000-000000000712' as typeof original.id,
    quantity: '-2', dealPrice: '0', lineAmount: '0', isGift: true };
  const sum = businessType === 'RETURN' ? '-3000' : '3000';
  return { ...source, document: { ...source.document,
    header: { ...source.document.header, businessType, grossAmount: sum, orderDiscount: '0', netDue: sum },
    lines: businessType === 'RETURN' ? [incoming, gift] : [outgoing, incoming, gift],
  } };
}

test('signed SALE keeps signs and gift classification on paper without changing export or totals', () => {
  const doc = salesDocumentOutput(fixture('SALE'));
  const printed = doc.printSections![0]!;
  assert.equal(printed.title, '销售商品');
  assert.deepEqual(printed.rows.map(row => [row[2], row[4]]), [['2', '60.00'], ['-1', '-30.00'], ['-2', '0.00']]);
  assert.match(printed.rows[2]![0]!, /（赠品）$/);
  assert.deepEqual(doc.sections[0]!.rows.map(row => [row[7], row[12]]), [['2', '60.00'], ['-1', '-30.00'], ['-2', '0.00']]);
  assert.equal(doc.totals.find(([key]) => key === '数量（不含赠品）')?.[1], '1');
  assert.equal(doc.totals.find(([key]) => key === '商品金额')?.[1], '30.00');
});

test('RETURN and EXCHANGE still show directional sections with magnitude quantities and amounts', () => {
  for (const kind of ['RETURN', 'EXCHANGE'] as const) {
    const doc = salesDocumentOutput(fixture(kind)), printed = doc.printSections!;
    assert.equal(printed[0]!.title, '退回商品');
    assert.deepEqual(printed[0]!.rows.map(row => [row[2], row[4]]), [['1', '30.00'], ['2', '0.00']]);
    assert.match(printed[0]!.rows[1]![0]!, /（赠品）$/);
    if (kind === 'EXCHANGE') {
      assert.equal(printed[1]!.title, '换出商品');
      assert.deepEqual(printed[1]!.rows.map(row => [row[2], row[4]]), [['2', '60.00']]);
    }
  }
});
