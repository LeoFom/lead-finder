export type SourceType =
  | 'manual'
  | 'overture'
  | 'osm'
  | 'official_website'
  | 'licensed_search'
  | 'google_maps'
  | 'brave_search'
  | 'instagram';

export type SourceOperation = 'store' | 'export';

export interface FactProvenance {
  sourceType: SourceType;
  sourceRef: string;
  field: string;
  license: string;
  observedAt: string;
  confidence: number;
  storageRights: 'allowed' | 'denied' | 'unknown';
  exportRights: 'allowed' | 'denied' | 'unknown';
  attribution: string;
  dataset?: string;
  releaseId?: string;
}
