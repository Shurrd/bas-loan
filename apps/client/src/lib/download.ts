export const fileNameFromDisposition = (header: string | undefined, fallback: string) =>
    /filename="([^"]+)"/.exec(header ?? "")?.[1] ?? fallback;

export const saveBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
};
