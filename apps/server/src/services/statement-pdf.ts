import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import {
    BRAND_NAME,
    formatKobo,
    formatNaira,
    LOGO_COLORS,
    LOGO_SHAPES,
    LOGO_SIZE,
    type LoanRecord,
    type Statement,
} from "@lending/shared";
import PDFDocument from "pdfkit";

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

export const formatDate = (iso: string) => {
    const [year, month, day] = iso.split("-");
    return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
};

const naira = (kobo: bigint) => formatNaira(kobo);

// What the statement says, kept apart from how it is drawn so it can be tested as text
export const statementRows = (statement: Statement) =>
    statement.lines.map((line) => ({
        date: formatDate(line.date),
        description: line.description,
        account: line.accountName,
        debit: line.debit === 0n ? "" : naira(line.debit),
        credit: line.credit === 0n ? "" : naira(line.credit),
        balance: naira(line.principalBalance),
    }));

export const loanFacts = (loan: LoanRecord) => [
    { label: "Principal", value: naira(loan.principal) },
    { label: "Annual rate", value: `${loan.annualRatePercent}%` },
    { label: "Term", value: `${loan.termMonths} months` },
    { label: "Disbursed", value: formatDate(loan.disbursementDate) },
];

export const reconciliation = (tieOut: Statement["tieOut"]) =>
    tieOut.matches
        ? {
              matched: true,
              label: "Reconciled",
              detail: ["Equals the repayment schedule"],
          }
        : {
              matched: false,
              label: "Does not reconcile",
              detail: [
                  `Difference ${formatKobo(tieOut.difference)}`,
                  `(${naira(tieOut.difference)})`,
              ],
          };

export const statementFileName = (loanId: bigint) => `loan-${loanId}-statement.pdf`;

const NOTE =
    "The principal balance moves only on Loans Receivable lines: a disbursement adds to it and the principal part of a payment reduces it. " +
    "Interest, fees, penalties and Unapplied Credit do not change it. The reconciliation compares the closing balance above with the principal still outstanding on the repayment schedule.";

