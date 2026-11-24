export type NativeLlmStatus = {
  engine: string;
  modelId: string;
  displayName: string;
  license: string;
  licenseUrl: string;
  approxBytes: number;
  hasConsent: boolean;
  modelPresent: boolean;
  modelPath: string;
  ready: boolean;
  downloading: boolean;
  storageOk: boolean;
  freeBytes: number;
  lastError: string;
  probeVerified: boolean;
};

export type DownloadProgressEvent = {
  bytesDownloaded: number;
  totalBytes: number;
  fraction: number;
  phase: string;
};

export type YorisoiOnDeviceLlmNativeModule = {
  isSupported(): boolean;
  getStatus(): NativeLlmStatus;
  setDownloadConsent(accepted: boolean): { ok: boolean; hasConsent?: boolean; error?: string };
  startDownload(options?: { url?: string }): Promise<{ ok: boolean; path: string; modelId: string }>;
  cancelDownload(): { ok: boolean };
  deleteModel(): { ok: boolean };
  loadModel(): Promise<{
    ok: boolean;
    ready: boolean;
    probe: string;
    modelId: string;
    engine: string;
  }>;
  unloadModel(): { ok: boolean; ready: boolean };
  generate(prompt: string): Promise<{ text: string }>;
  addListener(
    eventName: 'onDownloadProgress',
    listener: (event: DownloadProgressEvent) => void,
  ): { remove(): void };
};
