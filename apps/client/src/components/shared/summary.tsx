export default function Summary({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-gray-500 text-xs uppercase">{label}</p>
            <p className="text-sm font-medium">{value}</p>
        </div>
    );
}