const PAGE = { width: 595.28, height: 841.89, margin: 40 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const FOOTER_Y = PAGE.height - 38;
const BOTTOM_LIMIT = PAGE.height - 66;
const ROW_HEIGHT = 21;

const COLOR = {
    ink: "#2F4A63",
    text: "#1A1A1A",
    muted: "#667085",
    faint: "#98A2B3",
    line: "#E4E7EC",
    band: "#F6F7F8",
    zebra: "#FAFAFB",
    good: "#027A48",
    goodBg: "#ECFDF3",
    bad: "#B42318",
    badBg: "#FEF3F2",
};

const COLUMNS = [
    { key: "date", label: "DATE", width: 68, align: "left" },
    { key: "description", label: "DESCRIPTION", width: 112, align: "left" },
    { key: "account", label: "ACCOUNT", width: 86, align: "left" },
    { key: "debit", label: "DEBIT", width: 74, align: "right" },
    { key: "credit", label: "CREDIT", width: 74, align: "right" },
    { key: "balance", label: "PRINCIPAL BALANCE", width: 101, align: "right" },
] as const;

type Weight = "regular" | "medium" | "semibold" | "bold";

const require = createRequire(import.meta.url);
const fontDir = join(dirname(require.resolve("@fontsource/inter/package.json")), "files");

// Inter's Latin file has the digits and its Latin Extended file has the naira sign,
// so each weight is registered twice and the sign is drawn with the second one.
const WEIGHTS: Record<Weight, string> = {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
};

const registerFonts = (doc: PDFKit.PDFDocument) => {
    for (const [weight, number] of Object.entries(WEIGHTS)) {
        doc.registerFont(weight, join(fontDir, `inter-latin-${number}-normal.woff`));
        doc.registerFont(
            `${weight}-naira`,
            join(fontDir, `inter-latin-ext-${number}-normal.woff`)
        );
    }
};

type TextStyle = { size: number; weight?: Weight; color?: string; spacing?: number };

const textWidth = (doc: PDFKit.PDFDocument, text: string, style: TextStyle) =>
    doc
        .font(style.weight ?? "regular")
        .fontSize(style.size)
        .widthOfString(text, { characterSpacing: style.spacing ?? 0 });

// Money may start with a sign and always has the naira sign, which needs its own font
const splitNaira = (text: string) => {
    const at = text.indexOf("₦");
    return at === -1
        ? { before: text, sign: "", after: "" }
        : { before: text.slice(0, at), sign: "₦", after: text.slice(at + 1) };
};

const mixedWidth = (doc: PDFKit.PDFDocument, text: string, style: TextStyle) => {
    const { before, sign, after } = splitNaira(text);
    const weight = style.weight ?? "regular";
    return (
        textWidth(doc, before + after, style) +
        (sign
            ? textWidth(doc, sign, { ...style, weight: `${weight}-naira` as Weight })
            : 0)
    );
};

// pdfkit wraps text that has a width, even with lineBreak off, so long text is cut to fit by measuring
const fitText = (
    doc: PDFKit.PDFDocument,
    text: string,
    maxWidth: number,
    style: TextStyle
) => {
    if (mixedWidth(doc, text, style) <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && mixedWidth(doc, `${cut}\u2026`, style) > maxWidth)
        cut = cut.slice(0, -1);
    return `${cut}\u2026`;
};

const drawText = (
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    style: TextStyle & { width?: number; align?: "left" | "right" | "center" }
) => {
    const options = {
        width: style.width,
        align: style.align,
        lineBreak: false,
        characterSpacing: style.spacing ?? 0,
    };
    doc.font(style.weight ?? "regular")
        .fontSize(style.size)
        .fillColor(style.color ?? COLOR.text)
        .text(text, x, y, options);
};

// Draws text that may hold the naira sign, left or right aligned
const drawMixed = (
    doc: PDFKit.PDFDocument,
    text: string,
    anchor: { x?: number; right?: number },
    y: number,
    style: TextStyle
) => {
    const total = mixedWidth(doc, text, style);
    let x = anchor.right !== undefined ? anchor.right - total : (anchor.x ?? 0);
    const { before, sign, after } = splitNaira(text);
    const weight = style.weight ?? "regular";

    for (const part of [
        { value: before, weight },
        { value: sign, weight: `${weight}-naira` as Weight },
        { value: after, weight },
    ]) {
        if (!part.value) continue;
        drawText(doc, part.value, x, y, { ...style, weight: part.weight });
        x += textWidth(doc, part.value, { ...style, weight: part.weight });
    }
};

// A slim bar in the logo's colours across the top of every page
const drawAccent = (doc: PDFKit.PDFDocument) => {
    doc.rect(0, 0, PAGE.width, 5).fill(LOGO_COLORS.ink);
    doc.rect(0, 0, 56, 5).fill(LOGO_COLORS.paid);
};

const drawLogo = (doc: PDFKit.PDFDocument, x: number, y: number, size: number) => {
    const scale = size / LOGO_SIZE;
    for (const shape of LOGO_SHAPES) {
        if (shape.kind === "rect") {
            doc.roundedRect(
                x + shape.x * scale,
                y + shape.y * scale,
                shape.width * scale,
                shape.height * scale,
                shape.radius * scale
            ).fill(shape.fill);
        } else {
            doc.circle(
                x + shape.cx * scale,
                y + shape.cy * scale,
                shape.radius * scale
            ).fill(shape.fill);
        }
    }
};

const drawBrand = (doc: PDFKit.PDFDocument, y: number, size: number) => {
    drawLogo(doc, PAGE.margin, y, size);
    drawText(doc, BRAND_NAME, PAGE.margin + size + 10, y + size / 2 - 10, {
        size: 18,
        weight: "semibold",
        color: COLOR.ink,
    });
};

const drawTableHeader = (doc: PDFKit.PDFDocument, y: number) => {
    doc.roundedRect(PAGE.margin, y, CONTENT_WIDTH, 24, 6).fill(COLOR.band);
    let x = PAGE.margin;
    for (const column of COLUMNS) {
        drawText(doc, column.label, x + 8, y + 8, {
            size: 6.5,
            weight: "semibold",
            color: COLOR.muted,
            spacing: 0.6,
            width: column.width - 16,
            align: column.align,
        });
        x += column.width;
    }
    return y + 24;
};

const drawContinuation = (doc: PDFKit.PDFDocument, loanId: bigint) => {
    drawAccent(doc);
    drawLogo(doc, PAGE.margin, 36, 22);
    drawText(doc, BRAND_NAME, PAGE.margin + 30, 40, {
        size: 12,
        weight: "semibold",
        color: COLOR.ink,
    });
    drawText(doc, `Loan ${loanId} statement, continued`, PAGE.margin, 40, {
        size: 9,
        color: COLOR.muted,
        width: CONTENT_WIDTH,
        align: "right",
    });
    doc.moveTo(PAGE.margin, 68)
        .lineTo(PAGE.width - PAGE.margin, 68)
        .lineWidth(1)
        .stroke(COLOR.line);
    return drawTableHeader(doc, 82);
};

const drawRow = (
    doc: PDFKit.PDFDocument,
    row: ReturnType<typeof statementRows>[number],
    y: number,
    shaded: boolean
) => {
    if (shaded) doc.rect(PAGE.margin, y, CONTENT_WIDTH, ROW_HEIGHT).fill(COLOR.zebra);
    let x = PAGE.margin;
    for (const column of COLUMNS) {
        const value = row[column.key];
        const inner = { x: x + 8, width: column.width - 16 };
        const isMoney = column.align === "right";
        if (isMoney) {
            drawMixed(doc, value, { right: x + column.width - 8 }, y + 6.5, {
                size: 8,
                weight: column.key === "balance" ? "semibold" : "regular",
            });
        } else {
            const style = {
                size: 8,
                color: column.key === "date" ? COLOR.muted : COLOR.text,
            };
            drawText(
                doc,
                fitText(doc, value, inner.width, style),
                inner.x,
                y + 6.5,
                style
            );
        }
        x += column.width;
    }
    doc.moveTo(PAGE.margin, y + ROW_HEIGHT)
        .lineTo(PAGE.width - PAGE.margin, y + ROW_HEIGHT)
        .lineWidth(0.5)
        .stroke(COLOR.line);
};

const drawFooters = (doc: PDFKit.PDFDocument, loanId: bigint) => {
    const { start, count } = doc.bufferedPageRange();
    for (let index = 0; index < count; index++) {
        doc.switchToPage(start + index);
        doc.moveTo(PAGE.margin, FOOTER_Y - 8)
            .lineTo(PAGE.width - PAGE.margin, FOOTER_Y - 8)
            .lineWidth(0.5)
            .stroke(COLOR.line);
        drawText(
            doc,
            `${BRAND_NAME}  ·  Statement for loan ${loanId}`,
            PAGE.margin,
            FOOTER_Y,
            {
                size: 7.5,
                color: COLOR.faint,
            }
        );
        drawText(doc, `Page ${index + 1} of ${count}`, PAGE.margin, FOOTER_Y, {
            size: 7.5,
            color: COLOR.faint,
            width: CONTENT_WIDTH,
            align: "right",
        });
    }
};

export type StatementPdfInput = {
    loan: LoanRecord;
    statement: Statement;
    generatedOn: string;
};

export const buildStatementPdf = ({ loan, statement, generatedOn }: StatementPdfInput) =>
    new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            margin: 0,
            bufferPages: true,
            info: {
                Title: `Loan ${loan.id} statement`,
                Author: BRAND_NAME,
                Subject: "Loan statement",
            },
        });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        registerFonts(doc);

        // Header
        drawAccent(doc);
        drawBrand(doc, 38, 36);
        drawText(doc, "LOAN STATEMENT", PAGE.margin, 40, {
            size: 7.5,
            weight: "semibold",
            color: COLOR.muted,
            spacing: 1.2,
            width: CONTENT_WIDTH,
            align: "right",
        });
        drawText(doc, `Loan ${loan.id}`, PAGE.margin, 53, {
            size: 22,
            weight: "bold",
            color: COLOR.ink,
            width: CONTENT_WIDTH,
            align: "right",
        });
        drawText(doc, `Generated ${formatDate(generatedOn)}`, PAGE.margin, 82, {
            size: 8.5,
            color: COLOR.muted,
            width: CONTENT_WIDTH,
            align: "right",
        });
        doc.moveTo(PAGE.margin, 104)
            .lineTo(PAGE.width - PAGE.margin, 104)
            .lineWidth(1)
            .stroke(COLOR.line);

        // Loan facts
        doc.roundedRect(PAGE.margin, 120, CONTENT_WIDTH, 58, 8).fill(COLOR.band);
        const facts = loanFacts(loan);
        const factWidth = CONTENT_WIDTH / facts.length;
        facts.forEach((fact, index) => {
            const x = PAGE.margin + index * factWidth + 16;
            drawText(doc, fact.label.toUpperCase(), x, 134, {
                size: 6.5,
                weight: "semibold",
                color: COLOR.muted,
                spacing: 0.8,
            });
            drawMixed(doc, fact.value, { x }, 148, { size: 11.5, weight: "semibold" });
        });

        // Summary tiles
        const gap = 12;
        const tileWidth = (CONTENT_WIDTH - gap * 2) / 3;
        const tileY = 194;
        const result = reconciliation(statement.tieOut);
        const tiles = [
            {
                label: "CLOSING PRINCIPAL BALANCE",
                value: naira(statement.closingBalance),
            },
            {
                label: "OUTSTANDING PER SCHEDULE",
                value: naira(statement.tieOut.outstandingPrincipal),
            },
        ];
        tiles.forEach((tile, index) => {
            const x = PAGE.margin + index * (tileWidth + gap);
            doc.roundedRect(x, tileY, tileWidth, 77, 8).lineWidth(1).stroke(COLOR.line);
            drawText(doc, tile.label, x + 14, tileY + 14, {
                size: 6.5,
                weight: "semibold",
                color: COLOR.muted,
                spacing: 0.8,
            });
            drawMixed(doc, tile.value, { x: x + 14 }, tileY + 32, {
                size: 15,
                weight: "bold",
                color: COLOR.ink,
            });
        });

        const reconX = PAGE.margin + 2 * (tileWidth + gap);
        doc.roundedRect(reconX, tileY, tileWidth, 77, 8).lineWidth(1).stroke(COLOR.line);
        drawText(doc, "RECONCILIATION", reconX + 14, tileY + 14, {
            size: 6.5,
            weight: "semibold",
            color: COLOR.muted,
            spacing: 0.8,
        });
        const pillColor = result.matched ? COLOR.good : COLOR.bad;
        const pillWidth =
            textWidth(doc, result.label, { size: 8.5, weight: "semibold" }) + 22;
        doc.roundedRect(reconX + 14, tileY + 28, pillWidth, 17, 8.5).fill(
            result.matched ? COLOR.goodBg : COLOR.badBg
        );
        doc.circle(reconX + 14 + 9, tileY + 36.5, 2.5).fill(pillColor);
        drawText(doc, result.label, reconX + 14 + 16, tileY + 32, {
            size: 8.5,
            weight: "semibold",
            color: pillColor,
        });
        const detailStyle = { size: 7, color: COLOR.muted };
        result.detail.forEach((line, index) => {
            drawMixed(
                doc,
                fitText(doc, line, tileWidth - 28, detailStyle),
                { x: reconX + 14 },
                tileY + 52 + index * 9.5,
                detailStyle
            );
        });

        // Ledger lines
        drawText(doc, "Ledger lines", PAGE.margin, 295, {
            size: 10.5,
            weight: "semibold",
        });
        let y = drawTableHeader(doc, 313);

        statementRows(statement).forEach((row, index) => {
            if (y + ROW_HEIGHT > BOTTOM_LIMIT) {
                doc.addPage();
                y = drawContinuation(doc, loan.id);
            }
            drawRow(doc, row, y, index % 2 === 1);
            y += ROW_HEIGHT;
        });

        // Closing balance
        if (y + 34 > BOTTOM_LIMIT) {
            doc.addPage();
            y = drawContinuation(doc, loan.id);
        }
        doc.roundedRect(PAGE.margin, y + 8, CONTENT_WIDTH, 26, 6).fill(COLOR.ink);
        drawText(doc, "Closing principal balance", PAGE.margin + 12, y + 16.5, {
            size: 9,
            weight: "semibold",
            color: "#FFFFFF",
        });
        drawMixed(
            doc,
            naira(statement.closingBalance),
            { right: PAGE.width - PAGE.margin - 12 },
            y + 16,
            {
                size: 10.5,
                weight: "bold",
                color: "#FFFFFF",
            }
        );
        y += 34 + 14;

        // How to read it
        const noteHeight = 44;
        if (y + noteHeight > BOTTOM_LIMIT) {
            doc.addPage();
            y = drawContinuation(doc, loan.id);
        }
        doc.font("regular")
            .fontSize(7.5)
            .fillColor(COLOR.muted)
            .text(NOTE, PAGE.margin, y, {
                width: CONTENT_WIDTH,
                lineGap: 2.5,
            });

        drawFooters(doc, loan.id);
        doc.end();
    });
