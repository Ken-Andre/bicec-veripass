// AgentRole aligns with backend enum (see .kiro/steering/roles-vs-personas.md)
// JEAN = Agent KYC Validateur
// THOMAS = Superviseur AML/CFT + Admin
// SYLVIE = Directrice Opérations
// ADMIN_IT = Administrateur Système
export enum AgentRole {
  JEAN = 'JEAN',
  THOMAS = 'THOMAS',
  SYLVIE = 'SYLVIE',
  ADMIN_IT = 'ADMIN_IT',
}

// Legacy enum for backward compatibility (deprecated)
export enum UserRole {
  ADMIN = 'ADMIN_IT',
  AGENT_KYC = 'JEAN',
  SUPERVISOR_AML = 'THOMAS',
  OPERATIONS_MANAGER = 'SYLVIE',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: AgentRole;
  agencyId?: string;
  isActive?: boolean;
  avatarUrl?: string;
  lastLogin?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
  link?: string;
}
