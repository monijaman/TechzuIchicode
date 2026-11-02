export function validateStockQuantity(quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error('Stock quantity must be a non-negative whole number');
  }

  return quantity;
}

export function validateRequestedQuantity(quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('Requested quantity must be a positive whole number');
  }

  return quantity;
}

export function canDeductStock({ available, requested }: { available: number; requested: number }): boolean {
  validateStockQuantity(available);
  validateRequestedQuantity(requested);
  return requested <= available;
}

export function deductStock({ available, requested }: { available: number; requested: number }): number {
  if (!canDeductStock({ available, requested })) {
    throw new Error('Insufficient stock');
  }

  return available - requested;
}

export function restockStock({ available, quantity }: { available: number; quantity: number }): number {
  validateStockQuantity(available);
  validateRequestedQuantity(quantity);
  const result = available + quantity;

  if (!Number.isSafeInteger(result)) {
    throw new Error('Stock quantity exceeds the safe integer range');
  }

  return result;
}
