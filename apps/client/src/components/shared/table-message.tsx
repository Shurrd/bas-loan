/** Single full-width row for loading, error and empty states inside a table body. */
export default function TableMessage({
    colSpan,
    children,
}: {
    colSpan: number;
    children: React.ReactNode;
}) {
    return (
        <tr>
            <td colSpan={colSpan} className="text-gray-500 px-4 py-10 text-center">
                {children}
            </td>
        </tr>
    );
}
