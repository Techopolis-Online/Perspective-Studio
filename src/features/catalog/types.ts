export type ModelEntry = {
  repo_id: string;
  description: string;
  likes: number;
  downloads: number;
  pipeline_tag: string | null;
  worksLocally?: boolean;
  smallestGgufSize?: number;
  source?: 'hf' | 'ollama';
};


