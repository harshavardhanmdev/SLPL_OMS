/**
 * What each role is called on screen. One place, so renaming a role is one
 * edit: the sales manager is the Academic Outreach Manager, as the CEO spec
 * names the post.
 *
 * Client safe, so forms and server pages read the same words.
 */
export const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  SALES_MANAGER: "Academic Outreach Manager",
  SALES: "Sales executive",
  WAREHOUSE: "Warehouse",
  ACCOUNTS: "Accounts",
  CA_READONLY: "CA, read only",
  SUPPORT: "Support",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role.toLowerCase().replace(/_/g, " ");
}
