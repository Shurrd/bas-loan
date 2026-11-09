export function parseKobo(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid kobo amount: ${value}`);
  }
  return BigInt(value);
}

// floor((2N + D) / (2D)): half-up without leaving integer arithmetic.
export function divHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new RangeError("divHalfUp needs a non-negative numerator and a positive denominator");
  }
  return (2n * numerator + denominator) / (2n * denominator);
}
