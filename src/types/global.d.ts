export {};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: any) => Promise<any>;
    showSaveFilePicker?: (options?: any) => Promise<any>;
    __peerConnected?: boolean;
    __peerState?: string;
    __peerId?: string;
    __e2e?: unknown;
  }

  interface Navigator {
    deviceMemory?: number;
    connection?: {
      effectiveType?: string;
      rtt?: number;
      downlink?: number;
      saveData?: boolean;
    };
    mozConnection?: any;
    webkitConnection?: any;
  }

  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }

  interface DataTransferItem {
    webkitGetAsEntry?: () => FileSystemEntry | null;
  }

  interface FileSystemEntry {
    isDirectory: boolean;
    isFile: boolean;
    name: string;
    fullPath: string;
    filesystem: any;
  }

  interface FileSystemDirectoryEntry extends FileSystemEntry {
    createReader: () => any;
  }

  interface FileSystemFileEntry extends FileSystemEntry {
    file: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void;
  }
}

declare module 'peerjs' {
  interface DataConnection {
    peerConnection?: RTCPeerConnection;
  }
}
