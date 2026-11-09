import type { Fraction } from "../types/money";

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

const reduce = (numerator: bigint, denominator: bigint): Fraction => {
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
};

/** "18.75" (percent) becomes the exact fraction 3/16 */
export const parseRate = (percent: string) => {
    const match = /^(\d+)(?:\.(\d+))?$/.exec(percent);
    if (!match) throw new Error(`Invalid rate: ${percent}`);

    const decimals = match[2] ?? "";
    return reduce(BigInt(match[1] + decimals), 100n * 10n ** BigInt(decimals.length));
};

export const monthlyRate = (annual: Fraction) =>
    reduce(annual.numerator, annual.denominator * 12n);
