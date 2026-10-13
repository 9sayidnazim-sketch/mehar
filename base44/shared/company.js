const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// Shared helper: fetches the default business/company profile used on all generated bills.
export async function getDefaultCompany(base44) {
  try {
    const def = await db.asServiceRole.entities.Company.filter({ is_default: true }, '-created_date', 1);
    if (def && def.length) return def[0];
    const all = await db.asServiceRole.entities.Company.list('-created_date', 1);
    return (all && all[0]) || null;
  } catch (e) {
    return null;
  }
}

// Friendly header label for bills: the company name, or a sensible fallback.
export function companyName(company) {
  return (company && company.name) || 'Mehar by Octapus';
}