// Prices use integer cents; balances retain the existing whole-currency settlement rule.
export const priceCents = price => Math.round(price * 100);
export function payment(amount, cents) {
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(amount * cents)) throw new Error('交易金额无效');
  return Math.ceil(amount * cents / 100);
}
export const orderPayment = order => order.paymentPerCycle ?? payment(order.amount, order.priceCents ?? priceCents(order.price));
