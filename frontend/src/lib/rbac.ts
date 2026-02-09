export interface Permission {
  viewDocuments: boolean;
  uploadDocuments: boolean;
  runAnalysis: boolean;
  chat: boolean;
  viewFindings: boolean;
  verifyDispute: boolean;
  viewAudit: boolean;
  viewDashboard: boolean;
}

export type Role =
  | "Board Chair"
  | "Governance Analyst"
  | "Compliance Officer"
  | "Ops Manager"
  | "Intern";

export interface User {
  name: string;
  role: Role;
  permissions: Permission;
}

export const USERS: User[] = [
  {
    name: "Janish Kumar",
    role: "Board Chair",
    permissions: {
      viewDocuments: true,
      uploadDocuments: true,
      runAnalysis: true,
      chat: true,
      viewFindings: true,
      verifyDispute: true,
      viewAudit: true,
      viewDashboard: true,
    },
  },
  {
    name: "Ganesh Satyabrata",
    role: "Governance Analyst",
    permissions: {
      viewDocuments: true,
      uploadDocuments: true,
      runAnalysis: true,
      chat: true,
      viewFindings: true,
      verifyDispute: false,
      viewAudit: true,
      viewDashboard: true,
    },
  },
  {
    name: "Kamal Dhakal",
    role: "Compliance Officer",
    permissions: {
      viewDocuments: true,
      uploadDocuments: false,
      runAnalysis: false,
      chat: true,
      viewFindings: true,
      verifyDispute: false,
      viewAudit: true,
      viewDashboard: true,
    },
  },
  {
    name: "Vyanktesh Arali",
    role: "Ops Manager",
    permissions: {
      viewDocuments: true,
      uploadDocuments: false,
      runAnalysis: false,
      chat: true,
      viewFindings: true,
      verifyDispute: false,
      viewAudit: true,
      viewDashboard: true,
    },
  },
  {
    name: "Devansh Agarwal",
    role: "Intern",
    permissions: {
      viewDocuments: true,
      uploadDocuments: false,
      runAnalysis: false,
      chat: false,
      viewFindings: false,
      verifyDispute: false,
      viewAudit: true,
      viewDashboard: true,
    },
  },
];

// Maps document filenames to allowed user names
export const DOCUMENT_ACL: Record<string, string[]> = {
  "Board_Minutes_Jan_2026.pdf": ["Janish Kumar", "Ganesh Satyabrata"],
  "Board_Minutes_Feb_2026.pdf": ["Janish Kumar", "Ganesh Satyabrata"],
  "Board_Minutes_Mar_2026.pdf": ["Janish Kumar", "Ganesh Satyabrata"],
  "Corporate Governance Reference Framework.pdf": [
    "Janish Kumar",
    "Ganesh Satyabrata",
    "Kamal Dhakal",
    "Vyanktesh Arali",
    "Devansh Agarwal",
  ],
  "Code of Conduct.pdf": [
    "Janish Kumar",
    "Ganesh Satyabrata",
    "Kamal Dhakal",
    "Vyanktesh Arali",
    "Devansh Agarwal",
  ],
};

export function getUserByName(name: string): User | undefined {
  return USERS.find((u) => u.name === name);
}

export function canAccessDocument(userName: string, filename: string): boolean {
  const acl = DOCUMENT_ACL[filename];
  if (!acl) return false;
  return acl.includes(userName);
}

export function getAccessibleFilenames(userName: string): string[] {
  return Object.entries(DOCUMENT_ACL)
    .filter(([, users]) => users.includes(userName))
    .map(([filename]) => filename);
}
