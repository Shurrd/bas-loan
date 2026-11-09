const config: Record<string, { dot: string; text: string; bg: string }> = {
    active: { dot: "#12B76A", text: "#027A48", bg: "#ECFDF3" },
    repaid: { dot: "#98A2B3", text: "#344054", bg: "#F2F4F7" },
    settled: { dot: "#12B76A", text: "#027A48", bg: "#ECFDF3" },
    open: { dot: "#F79009", text: "#B54708", bg: "#FFFAEB" },
    paid: { dot: "#12B76A", text: "#027A48", bg: "#ECFDF3" },
    "part paid": { dot: "#F79009", text: "#B54708", bg: "#FFFAEB" },
    unpaid: { dot: "#98A2B3", text: "#344054", bg: "#F2F4F7" },
};

export default function StatusBadge({ status }: { status: string }) {
    const style = config[status.toLowerCase()] ?? config["unpaid"]!;

    return (
        <span
            style={{ backgroundColor: style.bg, color: style.text }}
            className="inline-flex items-center gap-1.5 rounded-4xl px-2.5 py-1 text-[13px] font-medium"
        >
            <span
                style={{ backgroundColor: style.dot }}
                className="h-1.5 w-1.5 rounded-full"
            />
            <span>{status}</span>
        </span>
    );
}
