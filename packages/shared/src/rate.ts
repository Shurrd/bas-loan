export interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function reduce(numerator: bigint, denominator: bigint): Fraction {
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

// "18.75" (percent) becomes the exact fraction 3/16, not a float.
export function parseRate(percent: string): Fraction {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(percent);
  if (!match) {
    throw new Error(`Invalid rate: ${percent}`);
  }
  const whole = match[1] ?? "";
  const decimals = match[2] ?? "";
  return reduce(BigInt(whole + decimals), 100n * 10n ** BigInt(decimals.length));
}

export function monthlyRate(annual: Fraction): Fraction {
  return reduce(annual.numerator, annual.denominator * 12n);
}
