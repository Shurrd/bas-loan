// Half-up: floor((2N + D) / 2D)
export const divHalfUp = (numerator: bigint, denominator: bigint) => {
    if (numerator < 0n || denominator <= 0n) {
        throw new RangeError(
            "divHalfUp needs a non-negative numerator and positive denominator"
        );
    }
    return (2n * numerator + denominator) / (2n * denominator);
};

const NAIRA_PATTERN = /^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/;

/** Reads a naira string such as "1,200,000.50" into kobo. Never goes through a float. */
export const parseNaira = (input: string) => {
    const match = NAIRA_PATTERN.exec(input.trim());
    if (!match) return null;

    const whole = (match[1] ?? "").replaceAll(",", "");
    const decimals = (match[3] ?? "").slice(1).padEnd(2, "0");
    return BigInt(whole + decimals);
};

const group = (digits: bigint) => digits.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const formatNaira = (kobo: bigint) => {
    const abs = kobo < 0n ? -kobo : kobo;
    return `${kobo < 0n ? "-" : ""}₦${group(abs / 100n)}.${String(abs % 100n).padStart(2, "0")}`;
};

export const formatKobo = (kobo: bigint) =>
    `${kobo < 0n ? "-" : ""}${group(kobo < 0n ? -kobo : kobo)} kobo`;
