/**
 * Loading placeholder for the Daily Report tables. Mirrors the real table's
 * card + header + rows so the first load doesn't flash plain text or jump.
 */
export function TableSkeleton({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  // Cycled cell widths so the rows look natural rather than uniform.
  const cellWidths = [120, 96, 112, 88, 104, 80, 72, 96];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[960px]">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3.5">
                  <div className="h-2.5 w-16 bg-gray-100 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: columns }).map((_, c) =>
                  c === 0 ? (
                    <td key={c} className="px-4 py-3">
                      <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ) : (
                    <td key={c} className="px-4 py-3">
                      <div
                        className="h-8 bg-gray-100 rounded-lg animate-pulse"
                        style={{ width: cellWidths[c % cellWidths.length] }}
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
