export class OrderPlacedEvent {
  orderId!: string;
  channel!: string;
  itemCount!: number;
  total!: string;
  createdBy!: string;
}

export class StockLowEvent {
  ingredientId!: string;
  ingredientName!: string;
  currentQty!: number;
  minQty!: number;
  unit!: string;
  zoneId!: string;
}

export class OrderReadyEvent {
  orderId!: string;
  channel!: string;
  createdBy!: string;
}

export class DeliveryUpdatedEvent {
  orderId!: string;
  deliveryStatus!: string;
  deliveryAddress!: string | null;
  createdBy!: string;
}

export class TaskBlockedEvent {
  taskId!: string;
  taskTitle!: string;
  ownerUserId!: string;
  blockedReason!: string | null;
}
