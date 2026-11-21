/** Hand a clip to the browser as a file. */
export function saveClip(bytes: ArrayBuffer, format: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: format }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
