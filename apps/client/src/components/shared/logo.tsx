import { BRAND_NAME, LOGO_SHAPES, LOGO_SIZE } from "@lending/shared";

export function LogoMark({ size = 28 }: { size?: number }) {
    return (
        <svg
            viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`}
            width={size}
            height={size}
            role="img"
            aria-label={`${BRAND_NAME} logo`}
        >
            {LOGO_SHAPES.map((shape, index) =>
                shape.kind === "rect" ? (
                    <rect
                        key={index}
                        x={shape.x}
                        y={shape.y}
                        width={shape.width}
                        height={shape.height}
                        rx={shape.radius}
                        fill={shape.fill}
                    />
                ) : (
                    <circle
                        key={index}
                        cx={shape.cx}
                        cy={shape.cy}
                        r={shape.radius}
                        fill={shape.fill}
                    />
                )
            )}
        </svg>
    );
}

export default function Logo() {
    return (
        <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-primary text-base font-semibold">{BRAND_NAME}</span>
        </div>
    );
}
