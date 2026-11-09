const { supabase } = require('../dist-server/server/supabase.js');

const KEEP_INVOICE_IDS = [
  'inv-1793773661197', // 1: INV-2627/1002 (Test Partner Solutions - B2B Token, Unpaid ₹5,900)
  'inv-1793773676866', // 2: INV-2627/1003 (Test Partner Solutions - B2B Token, Paid ₹5,900 UPI)
  'inv-1793774704120', // 3: INV-2627/1004 (Test Partner Solutions - B2B Token, Paid ₹5,900 UPI)
  'inv-1793788854441', // 4: INV-2627/1005 (Invalid Corp - B2C/URP DSC, Unpaid ₹1,180)
  'inv-1793789025103', // 5: INV-2627/1006 (Invalid Corp - B2C/URP Combo DSC+Token, Unpaid ₹11,505)
  'inv-1793860427615', // 6: SS-MH-26-1006 (Test Partner Solutions - Maharashtra Series, Unpaid ₹590)
  'inv-1793860428299', // 7: SS-MH-26-1007 (Test Partner Solutions - Maharashtra Series, Unpaid ₹590)
  'inv-1793862336194', // 8: INV-2627/1020 (Apex Digital Certifications LLP - B2B DSC Token, Unpaid ₹2,360)
  'inv-1793873558492', // 9: INV-2627/1030 (Synthetic Regression Partner 1017 - Combo DSC+Token, Unpaid ₹11,505)
  'inv-1793977391804'  // 10: INV-2627/1054 (Apex Digital Certifications LLP - Multi-Item, Paid ₹3,540 + CN/DN links)
];

const KEEP_PAYMENT_IDS = [
  'pay-1793773677097', // For INV-2627/1003 (₹5,900 UPI)
  'pay-1793774704283', // For INV-2627/1004 (₹5,900 UPI)
  'pay-1793874137790', // For INV-2627/1030 (₹11,505 NEFT pending)
  'pay-1793874507916', // For INV-2627/1030 (₹11,505 NEFT pending)
  'pay-1793977409649', // For INV-2627/1054 (₹1,000 UPI)
  'pay-1793977411849'  // For INV-2627/1054 (₹2,540 NEFT)
];

const KEEP_LEDGER_REFS = new Set([
  ...KEEP_INVOICE_IDS,
  ...KEEP_PAYMENT_IDS,
  'cn-1793977414944', // Credit note for INV-2627/1054
  'dn-1793977416412'  // Debit note for INV-2627/1054
]);

async function executeControlledCleanup() {
  console.log('================================================================');
  console.log('DBIZ ERP — CONTROLLED PRODUCTION DATA CLEANUP EXECUTION');
  console.log('================================================================\n');

  // Step 1: Pre-cleanup verification of candidates
  console.log('Step 1: Verifying the 10 selected invoices in live Supabase...');
  const { data: currentInvs } = await supabase.from('invoices').select('id, invoice_number');
  const foundKeep = currentInvs.filter(i => KEEP_INVOICE_IDS.includes(i.id));
  if (foundKeep.length !== 10) {
    console.error(`FATAL: Only found ${foundKeep.length} of 10 keep invoices in DB! Aborting.`);
    process.exit(1);
  }
  console.log('Verified: All 10 genuine keep invoices are present in DB.\n');

  // Step 2: Clean up Payments received that are NOT in KEEP_PAYMENT_IDS
  console.log('Step 2: Cleaning up test payments...');
  const { data: allPays } = await supabase.from('payments_received').select('id');
  const paysToDelete = allPays.filter(p => !KEEP_PAYMENT_IDS.includes(p.id)).map(p => p.id);
  console.log(`Found ${paysToDelete.length} payments to delete...`);
  if (paysToDelete.length > 0) {
    const { error: payErr } = await supabase.from('payments_received').delete().in('id', paysToDelete);
    if (payErr) {
      console.error('Error deleting payments:', payErr);
      process.exit(1);
    }
  }
  console.log('Payments cleanup complete.\n');

  // Step 3: Clean up Financial Ledger entries that are NOT in KEEP_LEDGER_REFS
  console.log('Step 3: Cleaning up test financial ledger entries...');
  const { data: allLedger } = await supabase.from('financial_ledger').select('id, reference_id');
  const ledgerToDelete = allLedger.filter(l => !KEEP_LEDGER_REFS.has(l.reference_id)).map(l => l.id);
  console.log(`Found ${ledgerToDelete.length} ledger entries to delete...`);
  if (ledgerToDelete.length > 0) {
    // Delete in batches of 50 to avoid URL length issues
    for (let i = 0; i < ledgerToDelete.length; i += 50) {
      const batch = ledgerToDelete.slice(i, i + 50);
      const { error: ledErr } = await supabase.from('financial_ledger').delete().in('id', batch);
      if (ledErr) {
        console.error('Error deleting ledger batch:', ledErr);
        process.exit(1);
      }
    }
  }
  console.log('Ledger cleanup complete.\n');

  // Step 4: Clean up Invoices that are NOT in KEEP_INVOICE_IDS
  console.log('Step 4: Cleaning up test/debug invoices...');
  const invsToDelete = currentInvs.filter(i => !KEEP_INVOICE_IDS.includes(i.id)).map(i => i.id);
  console.log(`Found ${invsToDelete.length} invoices to delete...`);
  if (invsToDelete.length > 0) {
    for (let i = 0; i < invsToDelete.length; i += 50) {
      const batch = invsToDelete.slice(i, i + 50);
      const { error: invErr } = await supabase.from('invoices').delete().in('id', batch);
      if (invErr) {
        console.error('Error deleting invoice batch:', invErr);
        process.exit(1);
      }
    }
  }
  console.log('Invoices cleanup complete.\n');

  // Step 5: Post-cleanup verification & assertions
  console.log('Step 5: Verifying post-cleanup counts...');
  const { data: finalInvs, count: finalInvCount } = await supabase.from('invoices').select('*', { count: 'exact' });
  const { data: finalPays, count: finalPayCount } = await supabase.from('payments_received').select('*', { count: 'exact' });
  const { data: finalLedger, count: finalLedgerCount } = await supabase.from('financial_ledger').select('*', { count: 'exact' });

  console.log('Final Invoices Count in DB:', finalInvCount);
  console.log('Final Payments Count in DB:', finalPayCount);
  console.log('Final Financial Ledger Count in DB:', finalLedgerCount);

  if (finalInvCount !== 10) {
    console.error(`FATAL REQUIREMENT BREACH: Final invoices count is ${finalInvCount}, expected exactly 10!`);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('CLEANUP SUCCESSFUL — EXACTLY 10 GENUINE BILLING RECORDS RETAINED');
  console.log('================================================================\n');
}

executeControlledCleanup().catch(err => {
  console.error('Unhandled cleanup error:', err);
  process.exit(1);
});

