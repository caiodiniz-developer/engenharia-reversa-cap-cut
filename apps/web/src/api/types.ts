import type { Project } from '@editor/core';

export interface User {
  id: string;
  email: string;
  name: string;
  settings: { language?: string; autosaveSeconds?: number; uploadConsent?: boolean; aiConsent?: boolean };
}

export interface ProjectSummary {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  createdAt: string;
}

export interface ProjectDoc {
  id: string;
  name: string;
  revision: number;
  data: Project;
}

export interface MediaItem {
  id: string;
  name: string;
  kind: 'video' | 'audio' | 'image';
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  size: number;
  mime: string;
  status: 'processing' | 'ready' | 'failed';
  error: string | null;
  urls: { original: string; proxy: string | null; thumb: string | null; waveform: string | null };
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobInfo {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  result: unknown;
}

export interface ExportInfo {
  id: string;
  options: Record<string, unknown>;
  ready: boolean;
  sizeBytes: number | null;
  expiresAt: string | null;
  job: JobInfo;
}

export interface AiCapabilities {
  transcription: 'whisper.cpp' | 'openai' | null;
  assistant: boolean;
  transcriptionSendsDataExternally: boolean;
  assistantSendsDataExternally: boolean;
  local: string[];
  unsupported: string[];
}

export type ServerEvent =
  | { type: 'ready' }
  | { type: 'job'; jobId: string; jobType: string; projectId: string | null; status: JobStatus; progress: number; error?: string | null; result?: unknown }
  | { type: 'media'; mediaId: string; projectId: string; status: string; error?: string | null };
