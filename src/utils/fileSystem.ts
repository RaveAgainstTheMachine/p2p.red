
interface FSEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (success: (f: File) => void, error: (e: Error) => void) => void;
}
export const readDirEntry = async (entry: FileSystemEntry | any, prefix = ''): Promise<File[]> => {
  const files: File[] = [];
  const reader = entry.createReader();
  const readBatch = (): Promise<any[]> =>
    new Promise((res, rej) => reader.readEntries(res, rej));

  let batch: unknown[];
  do {
    batch = await readBatch();
    for (const child of batch) {
      const c = child as FSEntry;
      if (c.isFile) {
        const file: File = await new Promise((res, rej) => c.file(res, rej));
        try {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: prefix + file.name,
            writable: false,
            configurable: true,
          });
        } catch { /* already set */ }
        files.push(file);
      } else if (c.isDirectory) {
        files.push(...await readDirEntry(c, prefix + c.name + '/'));
      }
    }
  } while (batch.length > 0);

  return files;
};
