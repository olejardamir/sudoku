export async function saveTextFile(text: string, fileName: string): Promise<void> {
  if ("showSaveFilePicker" in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const picker = (window as any).showSaveFilePicker;
    const handle = await picker({
      suggestedName: fileName,
      types: [
        {
          description: "Text Files",
          accept: { "text/plain": [".txt"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return;
  }
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
