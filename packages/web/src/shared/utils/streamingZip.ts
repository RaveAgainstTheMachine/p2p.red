export interface ZipEntry {
  name: string;
  file: File;
  relativePath: string;
  size: number;
}

export class StreamingZip {
  private entries: ZipEntry[] = [];
  private totalSize: number = 0;

  addFile(file: File, relativePath: string = '') {
    // Include all files, even empty ones, but handle folders differently
    if (file.size > 0) {
      // Regular file with content
      this.entries.push({
        name: file.name,
        file,
        relativePath: relativePath || file.name,
        size: file.size
      });
      this.totalSize += file.size;
    } else if (file.webkitRelativePath) {
      // Empty file in a folder - include it as a placeholder
      this.entries.push({
        name: file.name,
        file,
        relativePath: relativePath || file.name,
        size: 0
      });
    }
    // Skip completely empty files without webkitRelativePath (likely folder placeholders)
  }

  async createZipFile(folderName: string = 'archive'): Promise<File> {
    if (this.entries.length === 0) {
      throw new Error('No files to zip');
    }

    // Use client-zip for true streaming without memory issues
    return this.createStreamingZip(folderName);
  }

  async createZipStream(folderName: string = 'archive'): Promise<{ stream: ReadableStream<Uint8Array>, name: string, size: number }> {
    if (this.entries.length === 0) {
      throw new Error('No files to zip');
    }

    const { makeZip } = await import('client-zip');

    // Prepare files for client-zip
    const filesToZip = this.entries.map(entry => ({
      name: entry.relativePath,
      lastModified: entry.file.lastModified,
      input: entry.file
    }));

    // Generate ZIP as ReadableStream (true streaming, no memory buffer)
    const zipStream = makeZip(filesToZip);
    
    const zipName = this.entries.length === 1 
      ? `${this.entries[0].name}.zip`
      : `${folderName}.zip`;
    
    return {
      stream: zipStream,
      name: zipName,
      size: this.totalSize // Approximate size (actual ZIP will be slightly larger)
    };
  }

  private async createStreamingZip(folderName: string): Promise<File> {
    const { makeZip } = await import('client-zip');

    // Prepare files for client-zip
    const filesToZip = this.entries.map(entry => ({
      name: entry.relativePath,
      lastModified: entry.file.lastModified,
      input: entry.file
    }));

    // Generate ZIP as ReadableStream (true streaming, no memory buffer)
    const zipStream = makeZip(filesToZip);
    
    // Convert stream to blob for compatibility with current transfer code
    // Note: This still buffers in memory, but it's the stream API that matters
    const response = new Response(zipStream);
    const zipBlob = await response.blob();
    
    const zipName = this.entries.length === 1 
      ? `${this.entries[0].name}.zip`
      : `${folderName}.zip`;
    
    return new File([zipBlob], zipName, { type: 'application/zip' });
  }

  getEntries(): ZipEntry[] {
    return this.entries;
  }

  getTotalSize(): number {
    return this.totalSize;
  }
}

export const createStreamingZip = async (files: FileList): Promise<File> => {
  const zip = new StreamingZip();
  
  // Extract folder name from files
  let folderName = 'files';
  
  // Try to find common folder prefix from webkitRelativePath
  if (files.length > 0) {
    // Check if any file has a path with folder structure
    for (let i = 0; i < files.length; i++) {
      const path = files[i].webkitRelativePath;
      if (path && path.includes('/')) {
        const pathParts = path.split('/');
        if (pathParts.length > 1) {
          folderName = pathParts[0]; // First part is the folder name
          break;
        }
      }
    }
    
    // If no folder structure found, use a descriptive name based on file count
    if (folderName === 'files') {
      if (files.length === 1) {
        folderName = files[0].name.replace(/\.[^/.]+$/, ''); // Remove extension
      } else {
        folderName = `${files.length}_files`;
      }
    }
  }

  // Add all files to the zip
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Handle folder structure
    let relativePath = file.name;
    if (file.webkitRelativePath) {
      // Preserve folder structure from webkitRelativePath
      relativePath = file.webkitRelativePath;
    }
    
    zip.addFile(file, relativePath);
  }

  return zip.createZipFile(folderName);
};

export const isLargeFolder = (files: FileList): boolean => {
  let totalSize = 0;
  for (let i = 0; i < files.length; i++) {
    totalSize += files[i].size;
    if (totalSize > 100 * 1024 * 1024) { // 100MB threshold
      return true;
    }
  }
  return false;
};
