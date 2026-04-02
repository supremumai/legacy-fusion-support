export type TicketStatus =
  | 'new'
  | 'triaged'
  | 'in_progress'
  | 'waiting_client'
  | 'waiting_internal'
  | 'resolved'
  | 'closed'
  | 'escalated';

export type TicketPriority = 'urgent' | 'high' | 'medium' | 'low';

export type TicketCategory = 'technical' | 'billing' | 'general' | 'escalated';

export interface Ticket {
  id: string;
  ghlOpportunityId: string;
  ghlContactId: string;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: string;
  slaDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
  aiSummary?: AISummary;
}

export interface AISummary {
  problem: string;
  category: TicketCategory;
  priority: TicketPriority;
  suggestedAction: string;
  generatedAt: Date;
}

export interface Message {
  id: string;
  ticketId: string;
  role: 'ai' | 'client' | 'agent';
  content: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface Contact {
  id: string;
  ghlContactId: string;
  name: string;
  email: string;
  plan?: string;
  mrr?: number;
  memberSince?: Date;
  pastTicketCount: number;
}
