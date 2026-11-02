export type PriceInput = {
  basePrice: number;
  overridePrice: number | null;
};

export type SaleLine = {
  unitPrice: number;
  quantity: number;
};

export function validatePrice(price: number): number {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Price must be a positive number');
  }

  return price;
}

export function validateQuantity(quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number');
  }

  return quantity;
}

export function resolveUnitPrice({ basePrice, overridePrice }: PriceInput): number {
  return validatePrice(overridePrice ?? basePrice);
}

export function calculateLineTotal({ unitPrice, quantity }: SaleLine): number {
  validatePrice(unitPrice);
  validateQuantity(quantity);
  return Math.round(unitPrice * quantity * 100) / 100;
}

export function calculateSaleTotal(lines: SaleLine[]): number {
  return Math.round(lines.reduce((total, line) => total + calculateLineTotal(line), 0) * 100) / 100;
}
