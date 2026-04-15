/** Em `NODE_ENV=test`, permite fixar o relógio de faturação (fecho lazy / simulações). */
export function billingAsOf(): Date {
  const raw = process.env.TEST_BILLING_AS_OF;
  if (process.env.NODE_ENV === "test" && raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }
  return new Date();
}
