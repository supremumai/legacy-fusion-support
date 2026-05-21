export interface SubcategoryDef {
  key: string
  label: string
}

export interface CategoryDef {
  key: string
  label: string
  subcategories: SubcategoryDef[]
}

export const SUPPORT_TAXONOMY: CategoryDef[] = [
  {
    key: 'billing',
    label: 'Billing',
    subcategories: [
      { key: 'invoice_charges', label: 'Invoice / Charges' },
      { key: 'refund_request', label: 'Refund Request' },
      { key: 'plan_upgrade_downgrade', label: 'Plan Upgrade / Downgrade' },
      { key: 'payment_method', label: 'Payment Method' },
      { key: 'other_billing', label: 'Other Billing' },
    ]
  },
  {
    key: 'technical',
    label: 'Technical',
    subcategories: [
      { key: 'automation_workflows', label: 'Automation / Workflows' },
      { key: 'integrations', label: 'Integrations' },
      { key: 'pipeline_crm', label: 'Pipeline / CRM' },
      { key: 'website_funnels', label: 'Website / Funnels' },
      { key: 'reports_analytics', label: 'Reports / Analytics' },
      { key: 'other_technical', label: 'Other Technical' },
    ]
  },
  {
    key: 'general',
    label: 'General',
    subcategories: [
      { key: 'account_settings', label: 'Account Settings' },
      { key: 'user_management', label: 'User Management' },
      { key: 'training_how_to', label: 'Training / How-to' },
      { key: 'feature_request', label: 'Feature Request' },
      { key: 'other_general', label: 'Other' },
    ]
  }
]

// Helper: get category label from key
export function getCategoryLabel(key: string): string {
  return SUPPORT_TAXONOMY.find(c => c.key === key)?.label ?? key
}

// Helper: get subcategory label from category + subcategory keys
export function getSubcategoryLabel(
  categoryKey: string,
  subcategoryKey: string
): string {
  const cat = SUPPORT_TAXONOMY.find(c => c.key === categoryKey)
  return cat?.subcategories.find(s => s.key === subcategoryKey)
    ?.label ?? subcategoryKey
}

// Helper: generate ticket title from category + subcategory
export function buildTicketTitle(
  categoryKey: string,
  subcategoryKey: string
): string {
  const cat = getCategoryLabel(categoryKey)
  const sub = getSubcategoryLabel(categoryKey, subcategoryKey)
  return `${cat} — ${sub}`
}
