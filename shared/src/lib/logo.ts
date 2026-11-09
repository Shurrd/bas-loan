// The mark: three bars that shorten as the balance reduces, and a green dot for what is paid.
// It is plain shapes, so the app draws it as SVG and the statement PDF draws it as vectors.
export type LogoShape =
    | {
          kind: "rect";
          x: number;
          y: number;
          width: number;
          height: number;
          radius: number;
          fill: string;
      }
    | { kind: "circle"; cx: number; cy: number; radius: number; fill: string };

export const LOGO_SIZE = 64;

export const LOGO_COLORS = { ink: "#2F4A63", paid: "#12B76A" };

export const LOGO_SHAPES: LogoShape[] = [
    {
        kind: "rect",
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        radius: 16,
        fill: LOGO_COLORS.ink,
    },
    { kind: "rect", x: 14, y: 15, width: 36, height: 8, radius: 4, fill: "#FFFFFF" },
    { kind: "rect", x: 14, y: 28, width: 26, height: 8, radius: 4, fill: "#D6E0EA" },
    { kind: "rect", x: 14, y: 41, width: 16, height: 8, radius: 4, fill: "#AFC1D3" },
    { kind: "circle", cx: 44, cy: 45, radius: 5, fill: LOGO_COLORS.paid },
];

export const BRAND_NAME = "Lending";
