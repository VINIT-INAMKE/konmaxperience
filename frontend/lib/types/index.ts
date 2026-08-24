export * from './auth';
export * from './roles';
export * from './permissions';
export * from './users';
export * from './missions';
export * from './quests';
export * from './tasks';
export * from './evidence';
export * from './recipe';
export * from './ingredient';
export * from './vendor';
export * from './catalog';
export * from './inventory';
export * from './purchase-order';
export * from './kitchen';
export * from './kds';
export * from './notifications';
export * from './exports';
export * from './imports';
export * from './settings';
export * from './modules';
export * from './nodes';
export * from './header';
export * from './usage';

// ── P5b: storefront + staff commerce ────────────────────────────────────────
// Every name below is unique across the barrel — `export *` drops an ambiguous
// re-export silently, so a collision here would delete a type rather than fail.
// Shared vocabulary has exactly one home: `ProductType`/`FulfilmentType` in
// `catalog`, `OrderStatus`/`PaymentStatus` in `kds`, `CouponType` in
// `promotions`, `ShipmentStatus` in `shipments`, `LoyaltyTier` in `checkout`.
export * from './storefront';
export * from './checkout';
export * from './shipments';
export * from './promotions';
export * from './reviews';
export * from './customers';
export * from './refunds';
