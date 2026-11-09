import { describe, expect, it } from "vitest";
import { buildSchedule } from "./schedule";

describe("Worked Example 1", () => {
  const schedule = buildSchedule({
    principal: 120_000_000n,
    annualRatePercent: "18",
    termMonths: 6,
    disbursementDate: "2025-01-15",
  });

  const expected = [
    [21_063_026n, 1_800_000n, 19_263_026n, 100_736_974n],
    [21_063_026n, 1_511_055n, 19_551_971n, 81_185_003n],
    [21_063_026n, 1_217_775n, 19_845_251n, 61_339_752n],
    [21_063_026n, 920_096n, 20_142_930n, 41_196_822n],
    [21_063_026n, 617_952n, 20_445_074n, 20_751_748n],
    [21_063_024n, 311_276n, 20_751_748n, 0n],
  ];

  it("matches the brief row by row", () => {
    expect(schedule.map((i) => [i.payment, i.interest, i.principal, i.closingBalance])).toEqual(expected);
  });

  it("totals 6,378,154 kobo of interest", () => {
    expect(schedule.reduce((sum, i) => sum + i.interest, 0n)).toBe(6_378_154n);
  });

  it("falls due monthly from the disbursement date", () => {
    expect(schedule.map((i) => i.dueDate)).toEqual([
      "2025-02-15",
      "2025-03-15",
      "2025-04-15",
      "2025-05-15",
      "2025-06-15",
      "2025-07-15",
    ]);
  });
});

describe("buildSchedule", () => {
  it("clamps due dates to month end without drifting", () => {
    const schedule = buildSchedule({
      principal: 100_000n,
      annualRatePercent: "12",
      termMonths: 4,
      disbursementDate: "2025-01-31",
    });
    expect(schedule.map((i) => i.dueDate)).toEqual(["2025-02-28", "2025-03-31", "2025-04-30", "2025-05-31"]);
  });

  it("handles a one month term", () => {
    const [only] = buildSchedule({
      principal: 100_000n,
      annualRatePercent: "12",
      termMonths: 1,
      disbursementDate: "2025-01-01",
    });
    expect(only).toMatchObject({ interest: 1_000n, principal: 100_000n, payment: 101_000n, closingBalance: 0n });
  });

  it("splits a zero rate loan evenly", () => {
    const schedule = buildSchedule({
      principal: 100n,
      annualRatePercent: "0",
      termMonths: 3,
      disbursementDate: "2025-01-01",
    });
    expect(schedule.map((i) => i.payment)).toEqual([33n, 33n, 34n]);
  });

  it("rejects a non-positive principal and a bad term", () => {
    const base = { annualRatePercent: "18", disbursementDate: "2025-01-01" };
    expect(() => buildSchedule({ ...base, principal: 0n, termMonths: 6 })).toThrow();
    expect(() => buildSchedule({ ...base, principal: 1000n, termMonths: 0 })).toThrow();
    expect(() => buildSchedule({ ...base, principal: 1000n, termMonths: 1.5 })).toThrow();
  });
});
