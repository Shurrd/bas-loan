import type { JournalEntryRecord } from "./loan";

export type InstalmentAllocation = {
    number: number;
    penalty: bigint;
    fee: bigint;
    interest: bigint;
    principal: bigint;
};

export type Allocation = {
    received: bigint;
    lines: InstalmentAllocation[];
    penalty: bigint;
    fee: bigint;
    interest: bigint;
    principal: bigint;
    unapplied: bigint;
};

export type PaymentPreview = {
    stateVersion: bigint;
    allocation: Allocation;
};

export type PaymentResult = {
    stateVersion: bigint;
    allocation: Allocation;
    entry: JournalEntryRecord;
};
