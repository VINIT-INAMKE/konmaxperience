import { TaskSubjectType } from '@prisma/client';
import { bridgeDeepLink, renderBridgeNote } from './bridge-links';

describe('bridgeDeepLink', () => {
  it.each([
    [TaskSubjectType.recipe, '/operations/recipes/r-1'],
    [TaskSubjectType.product, '/operations/menu?product=r-1'],
    [TaskSubjectType.event, '/operations/events/r-1'],
    [TaskSubjectType.vendor, '/operations/vendors/r-1'],
    [TaskSubjectType.purchase_order, '/operations/purchase-orders/r-1'],
    [TaskSubjectType.prep_batch, '/operations/kitchen/prep-batches?batch=r-1'],
    [TaskSubjectType.order, '/orders/r-1'],
    [TaskSubjectType.decision, '/decisions?decision=r-1'],
  ])('renders %s as %s', (subjectType, expected) => {
    expect(bridgeDeepLink(subjectType, 'r-1')).toBe(expected);
  });

  it('covers every TaskSubjectType member', () => {
    for (const subjectType of Object.values(TaskSubjectType)) {
      expect(bridgeDeepLink(subjectType, 'x')).toMatch(/^\//);
    }
  });

  it('returns app-relative paths, never absolute URLs', () => {
    for (const subjectType of Object.values(TaskSubjectType)) {
      expect(bridgeDeepLink(subjectType, 'x')).not.toMatch(/^https?:/);
    }
  });
});

describe('renderBridgeNote', () => {
  it('substitutes every placeholder', () => {
    expect(
      renderBridgeNote('PO {po} received from {vendor}', {
        po: 'PO-1',
        vendor: 'Acme',
      }),
    ).toBe('PO PO-1 received from Acme');
  });

  it('renders a missing key as an em-dash', () => {
    expect(renderBridgeNote('rating {rating}/5', {})).toBe('rating —/5');
  });

  it('renders a null or undefined value as an em-dash', () => {
    expect(renderBridgeNote('{a} then {b}', { a: null, b: undefined })).toBe(
      '— then —',
    );
  });

  it('stringifies numbers and zero', () => {
    expect(
      renderBridgeNote('{qty} units, {cost} cost', { qty: 0, cost: 12.5 }),
    ).toBe('0 units, 12.5 cost');
  });

  it('returns a template with no placeholders verbatim', () => {
    expect(renderBridgeNote('Nothing to fill in.', { a: 1 })).toBe(
      'Nothing to fill in.',
    );
  });

  it('ignores keys that the template does not reference', () => {
    expect(renderBridgeNote('only {a}', { a: 'x', unused: 'y' })).toBe(
      'only x',
    );
  });
});
