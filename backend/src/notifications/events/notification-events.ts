export interface OrderPlacedEvent {
  orderId: string;
  channel: string;
  itemCount: number;
  total: string;
  createdBy: string;
}

export interface StockLowEvent {
  ingredientId: string;
  ingredientName: string;
  currentQty: number;
  minQty: number;
  unit: string;
  zoneId: string;
}

export interface OrderReadyEvent {
  orderId: string;
  channel: string;
  createdBy: string;
}

export interface DeliveryUpdatedEvent {
  orderId: string;
  deliveryStatus: string;
  deliveryAddress: string | null;
  createdBy: string;
}

export interface TaskBlockedEvent {
  taskId: string;
  taskTitle: string;
  ownerUserId: string;
  blockedReason: string | null;
}
