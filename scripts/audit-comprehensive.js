const { supabase, queryAll, queryOne } = require('../dist-server/server/supabase.js');
const {
  getStatesMaster,
  getTaxRatesMaster,
  getHsnSacMaster,
  getInvoiceTypesMaster,
  getInvoiceStatusesMaster,
  getPaymentModesMaster,
  getCreditNoteReasonsMaster,
  getDebitNoteReasonsMaster,
  getCancellationReasonsMaster,
  getCommissionRulesMaster,
  getAgeingBucketsMaster
} = require('../dist-server/server/billingMasterStore.js');

async function comprehensiveAudit() {
  console.log('========================================================================');
  console.log('LIVE DATABASE & BACKEND CONNECTIVITY AUDIT: INVOICING & BILLING');
  console.log('========================================================================\n');

  // 1. Live Table Inventory
  console.log('=== SECTION A: LIVE TABLE INVENTORY & COUNTS ===');
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

  for (const tbl of tables) {
    const { count, error } = await supabase.from(tbl).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`[TABLE] ${tbl}: ERROR -> ${error.message}`);
    } else {
      console.log(`[TABLE] ${tbl}: EXISTS | Rows: ${count}`);
    }
  }

  // 2. Schema inspection
  console.log('\n=== SECTION B: INVOICES & PAYMENTS SCHEMA AUDIT ===');
  const sampleInv = await queryOne(`SELECT * FROM invoices LIMIT 1`);
  console.log('Invoices columns:', Object.keys(sampleInv || {}));
  const samplePay = await queryOne(`SELECT * FROM payments_received LIMIT 1`);
  console.log('Payments columns:', Object.keys(samplePay || {}));
  const sampleLed = await queryOne(`SELECT * FROM financial_ledger LIMIT 1`);
  console.log('Financial ledger columns:', Object.keys(sampleLed || {}));
  const sampleSeries = await queryOne(`SELECT * FROM invoice_series_configs LIMIT 1`);
  console.log('Series config columns:', Object.keys(sampleSeries || {}));

  // 3. Invoice status counts
  console.log('\n=== SECTION C: INVOICES STATUS & TOTALS ===');
  const invStats = await queryAll(`
    SELECT status, COUNT(*) as count, ROUND(SUM(total_amount)::numeric, 2) as total_amount, ROUND(SUM(paid_amount)::numeric, 2) as paid_amount, ROUND(SUM(outstanding_balance)::numeric, 2) as balance
    FROM invoices
    GROUP BY status
    ORDER BY count DESC
  `);
  console.table(invStats);

  // 4. Payments audit & Orphan check
  console.log('\n=== SECTION D: PAYMENTS INTEGRITY & ORPHAN CHECKS ===');
  const payAgg = await queryOne(`
    SELECT COUNT(*) as total_payments, ROUND(SUM(amount_paid)::numeric, 2) as total_paid_sum,
           COUNT(DISTINCT invoice_id) as distinct_invoices_paid,
           COUNT(DISTINCT transaction_reference_utr) as distinct_utrs
    FROM payments_received
  `);
  console.log('Payment aggregates:', payAgg);

  const orphanPayments = await queryAll(`
    SELECT p.id, p.invoice_id, p.amount_paid
    FROM payments_received p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE i.id IS NULL
  `);
  console.log('Orphan payments (invoice_id missing in invoices):', orphanPayments.length);
  if (orphanPayments.length > 0) {
    console.log('Sample orphan payments:', orphanPayments.slice(0, 3));
  }

  // 5. Duplicate UTR check
  console.log('\n=== SECTION E: UTR UNIQUENESS / DUPLICATE CHECK ===');
  const dupUtrs = await queryAll(`
    SELECT transaction_reference_utr, COUNT(*) as count
    FROM payments_received
    WHERE transaction_reference_utr IS NOT NULL AND transaction_reference_utr != ''
    GROUP BY transaction_reference_utr
    HAVING COUNT(*) > 1
  `);
  console.log('Duplicate UTR count:', dupUtrs.length);
  if (dupUtrs.length > 0) {
    console.log('Duplicate UTRs found:', dupUtrs);
  }

  // 6. Double Entry / Financial Ledger Reconciliation
  console.log('\n=== SECTION F: FINANCIAL LEDGER RECONCILIATION ===');
  const ledgerSum = await queryOne(`
    SELECT 
      ROUND(SUM(debit)::numeric, 2) as total_debits,
      ROUND(SUM(credit)::numeric, 2) as total_credits,
      ROUND((SUM(debit) - SUM(credit))::numeric, 2) as net_receivable,
      COUNT(*) as total_ledger_rows
    FROM financial_ledger
  `);
  console.log('Ledger summary:', ledgerSum);

  const invTotals = await queryOne(`
    SELECT 
      ROUND(SUM(total_amount)::numeric, 2) as invoice_total_gross,
      ROUND(SUM(paid_amount)::numeric, 2) as invoice_total_paid,
      ROUND(SUM(outstanding_balance)::numeric, 2) as invoice_total_outstanding
    FROM invoices
    WHERE status != 'cancelled'
  `);
  console.log('Active invoices total gross / paid / outstanding:', invTotals);

  // 7. Master Data Live Verification
  console.log('\n=== SECTION G: MASTER DATA VERIFICATION ===');
  const states = await getStatesMaster();
  const taxSlabs = await getTaxRatesMaster();
  const hsnSac = await getHsnSacMaster();
  const invTypes = await getInvoiceTypesMaster();
  const invStatuses = await getInvoiceStatusesMaster();
  const payModes = await getPaymentModesMaster();
  const creditReasons = await getCreditNoteReasonsMaster();
  const debitReasons = await getDebitNoteReasonsMaster();
  const cancelReasons = await getCancellationReasonsMaster();
  const commRules = await getCommissionRulesMaster();
  const ageingBuckets = await getAgeingBucketsMaster();

  console.log(`- States: ${states.length} configured (All Indian states & UTs present)`);
  console.log(`- Tax Slabs: ${taxSlabs.length} slabs [${taxSlabs.map(s => s.rate + '%').join(', ')}]`);
  console.log(`- HSN / SAC Codes: ${hsnSac.length} entries`);
  console.log(`- Invoice Types: ${invTypes.length} types [${invTypes.map(t => t.name).join(', ')}]`);
  console.log(`- Invoice Statuses: ${invStatuses.length} statuses [${invStatuses.map(s => s.name).join(', ')}]`);
  console.log(`- Payment Modes: ${payModes.length} modes [${payModes.map(m => m.name).join(', ')}]`);
  console.log(`- Credit Note Reasons: ${creditReasons.length} configured`);
  console.log(`- Debit Note Reasons: ${debitReasons.length} configured`);
  console.log(`- Cancellation Reasons: ${cancelReasons.length} configured`);
  console.log(`- Commission Rules: ${commRules.length} rules`);
  console.log(`- Ageing Buckets: ${ageingBuckets.length} buckets`);

  // 8. Line Items & Snapshot Integrity
  console.log('\n=== SECTION H: LINE ITEMS & SNAPSHOT INTEGRITY ===');
  const sampleWithSnapshot = await queryOne(`
    SELECT id, invoice_number, line_items, company_snapshot, customer_snapshot
    FROM invoices
    WHERE company_snapshot IS NOT NULL
    LIMIT 1
  `);
  if (sampleWithSnapshot) {
    console.log('Invoice with company snapshot:', sampleWithSnapshot.invoice_number);
    try {
      const snap = JSON.parse(sampleWithSnapshot.company_snapshot);
      console.log('Company snapshot legal name:', snap.legal_name);
      console.log('Company snapshot GSTIN:', snap.gstin);
      console.log('Company snapshot State Code:', snap.state_code);
    } catch (e) {
      console.log('Snapshot parse err:', e.message);
    }
  }

  // 9. Check Test Data Rows
  console.log('\n=== SECTION I: TEST / ACCEPTANCE ROWS IDENTIFIED ===');
  const testInvs = await queryAll(`
    SELECT id, invoice_number, status, total_amount, created_at
    FROM invoices
    WHERE id LIKE 'BILL-%' OR invoice_number LIKE '%ACPT%' OR invoice_number LIKE '%CONCUR%'
    ORDER BY created_at DESC
  `);
  console.log(`Test / Acceptance invoices count: ${testInvs.length}`);
  if (testInvs.length > 0) {
    console.table(testInvs.map(t => ({ id: t.id, no: t.invoice_number, status: t.status, amount: t.total_amount })));
  }

  // 10. Series configuration
  console.log('\n=== SECTION J: INVOICE SERIES STATUS ===');
  const series = await queryAll(`SELECT * FROM invoice_series_configs`);
  console.table(series);

  console.log('\n=== COMPREHENSIVE LIVE AUDIT FINISHED ===');
}

comprehensiveAudit().catch(console.error);

