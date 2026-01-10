export const createZipFile = async (files: FileList): Promise<File> => {
  // Import JSZip dynamically to avoid bundling issues
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Add each file to the zip
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 0) { // Skip empty files
      zip.file(file.name, file);
    }
  }

  // Generate the zip file
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  // Create a File object from the blob
  const zipName = files.length === 1 
    ? `${files[0].name}.zip`
    : `archive_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
  
  return new File([zipBlob], zipName, { type: 'application/zip' });
};

export const isFolderSelection = (files: FileList): boolean => {
  // Check if it's likely a folder selection (multiple files or webkitRelativePath)
  if (files.length > 1) return true;
  
  const file = files[0];
  return !!(file.webkitRelativePath && file.webkitRelativePath.includes('/'));
};
