// Shown under a server quote only when it differs from the preview built on this device
export default function PreviewCheck({
    lines,
    blocked,
}: {
    lines: string[];
    blocked: string;
}) {
    if (lines.length === 0) return null;

    return (
        <div
            role="alert"
            className="text-danger-700 bg-danger-100 rounded-md px-3 py-2 text-sm"
        >
            <p className="font-medium">
                The preview on this device does not match the server quote. {blocked}
            </p>
            <ul className="mt-1 list-disc pl-5">
                {lines.map((line) => (
                    <li key={line}>{line}</li>
                ))}
            </ul>
        </div>
    );
}
