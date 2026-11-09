export const parseKobo = (value: string) => {
    if (!/^\d+$/.test(value)) throw new Error(`Invalid kobo amount: ${value}`);
    return BigInt(value);
};

// Half-up: floor((2N + D) / 2D)
export const divHalfUp = (numerator: bigint, denominator: bigint) => {
    if (numerator < 0n || denominator <= 0n) {
        throw new RangeError(
            "divHalfUp needs a non-negative numerator and positive denominator"
        );
    }
    return (2n * numerator + denominator) / (2n * denominator);
};
