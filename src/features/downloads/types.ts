export type DownloadItem = {
  id: string;
  repoId: string;
  file: string;
  status: 'queued' | 'downloading' | 'completed' | 'error' | 'cancelled';
  percent: number;
  bytesReceived: number;
  bytesTotal: number;
  outputPath: string;
  error?: string;
};


