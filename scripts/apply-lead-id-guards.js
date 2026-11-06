const fs = require('fs');

let lm = fs.readFileSync('src/server/routes/leadManagement.ts', 'utf8');

// Ensure helper isValidLeadId is defined
if (!lm.includes('function isValidLeadId(')) {
  const helper = `
function isValidLeadId(id: any): boolean {
  if (!id) return false;
  const s = String(id).trim().toLowerCase();
  return s.length > 0 && s !== 'undefined' && s !== 'null' && s !== '[object object]';
}
`;
  lm = lm.replace('export const leadManagementRouter = Router()', 'export const leadManagementRouter = Router()\r\n' + helper);
}

// 1. In /crm/leads/:id/club-partner
lm = lm.replace(
  '    const leadId = String(req.params.id)',
  '    const leadId = String(req.params.id)\r\n    if (!isValidLeadId(leadId)) return res.status(400).json({ error: \'A valid Lead ID is required.\' })'
);

// 2. In /crm/leads/:id/interactions (GET)
lm = lm.replace(
  'leadManagementRouter.get(\'/crm/leads/:id/interactions\', async (req: Request, res: Response) => {\r\n  try {\r\n    const leadId = String(req.params.id)',
  'leadManagementRouter.get(\'/crm/leads/:id/interactions\', async (req: Request, res: Response) => {\r\n  try {\r\n    const leadId = String(req.params.id)\r\n    if (!isValidLeadId(leadId)) return res.status(400).json({ error: \'A valid Lead ID is required.\' })'
);

// 3. In /crm/leads/:id/interactions (POST)
lm = lm.replace(
  'leadManagementRouter.post(\'/crm/leads/:id/interactions\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) {\r\n      return res.status(401).json({ error: \'Authentication required.\' })\r\n    }\r\n    const leadId = String(req.params.id)',
  'leadManagementRouter.post(\'/crm/leads/:id/interactions\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) {\r\n      return res.status(401).json({ error: \'Authentication required.\' })\r\n    }\r\n    const leadId = String(req.params.id)\r\n    if (!isValidLeadId(leadId)) return res.status(400).json({ error: \'A valid Lead ID is required.\' })'
);

// 4. In /crm/leads/:id/convert-partner
lm = lm.replace(
  'leadManagementRouter.post(\'/crm/leads/:id/convert-partner\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) {\r\n      return res.status(401).json({ error: \'Authentication required.\' })\r\n    }\r\n    const leadId = String(req.params.id)',
  'leadManagementRouter.post(\'/crm/leads/:id/convert-partner\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) {\r\n      return res.status(401).json({ error: \'Authentication required.\' })\r\n    }\r\n    const leadId = String(req.params.id)\r\n    if (!isValidLeadId(leadId)) return res.status(400).json({ error: \'A valid Lead ID is required.\' })'
);

// 5. In /crm/leads/:id/service-tracking (PATCH)
lm = lm.replace(
  'leadManagementRouter.patch(\'/crm/leads/:id/service-tracking\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) {\r\n      return res.status(401).json({ error: \'Authentication required.\' })\r\n    }\r\n    const leadId = String(req.params.id)',
  'leadManagementRouter.patch(\'/crm/leads/:id/service-tracking\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) {\r\n      return res.status(401).json({ error: \'Authentication required.\' })\r\n    }\r\n    const leadId = String(req.params.id)\r\n    if (!isValidLeadId(leadId)) return res.status(400).json({ error: \'A valid Lead ID is required.\' })'
);

// 6. In /crm/leads/:id/assign (PATCH)
lm = lm.replace(
  'leadManagementRouter.patch(\'/crm/leads/:id/assign\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) return res.status(401).json({ error: \'Authentication required.\' })\r\n\r\n    const leadId = String(req.params.id)',
  'leadManagementRouter.patch(\'/crm/leads/:id/assign\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) return res.status(401).json({ error: \'Authentication required.\' })\r\n\r\n    const leadId = String(req.params.id)\r\n    if (!isValidLeadId(leadId)) return res.status(400).json({ error: \'A valid Lead ID is required.\' })'
);

// 7. In /crm/leads/:id/pipeline-status (PATCH)
lm = lm.replace(
  'leadManagementRouter.patch(\'/crm/leads/:id/pipeline-status\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) return res.status(401).json({ error: \'Authentication required.\' })\r\n\r\n    const leadId = String(req.params.id)',
  'leadManagementRouter.patch(\'/crm/leads/:id/pipeline-status\', async (req: Request, res: Response) => {\r\n  try {\r\n    const user = (req as any).user\r\n    if (!user) return res.status(401).json({ error: \'Authentication required.\' })\r\n\r\n    const leadId = String(req.params.id)\r\n    if (!isValidLeadId(leadId)) return res.status(400).json({ error: \'A valid Lead ID is required.\' })'
);

fs.writeFileSync('src/server/routes/leadManagement.ts', lm, 'utf8');
console.log('leadManagement.ts validation applied successfully');

