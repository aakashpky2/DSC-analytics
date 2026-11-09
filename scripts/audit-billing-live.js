const { supabase, queryAll, queryOne } = require('../dist-server/server/supabase.js');
const { getMasterCollection } = require('../dist-server/server/billingMasterStore.js');

async function audit() {
  console.log('================================================================');
  console.log('LIVE DATABASE & BACKEND CONNECTIVITY AUDIT: INVOICING & BILLING');
  console.log('================================================================\n');

  // 1. Table inventory and counts in Supabase
  const tables = [
    'invoices',
    'payments_received',
    'invoice_series_configs',
    'financial_ledger',
    'bank_accounts',
    'partners',
    'dsc_applications',
    'token_serials',
    'courier_dispatches',
    'audit_logs',
    'company_profile'
  ];

  console.log('--- 1. LIVE SUPABASE TABLE INVENTORY ---');
  for (const tbl of tables) {
    try {
      const { count, error } = await supabase.from(tbl).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`Table [${tbl}]: ERROR ->`, error.message);
      } else {
        console.log(`Table [${tbl}]: EXISTS | Live Count: ${count}`);
      }
    } catch (e) {
      console.log(`Table [${tbl}]: EXCEPTION ->`, e.message);
    }
  }

  // 2. Schema structure & columns of invoices & payments_received
  console.log('\n--- 2. INVOICE SCHEMA & SNAPSHOT AUDIT ---');
  const sampleInvoice = await queryOne(`SELECT * FROM invoices LIMIT 1`);
  if (sampleInvoice) {
    console.log('Invoice columns present in live DB:', Object.keys(sampleInvoice));
    let parsedItems = [];
    try {
      parsedItems = JSON.parse(sampleInvoice.line_items || '[]');
    } catch (e) {}
    console.log('Sample invoice line items JSON parse count:', parsedItems.length);
    console.log('Sample invoice line item keys:', parsedItems[0] ? Object.keys(parsedItems[0]) : 'None');
    let parsedSnap = null;
    try {
      parsedSnap = JSON.parse(sampleInvoice.company_snapshot || '{}');
    } catch (e) {}
    console.log('Company snapshot present:', !!parsedSnap, 'Keys:', parsedSnap ? Object.keys(parsedSnap) : 'None');
  }

  // 3. Invoice status distribution
  console.log('\n--- 3. INVOICE STATUS DISTRIBUTION ---');
  const statusDist = await queryAll(`SELECT status, count(*) as count, sum(total_amount) as total_amt FROM invoices GROUP BY status`);
  console.log(statusDist);

  // 4. Payments received audit
  console.log('\n--- 4. PAYMENTS RECEIVED AUDIT ---');
  const paymentStats = await queryOne(`SELECT count(*) as count, sum(amount) as total_collected FROM payments_received`);
  console.log('Payments aggregate:', paymentStats);
  const orphanPayments = await queryAll(`
    SELECT p.id, p.invoice_id 
    FROM payments_received p 
    LEFT JOIN invoices i ON p.invoice_id = i.id 
    WHERE i.id IS NULL
  `);
  console.log('Orphan payments (payment without invoice):', orphanPayments.length);

  // 5. Financial Ledger double entry check
  console.log('\n--- 5. FINANCIAL LEDGER DOUBLE ENTRY AUDIT ---');
  const ledgerTotals = await queryOne(`
    SELECT 
      SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) as total_debits,
      SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) as total_credits,
      COUNT(*) as total_entries
    FROM financial_ledger
  `);
  console.log('Ledger totals:', ledgerTotals);

  // 6. Master Store live verification
  console.log('\n--- 6. BILLING MASTER STORE VERIFICATION ---');
  const states = await getMasterCollection('states');
  const taxSlabs = await getMasterCollection('tax_slabs');
  const hsnSac = await getMasterCollection('hsn_sac_codes');
  const paymentModes = await getMasterCollection('payment_modes');
  const invoiceTypes = await getMasterCollection('invoice_types');
  const invoiceStatuses = await getMasterCollection('invoice_statuses');
  const creditReasons = await getMasterCollection('credit_note_reasons');

  console.log(`Master States Count: ${states.length} (Sample: ${states[0]?.name}, code ${states[0]?.code})`);
  console.log(`Master Tax Slabs Count: ${taxSlabs.length} (Rates: ${taxSlabs.map(s => s.rate + '%').join(', ')})`);
  console.log(`Master HSN/SAC Codes Count: ${hsnSac.length}`);
  console.log(`Master Payment Modes: ${paymentModes.map(m => m.name).join(', ')}`);
  console.log(`Master Invoice Types: ${invoiceTypes.map(t => t.name).join(', ')}`);
  console.log(`Master Invoice Statuses: ${invoiceStatuses.map(s => s.name).join(', ')}`);
  console.log(`Master Credit Note Reasons: ${creditReasons.length}`);

  // 7. Check for test / acceptance data in invoices
  console.log('\n--- 7. TEST DATA VS PRODUCTION DATA IN INVOICES ---');
  const testInvoices = await queryAll(`
    SELECT count(*) as count 
    FROM invoices 
    WHERE id LIKE 'BILL-%' OR id LIKE 'test-%' OR invoice_number LIKE '%TEST%'
  `);
  console.log('Acceptance suite test invoices:', testInvoices[0]?.count);

  // 8. Partner foreign key check
  console.log('\n--- 8. INVOICE TO PARTNER INTEGRITY ---');
  const orphanPartners = await queryAll(`
    SELECT i.id, i.partner_id 
    FROM invoices i 
    LEFT JOIN partners p ON i.partner_id = p.id 
    WHERE i.partner_id IS NOT NULL AND p.id IS NULL
  `);
  console.log('Invoices with invalid partner_id:', orphanPartners.length);

  // 9. Series configs
  console.log('\n--- 9. INVOICE SERIES CONFIGS ---');
  const seriesConfigs = await queryAll(`SELECT * FROM invoice_series_configs`);
  console.log(seriesConfigs);

  console.log('\nAudit query pass finished.');
}

audit().catch(console.error);

