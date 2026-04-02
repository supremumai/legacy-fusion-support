import type { Ticket, Contact, Message } from '../types/ticket';

// ---------------------------------------------------------------------------
// Demo contacts
// ---------------------------------------------------------------------------
export const DEMO_CONTACTS: Record<string, Contact> = {
  'contact-marco': {
    id:              'contact-marco',
    ghlContactId:    'contact-marco',
    name:            'Marco Rivera',
    email:           'marco.rivera@example.com',
    plan:            'Pro',
    mrr:             2400,
    memberSince:     new Date(Date.now() - 14 * 30 * 24 * 60 * 60 * 1000),
    pastTicketCount: 3,
  },
  'contact-priya': {
    id:              'contact-priya',
    ghlContactId:    'contact-priya',
    name:            'Priya Nair',
    email:           'priya.nair@example.com',
    plan:            'Growth',
    mrr:             890,
    memberSince:     new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
    pastTicketCount: 1,
  },
  'contact-james': {
    id:              'contact-james',
    ghlContactId:    'contact-james',
    name:            'James Okafor',
    email:           'james.okafor@example.com',
    plan:            'Starter',
    mrr:             290,
    memberSince:     new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000),
    pastTicketCount: 0,
  },
};

// ---------------------------------------------------------------------------
// Demo tickets
// ---------------------------------------------------------------------------
export const DEMO_TICKETS: Ticket[] = [
  {
    id:                'T-0041',
    ghlOpportunityId:  'opp-0041',
    ghlContactId:      'contact-marco',
    title:             'Dashboard not loading after last deploy',
    category:          'technical',
    priority:          'urgent',
    status:            'in_progress',
    assignedTo:        'CL',
    slaDeadline:       new Date(Date.now() + 55 * 60 * 1000),
    createdAt:         new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt:         new Date(Date.now() - 30 * 60 * 1000),
    aiSummary: {
      problem:         'Dashboard is completely blank after the latest platform deploy. Affects all users under the Marco Rivera account.',
      category:        'technical',
      priority:        'urgent',
      suggestedAction: 'Check recent deploy changelog, roll back CSS/JS bundle if necessary, verify API endpoint health.',
      generatedAt:     new Date(Date.now() - 90 * 60 * 1000),
    },
  },
  {
    id:                'T-0038',
    ghlOpportunityId:  'opp-0038',
    ghlContactId:      'contact-marco',
    title:             'Invoice shows wrong amount for March',
    category:          'billing',
    priority:          'high',
    status:            'waiting_client',
    assignedTo:        'AV',
    slaDeadline:       new Date(Date.now() + 18 * 60 * 60 * 1000),
    createdAt:         new Date(Date.now() - 6 * 60 * 60 * 1000),
    updatedAt:         new Date(Date.now() - 2 * 60 * 60 * 1000),
    aiSummary: {
      problem:         'Client reports March invoice is $200 higher than expected. Suspected proration error from mid-month plan upgrade.',
      category:        'billing',
      priority:        'high',
      suggestedAction: 'Pull invoice from billing system, compare against plan upgrade date and proration rules. Issue credit if error confirmed.',
      generatedAt:     new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
  },
  {
    id:                'T-0035',
    ghlOpportunityId:  'opp-0035',
    ghlContactId:      'contact-priya',
    title:             'How do I export my contact list?',
    category:          'general',
    priority:          'low',
    status:            'resolved',
    assignedTo:        'AV',
    slaDeadline:       new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt:         new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt:         new Date(Date.now() - 20 * 60 * 60 * 1000),
    aiSummary: {
      problem:         'Client is unsure how to export contact list as CSV from the platform.',
      category:        'general',
      priority:        'low',
      suggestedAction: 'Send knowledge base article on contact export. Mark resolved after client confirms.',
      generatedAt:     new Date(Date.now() - 23 * 60 * 60 * 1000),
    },
  },
  {
    id:                'T-0033',
    ghlOpportunityId:  'opp-0033',
    ghlContactId:      'contact-james',
    title:             'Automation not triggering on new leads',
    category:          'technical',
    priority:          'medium',
    status:            'new',
    assignedTo:        undefined,
    slaDeadline:       new Date(Date.now() + 36 * 60 * 60 * 1000),
    createdAt:         new Date(Date.now() - 1 * 60 * 60 * 1000),
    updatedAt:         new Date(Date.now() - 45 * 60 * 1000),
    aiSummary: {
      problem:         'New account — welcome sequence automation is not firing when leads are added via form submission.',
      category:        'technical',
      priority:        'medium',
      suggestedAction: 'Verify workflow trigger is set to "Contact Created" and that the form is tagged as a lead source trigger.',
      generatedAt:     new Date(Date.now() - 50 * 60 * 1000),
    },
  },
  {
    id:                'T-0029',
    ghlOpportunityId:  'opp-0029',
    ghlContactId:      'contact-priya',
    title:             'Need to upgrade plan — want to discuss pricing',
    category:          'billing',
    priority:          'medium',
    status:            'escalated',
    assignedTo:        'LF',
    slaDeadline:       new Date(Date.now() + 8 * 60 * 60 * 1000),
    createdAt:         new Date(Date.now() - 10 * 60 * 60 * 1000),
    updatedAt:         new Date(Date.now() - 4 * 60 * 60 * 1000),
    aiSummary: {
      problem:         'Client wants to upgrade from Growth to Pro plan and is requesting a custom pricing discussion before committing.',
      category:        'billing',
      priority:        'medium',
      suggestedAction: 'Escalate to account manager for pricing call. Prepare Pro plan comparison sheet before the call.',
      generatedAt:     new Date(Date.now() - 9 * 60 * 60 * 1000),
    },
  },
];

// ---------------------------------------------------------------------------
// Demo messages
// ---------------------------------------------------------------------------
export const DEMO_MESSAGES: Record<string, Message[]> = {
  'T-0041': [
    {
      id: 'm-0041-1', ticketId: 'T-0041', role: 'client',
      content: 'Our dashboard is completely blank since the deploy that went out this morning. Nothing loads — not even the sidebar.',
      isInternal: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'm-0041-2', ticketId: 'T-0041', role: 'ai',
      content: 'I\'m escalating this immediately — a blank dashboard affects your whole team. I\'ve flagged it as urgent. Can you confirm whether this affects all users on your account or just specific ones?',
      isInternal: false, createdAt: new Date(Date.now() - 119 * 60 * 1000),
    },
    {
      id: 'm-0041-3', ticketId: 'T-0041', role: 'client',
      content: 'All users. I\'ve had 3 people confirm it on different browsers.',
      isInternal: false, createdAt: new Date(Date.now() - 110 * 60 * 1000),
    },
    {
      id: 'm-0041-4', ticketId: 'T-0041', role: 'agent',
      content: 'INTERNAL: Checking the deploy log now — looks like the CSS bundle hash changed and the CDN cached the old reference. Testing a cache purge.',
      isInternal: true, createdAt: new Date(Date.now() - 45 * 60 * 1000),
    },
  ],

  'T-0038': [
    {
      id: 'm-0038-1', ticketId: 'T-0038', role: 'client',
      content: 'My March invoice is $200 more than I expected. I didn\'t change my plan this month.',
      isInternal: false, createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
    {
      id: 'm-0038-2', ticketId: 'T-0038', role: 'ai',
      content: 'I\'m sorry about the confusion. I\'ve created a billing ticket and flagged it as high priority. Our team will pull your invoice and verify the charges. Can you confirm the plan you\'re on?',
      isInternal: false, createdAt: new Date(Date.now() - 359 * 60 * 1000),
    },
    {
      id: 'm-0038-3', ticketId: 'T-0038', role: 'agent',
      content: 'Hi Marco — I pulled your invoice. It shows a proration charge from a plan upgrade on March 14. Does that ring a bell, or did someone on your team make that change?',
      isInternal: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'm-0038-4', ticketId: 'T-0038', role: 'agent',
      content: 'INTERNAL: Client may have a team member who upgraded without notifying him. Waiting on his reply before issuing credit.',
      isInternal: true, createdAt: new Date(Date.now() - 115 * 60 * 1000),
    },
  ],

  'T-0035': [
    {
      id: 'm-0035-1', ticketId: 'T-0035', role: 'client',
      content: 'Hi, I\'m trying to export my contact list as a CSV but can\'t find where to do it.',
      isInternal: false, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
    {
      id: 'm-0035-2', ticketId: 'T-0035', role: 'ai',
      content: 'Sure! Go to Contacts → All Contacts → click the ⋮ menu in the top right → Export as CSV. Let me know if that works for you.',
      isInternal: false, createdAt: new Date(Date.now() - 1435 * 60 * 1000),
    },
    {
      id: 'm-0035-3', ticketId: 'T-0035', role: 'client',
      content: 'Found it, thank you!',
      isInternal: false, createdAt: new Date(Date.now() - 1410 * 60 * 1000),
    },
    {
      id: 'm-0035-4', ticketId: 'T-0035', role: 'agent',
      content: 'Great! I\'ll mark this as resolved. Don\'t hesitate to reach out if anything else comes up.',
      isInternal: false, createdAt: new Date(Date.now() - 1400 * 60 * 1000),
    },
  ],

  'T-0033': [
    {
      id: 'm-0033-1', ticketId: 'T-0033', role: 'client',
      content: 'We set up an automation to send a welcome email when new leads come in from our web form, but it never fires.',
      isInternal: false, createdAt: new Date(Date.now() - 60 * 60 * 1000),
    },
    {
      id: 'm-0033-2', ticketId: 'T-0033', role: 'ai',
      content: 'Happy to help get that sorted. A few quick questions: is the workflow status set to Active? And is the trigger set to "Contact Created" or a specific form submission?',
      isInternal: false, createdAt: new Date(Date.now() - 58 * 60 * 1000),
    },
    {
      id: 'm-0033-3', ticketId: 'T-0033', role: 'client',
      content: 'It\'s active. The trigger says "Form Submitted" and I selected our lead capture form.',
      isInternal: false, createdAt: new Date(Date.now() - 50 * 60 * 1000),
    },
    {
      id: 'm-0033-4', ticketId: 'T-0033', role: 'agent',
      content: 'INTERNAL: New account, may not have connected the form integration correctly. Assigning for a setup call.',
      isInternal: true, createdAt: new Date(Date.now() - 45 * 60 * 1000),
    },
  ],

  'T-0029': [
    {
      id: 'm-0029-1', ticketId: 'T-0029', role: 'client',
      content: 'We\'re hitting the Growth plan limits and want to upgrade to Pro, but I\'d like to talk through pricing first before committing.',
      isInternal: false, createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    },
    {
      id: 'm-0029-2', ticketId: 'T-0029', role: 'ai',
      content: 'Absolutely — I\'ve escalated this to an account manager who can walk you through the Pro plan options and answer any pricing questions. You\'ll hear from them shortly.',
      isInternal: false, createdAt: new Date(Date.now() - 599 * 60 * 1000),
    },
    {
      id: 'm-0029-3', ticketId: 'T-0029', role: 'agent',
      content: 'Hi Priya — I\'m Legacy, your account manager. I\'d love to set up a 20-minute call to walk through what Pro unlocks for you and see if we can structure something that makes sense. What does your schedule look like this week?',
      isInternal: false, createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
    {
      id: 'm-0029-4', ticketId: 'T-0029', role: 'agent',
      content: 'INTERNAL: High-value upgrade opportunity. Priya is a power user — prepare the Pro vs Growth feature comparison and annual discount offer before the call.',
      isInternal: true, createdAt: new Date(Date.now() - 235 * 60 * 1000),
    },
  ],
};

// ---------------------------------------------------------------------------
// Combined export for convenience
// ---------------------------------------------------------------------------
export const DEMO_DATA = {
  contacts: DEMO_CONTACTS,
  tickets:  DEMO_TICKETS,
  messages: DEMO_MESSAGES,
};
