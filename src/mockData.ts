export interface FIRRecord {
  firNo: string;
  station: string;
  district: string;
  date: string;
  actSection: string;
  crimeType: string;
  status: 'Under Investigation' | 'Charge Sheeted' | 'Closed' | 'Untraced';
  accusedName: string;
  accusedAge: number;
  unemploymentRate: number;
  literacyRate: number;
}

export interface AccusedProfile {
  id: string;
  name: string;
  alias: string;
  age: number;
  gender: string;
  primaryFIR: string;
  associatedStations: string[];
  reoffendingRisk: number;
  moFingerprint: string[];
  shapFactors: { name: string; value: number; contribution: 'positive' | 'negative' }[];
  timeline: { date: string; event: string; type: 'arrest' | 'fir' | 'court' | 'intelligence' }[];
  phone: string;
  vehicle: string;
}

export interface Hotspot {
  id: string;
  name: string;
  coordinates: [number, number];
  crimeDensity: 'High' | 'Medium' | 'Low';
  confidence: number;
  dominantCrime: string;
  unemploymentRate: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'Person' | 'FIR' | 'Vehicle' | 'Phone' | 'Location' | 'Syndicate';
  color: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface AuditLog {
  timestamp: string;
  badgeId: string;
  action: string;
  queryParam: string;
  recordsAccessed: number;
  hash: string;
}

export interface LiveAlert {
  id: string;
  timestamp: string;
  severity: 'Critical' | 'Warning' | 'Info';
  station: string;
  type: string;
  details: string;
  isAcknowledged: boolean;
}

// All static mock database arrays are removed.
// Data is loaded dynamically via Supabase Casemaster and Accused schemas.
export const mockFIRs: FIRRecord[] = [];
export const mockAccused: AccusedProfile[] = [];
export const mockHotspots: Hotspot[] = [];
export const mockGraphNodes: GraphNode[] = [];
export const mockGraphEdges: GraphEdge[] = [];
export const mockLiveAlerts: LiveAlert[] = [];

export let mockAuditLogs: AuditLog[] = [];

export const appendAuditLog = (log: Omit<AuditLog, 'hash'>) => {
  const fakeHash = `sha256-${Math.random().toString(16).substring(2, 10)}`;
  mockAuditLogs = [{ ...log, hash: fakeHash }, ...mockAuditLogs];
};
