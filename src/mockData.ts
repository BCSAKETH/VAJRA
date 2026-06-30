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
  unemploymentRate: number; // demographic correlation
  literacyRate: number; // demographic correlation
}

export interface AccusedProfile {
  id: string;
  name: string;
  alias: string;
  age: number;
  gender: string;
  primaryFIR: string;
  associatedStations: string[];
  reoffendingRisk: number; // 0 to 100
  moFingerprint: string[]; // Modus Operandi
  shapFactors: { name: string; value: number; contribution: 'positive' | 'negative' }[];
  timeline: { date: string; event: string; type: 'arrest' | 'fir' | 'court' | 'intelligence' }[];
  phone: string;
  vehicle: string;
}

export interface Hotspot {
  id: string;
  name: string;
  coordinates: [number, number]; // [lat, lng] inside Bengaluru / Karnataka grid
  crimeDensity: 'High' | 'Medium' | 'Low';
  confidence: number; // percentage confidence DBSCAN
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
  hash: string; // crypto hash simulation
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

// Simulated data reflective of Karnataka Police Kaggle 1.6M dataset and data.gov.in correlation stats
export const mockFIRs: FIRRecord[] = [
  {
    firNo: "FIR-2023-0142",
    station: "Indiranagar PS",
    district: "Bengaluru City",
    date: "2023-11-14",
    actSection: "IPC Section 457/380 (House-breaking by night)",
    crimeType: "Burglary",
    status: "Under Investigation",
    accusedName: "Ramesh 'Babu' Kumar",
    accusedAge: 32,
    unemploymentRate: 4.2,
    literacyRate: 88.5
  },
  {
    firNo: "FIR-2026-0814",
    station: "Peenya PS",
    district: "Bengaluru City",
    date: "2026-05-12",
    actSection: "IPC Section 379 (Theft of Property)",
    crimeType: "Property Theft",
    status: "Under Investigation",
    accusedName: "Ramesh Kumar @ Rowdy Ramesh",
    accusedAge: 32,
    unemploymentRate: 8.4,
    literacyRate: 74.2
  },
  {
    firNo: "FIR-2025-1021",
    station: "Majestic Railway PS",
    district: "Bengaluru City",
    date: "2025-11-20",
    actSection: "IPC Section 392 (Robbery)",
    crimeType: "Heinous Property Crime",
    status: "Charge Sheeted",
    accusedName: "Siddalingappa @ Sidda",
    accusedAge: 29,
    unemploymentRate: 9.1,
    literacyRate: 68.5
  },
  {
    firNo: "FIR-2026-0309",
    station: "Indiranagar PS",
    district: "Bengaluru City",
    date: "2026-02-14",
    actSection: "IPC Section 420 (Cheating/Cyberfraud)",
    crimeType: "White Collar Cybercrime",
    status: "Under Investigation",
    accusedName: "Vikram Shah @ Hacker Vicky",
    accusedAge: 27,
    unemploymentRate: 4.2,
    literacyRate: 92.1
  },
  {
    firNo: "FIR-2025-4412",
    station: "Cubbon Park PS",
    district: "Bengaluru North",
    date: "2025-08-01",
    actSection: "IPC Section 341/324 (Wrongful Restraint & Voluntarily Causing Hurt)",
    crimeType: "Violent Assault",
    status: "Closed",
    accusedName: "Manjunath Gowda @ Anna",
    accusedAge: 44,
    unemploymentRate: 5.8,
    literacyRate: 83.4
  },
  {
    firNo: "FIR-2026-1190",
    station: "Halasuru PS",
    district: "Bengaluru East",
    date: "2026-04-30",
    actSection: "IPC Section 380 (Housebreak/Theft)",
    crimeType: "Burglary",
    status: "Untraced",
    accusedName: "Syed Imran @ Tiger Imran",
    accusedAge: 31,
    unemploymentRate: 7.9,
    literacyRate: 79.5
  },
  {
    firNo: "FIR-2026-1744",
    station: "Kengeri PS",
    district: "Bengaluru South",
    date: "2026-06-02",
    actSection: "IPC Section 379/411 (Automobile Loot)",
    crimeType: "Vehicle Theft",
    status: "Under Investigation",
    accusedName: "Mallesha @ Split-Gear Mallesha",
    accusedAge: 25,
    unemploymentRate: 8.8,
    literacyRate: 72.1
  },
  {
    firNo: "FIR-2025-0902",
    station: "Yelahanka Old Town PS",
    district: "Bengaluru City",
    date: "2025-10-15",
    actSection: "IPC Section 420 (Financial Fraud)",
    crimeType: "Property Theft",
    status: "Charge Sheeted",
    accusedName: "Vikram Shah @ Hacker Vicky",
    accusedAge: 27,
    unemploymentRate: 4.5,
    literacyRate: 91.0
  }
];

export const mockAccused: AccusedProfile[] = [
  {
    id: "ACC-0001",
    name: "Subhash Rao",
    alias: "Boxer Subbu",
    age: 45,
    gender: "Male",
    primaryFIR: "FIR-2023-0142",
    associatedStations: [
      "Indiranagar PS",
      "Koramangala PS"
    ],
    reoffendingRisk: 98,
    moFingerprint: [
      "Syndicate Coordinator",
      "Liquidates stolen assets through shell warehouses",
      "Rarely physically present at crime scenes"
    ],
    shapFactors: [
      { name: "Syndicate Leadership Structure", value: 55, contribution: "positive" },
      { name: "Asset Fencing Hub Distance", value: 30, contribution: "positive" },
      { name: "Direct Scene Evidence", value: -10, contribution: "negative" }
    ],
    timeline: [
      { date: "2023-11-14", event: "Identified as primary orchestrator of Indiranagar burglary", type: "intelligence" },
      { date: "2024-01-20", event: "Arrest warrant issued by ACMM Court", type: "court" }
    ],
    phone: "+91 99001 12233",
    vehicle: "KA-01-AB-1234 (Black Fortuner)"
  },
  {
    id: "ACC-4109",
    name: "Ramesh 'Babu' Kumar",
    alias: "Rowdy Ramesh",
    age: 32,
    gender: "Male",
    primaryFIR: "FIR-2023-0142",
    associatedStations: [
      "Peenya PS",
      "Yeshwanthpur PS",
      "Indiranagar PS"
    ],
    reoffendingRisk: 86,
    moFingerprint: [
      "Ventilation entry specialist",
      "Sells looted metals in midnight scrap dealers",
      "Uses duplicate master key for 2-wheeler ignition bypass"
    ],
    shapFactors: [
      { name: "Network Co-Accused Proximity", value: 41, contribution: "positive" },
      { name: "Geographic Clutter Density (Peenya Zone)", value: 26, contribution: "positive" },
      { name: "Frequency of Preceding Arrests", value: 15, contribution: "positive" },
      { name: "Local Area Literacy Level Dampener", value: -4, contribution: "negative" },
      { name: "Employment Status Baseline", value: 8, contribution: "positive" }
    ],
    timeline: [
      { date: "2026-05-12", event: "Booked under IPC 379 for metal-yard heist", type: "fir" },
      { date: "2026-05-13", event: "Arrested by Peenya Special Investigation Unit, custody granted", type: "arrest" },
      { date: "2025-09-22", event: "Identified with Co-accused Muniraju on CCTV feed", type: "intelligence" },
      { date: "2024-11-04", event: "Charged by Magistrate Court, secure bond signed", type: "court" }
    ],
    phone: "+91 94481 02143",
    vehicle: "KA-04-EM-9921 (Blue Splendor)"
  },
  {
    id: "ACC-5521",
    name: "Vikram Shah @ Hacker Vicky",
    alias: "Hacker Vicky",
    age: 27,
    gender: "Male",
    primaryFIR: "FIR-2026-0309",
    associatedStations: [
      "Indiranagar PS",
      "Yelahanka Old Town PS",
      "Cyber Crime Division"
    ],
    reoffendingRisk: 61,
    moFingerprint: [
      "Creates lookalike bank credentials routing apps",
      "Sends masked SMS bulk vectors using high-tech gateways",
      "Converts proceeds into untraceable electronic coupons"
    ],
    shapFactors: [
      { name: "Education & Digital Literacy Catalyst", value: 31, contribution: "positive" },
      { name: "Multi-layered Domain Proxies", value: 18, contribution: "positive" },
      { name: "Previous Charge Sheet Cleanses", value: 12, contribution: "positive" },
      { name: "High Socio-Economic Area Deterrent", value: -6, contribution: "negative" }
    ],
    timeline: [
      { date: "2026-02-14", event: "Initiated online phishing database", type: "fir" },
      { date: "2026-03-01", event: "Issued notice under Section 41A CrPC", type: "court" }
    ],
    phone: "+91 88844 71109",
    vehicle: "KA-03-MR-0808 (Silver Verna)"
  },
  {
    id: "ACC-1290",
    name: "Syed Imran @ Tiger Imran",
    alias: "Tiger Imran",
    age: 31,
    gender: "Male",
    primaryFIR: "FIR-2026-1190",
    associatedStations: ["Halasuru PS", "Commercial Street PS"],
    reoffendingRisk: 42,
    moFingerprint: [
      "Targets locked residential properties",
      "Dismantles padlocks using custom silent hydraulic shears"
    ],
    shapFactors: [
      { name: "Geographic Proximity to Target", value: 20, contribution: "positive" },
      { name: "Hydraulic Tool Signature Modus", value: 15, contribution: "positive" },
      { name: "Prior Incarceration Term", value: 12, contribution: "positive" },
      { name: "Family Support Structure System", value: -5, contribution: "negative" }
    ],
    timeline: [
      { date: "2026-04-30", event: "Reported lock-break heist at Halasuru residence", type: "fir" }
    ],
    phone: "+91 91102 33412",
    vehicle: "KA-02-Z-5001"
  }
];

export const mockHotspots: Hotspot[] = [
  {
    id: "HS-01",
    name: "Peenya Industrial Area Zone",
    coordinates: [13.0285, 77.5198],
    crimeDensity: "High",
    confidence: 94.2,
    dominantCrime: "Metal & Machine Spares Theft",
    unemploymentRate: 8.4
  },
  {
    id: "HS-02",
    name: "Majestic Junction Cluster",
    coordinates: [12.9779, 77.5724],
    crimeDensity: "High",
    confidence: 91.5,
    dominantCrime: "Pickpocketing & Mobile Snatching",
    unemploymentRate: 9.1
  },
  {
    id: "HS-03",
    name: "Cubbon Park Peripheral Quadrant",
    coordinates: [12.9738, 77.5906],
    crimeDensity: "Medium",
    confidence: 76.4,
    dominantCrime: "Chain Snatching & Restraint Assaults",
    unemploymentRate: 5.8
  },
  {
    id: "HS-04",
    name: "Indiranagar 100ft Flyover Junction",
    coordinates: [12.9719, 77.6412],
    crimeDensity: "Medium",
    confidence: 84.8,
    dominantCrime: "Cyber Phishing & POS Mimicry",
    unemploymentRate: 4.2
  },
  {
    id: "HS-05",
    name: "Hebbal Outer Ring Flyover Underpass",
    coordinates: [13.0359, 77.5971],
    crimeDensity: "High",
    confidence: 88.1,
    dominantCrime: "Vehicle Theft",
    unemploymentRate: 7.9
  }
];

// GraphRAG Entity Relations database mock
export const mockGraphNodes: GraphNode[] = [
  { id: "subhash", label: "Subhash Rao", type: "Person", color: "#1D4ED8" }, // Accused Target (Blue)
  { id: "ramesh", label: "Ramesh 'Babu' Kumar", type: "Person", color: "#1D4ED8" }, // Accused Target (Blue)
  { id: "fir0142", label: "FIR: 0142/2023", type: "FIR", color: "#F59E0B" }, // Case Incident (Amber)
  { id: "warehouse", label: "Yelahanka Warehouse", type: "Location", color: "#10B981" }, // Stolen Goods Spot (Green)
  { id: "syndicate", label: "Syndicate X", type: "Syndicate", color: "#8B5CF6" } // Syndicate Group (Violet)
];

export const mockGraphEdges: GraphEdge[] = [
  { source: "subhash", target: "ramesh", relationship: "SYNDICATE_LEAD_TO_ACCOMPLICE" },
  { source: "subhash", target: "fir0142", relationship: "INTELLECTUAL_ORCHESTRATOR" },
  { source: "ramesh", target: "fir0142", relationship: "MATCHES_MO_PRIMARY_SUSPECT" },
  { source: "ramesh", target: "warehouse", relationship: "DISTRIBUTION_NODE" },
  { source: "subhash", target: "syndicate", relationship: "COMMAND_AND_CONTROL" }
];

export let mockAuditLogs: AuditLog[] = [
  {
    timestamp: "2026-06-23 07:01:14",
    badgeId: "KSP-2026",
    action: "Semantic Query Execution",
    queryParam: "Peenya industrial thefts linked with Rowdy Ramesh",
    recordsAccessed: 148,
    hash: "sha256-8a9d115e8b41fd929c8821ca"
  },
  {
    timestamp: "2026-06-23 06:44:03",
    badgeId: "KSP-2026",
    action: "Neo4j Graph Expansion",
    queryParam: "Multi-hop query for SIM count > 3",
    recordsAccessed: 18,
    hash: "sha256-4c910ab3dd72e9a28c31f2bc"
  },
  {
    timestamp: "2026-06-23 05:12:49",
    badgeId: "KSP-2026",
    action: "Spatial Plot Generation",
    queryParam: "DBSCAN Epsilon=0.002, MinPts=5 clusters",
    recordsAccessed: 2471,
    hash: "sha256-9eef110ca428810da52bcf81"
  }
];

export const appendAuditLog = (log: Omit<AuditLog, 'hash'>) => {
  const fakeHash = `sha256-${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
  mockAuditLogs = [{ ...log, hash: fakeHash }, ...mockAuditLogs];
};

export const mockLiveAlerts: LiveAlert[] = [
  {
    id: "AL-8021",
    timestamp: "2026-06-23 07:05:11",
    severity: "Critical",
    station: "Peenya PS",
    type: "AI Threat Spike Detect",
    details: "Unusual density cluster forming near Metal Yard Subsector 4. Crime pattern mirrors Rowdy Ramesh's MO.",
    isAcknowledged: false
  },
  {
    id: "AL-6710",
    timestamp: "2026-06-23 06:50:00",
    severity: "Warning",
    station: "Indiranagar Cyber Cell",
    type: "Repeated SIM Spoofing Trigger",
    details: "Bulk SMS gateway spoofing identified routing packets matching FIR-2026-0309 database.",
    isAcknowledged: false
  },
  {
    id: "AL-1102",
    timestamp: "2026-06-23 06:12:44",
    severity: "Info",
    station: "Yelahanka Old Town PS",
    type: "Court Bail Bond Update",
    details: "Bail status updated for Rowdy Ramesh - Magistrate custody period expired. Tracker alert active.",
    isAcknowledged: true
  }
];
