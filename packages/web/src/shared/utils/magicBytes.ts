/**
 * Magic Byte Validation
 * Validates file types by reading file signatures (magic bytes)
 * More reliable than extension-based validation
 */

export interface FileSignature {
  mime: string;
  extension: string;
  signature: number[][];
  offset?: number;
}

// Common file signatures (magic bytes)
export const FILE_SIGNATURES: FileSignature[] = [
  // Executables
  { mime: 'application/x-msdownload', extension: 'exe', signature: [[0x4D, 0x5A]] }, // MZ
  { mime: 'application/x-mach-binary', extension: 'mach-o', signature: [[0xCF, 0xFA, 0xED, 0xFE], [0xCE, 0xFA, 0xED, 0xFE]] },
  { mime: 'application/x-elf', extension: 'elf', signature: [[0x7F, 0x45, 0x4C, 0x46]] }, // ELF
  
  // Scripts
  { mime: 'application/x-sh', extension: 'sh', signature: [[0x23, 0x21]] }, // #!
  
  // Archives
  { mime: 'application/zip', extension: 'zip', signature: [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06]] }, // PK
  { mime: 'application/x-rar', extension: 'rar', signature: [[0x52, 0x61, 0x72, 0x21]] }, // Rar!
  { mime: 'application/x-7z-compressed', extension: '7z', signature: [[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]] },
  { mime: 'application/gzip', extension: 'gz', signature: [[0x1F, 0x8B]] },
  
  // Images
  { mime: 'image/jpeg', extension: 'jpg', signature: [[0xFF, 0xD8, 0xFF]] },
  { mime: 'image/png', extension: 'png', signature: [[0x89, 0x50, 0x4E, 0x47]] },
  { mime: 'image/gif', extension: 'gif', signature: [[0x47, 0x49, 0x46, 0x38]] }, // GIF8
  { mime: 'image/webp', extension: 'webp', signature: [[0x52, 0x49, 0x46, 0x46]], offset: 8 }, // RIFF...WEBP
  { mime: 'image/bmp', extension: 'bmp', signature: [[0x42, 0x4D]] }, // BM
  
  // Documents
  { mime: 'application/pdf', extension: 'pdf', signature: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
  
  // Office (all start with PK - ZIP format)
  { mime: 'application/vnd.openxmlformats-officedocument', extension: 'docx', signature: [[0x50, 0x4B, 0x03, 0x04]] },
  
  // Media
  { mime: 'video/mp4', extension: 'mp4', signature: [[0x00, 0x00, 0x00]], offset: 4 }, // ftyp
  { mime: 'video/x-matroska', extension: 'mkv', signature: [[0x1A, 0x45, 0xDF, 0xA3]] },
  { mime: 'audio/mpeg', extension: 'mp3', signature: [[0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2], [0x49, 0x44, 0x33]] }, // ID3
];

/**
 * Read first N bytes from a file
 */
export async function readFileHeader(file: File, bytes: number = 16): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const blob = file.slice(0, bytes);
    
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      resolve(new Uint8Array(arrayBuffer));
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Check if bytes match a signature
 */
function matchesSignature(bytes: Uint8Array, signature: number[], offset: number = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  
  return true;
}

/**
 * Detect file type from magic bytes
 */
export async function detectFileType(file: File): Promise<{
  detectedMime: string | null;
  detectedExtension: string | null;
  confidence: 'high' | 'low';
}> {
  try {
    const header = await readFileHeader(file, 32);
    
    for (const sig of FILE_SIGNATURES) {
      const offset = sig.offset || 0;
      
      for (const signature of sig.signature) {
        if (matchesSignature(header, signature, offset)) {
          return {
            detectedMime: sig.mime,
            detectedExtension: sig.extension,
            confidence: 'high'
          };
        }
      }
    }
    
    // No match found
    return {
      detectedMime: null,
      detectedExtension: null,
      confidence: 'low'
    };
  } catch (error) {
    console.error('Error detecting file type:', error);
    return {
      detectedMime: null,
      detectedExtension: null,
      confidence: 'low'
    };
  }
}

/**
 * Validate file type matches its extension
 */
export async function validateFileType(file: File): Promise<{
  isValid: boolean;
  warning: string | null;
  detectedType: string | null;
  declaredType: string;
}> {
  const declaredExtension = file.name.split('.').pop()?.toLowerCase() || '';
  const declaredType = file.type || 'unknown';
  
  const detection = await detectFileType(file);
  
  // If we couldn't detect, assume it's okay but low confidence
  if (!detection.detectedMime) {
    return {
      isValid: true,
      warning: null,
      detectedType: null,
      declaredType
    };
  }
  
  // Check if detected type matches declared type
  const detectedExt = detection.detectedExtension;
  const mimeMatch = detection.detectedMime === declaredType || 
                    detection.detectedMime.startsWith(declaredType.split('/')[0]);
  const extMatch = detectedExt === declaredExtension;
  
  if (!mimeMatch && !extMatch) {
    return {
      isValid: false,
      warning: `File appears to be ${detectedExt?.toUpperCase()} but has .${declaredExtension} extension`,
      detectedType: detection.detectedMime,
      declaredType
    };
  }
  
  return {
    isValid: true,
    warning: null,
    detectedType: detection.detectedMime,
    declaredType
  };
}

/**
 * Check if file is potentially dangerous based on magic bytes
 */
export async function isDangerousFile(file: File): Promise<{
  isDangerous: boolean;
  reason: string | null;
  fileType: string | null;
}> {
  const detection = await detectFileType(file);
  
  if (!detection.detectedMime) {
    // Unknown type - check extension as fallback
    const ext = file.name.split('.').pop()?.toLowerCase();
    const dangerousExts = ['exe', 'bat', 'cmd', 'com', 'scr', 'vbs', 'js', 'jar', 'app', 'deb', 'rpm'];
    
    if (ext && dangerousExts.includes(ext)) {
      return {
        isDangerous: true,
        reason: `Executable file type (.${ext})`,
        fileType: ext
      };
    }
    
    return { isDangerous: false, reason: null, fileType: null };
  }
  
  // Check detected type
  const dangerousMimes = [
    'application/x-msdownload',
    'application/x-mach-binary',
    'application/x-elf',
    'application/x-sh',
    'application/x-executable'
  ];
  
  if (dangerousMimes.some(mime => detection.detectedMime?.includes(mime))) {
    return {
      isDangerous: true,
      reason: `Executable file detected (${detection.detectedExtension?.toUpperCase()})`,
      fileType: detection.detectedMime
    };
  }
  
  return { isDangerous: false, reason: null, fileType: detection.detectedMime };
}
