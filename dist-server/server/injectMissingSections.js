"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
let content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// 1. Add ChevronDown, MoreHorizontal to lucide-react imports if not present
if (!content.includes('ChevronDown')) {
    content = content.replace("Search\n} from 'lucide-react'", "Search,\n  ChevronDown,\n  MoreHorizontal\n} from 'lucide-react'");
}
// 2. Add moreOpen state inside TokenProcurementPage
if (!content.includes('const [moreOpen, setMoreOpen]')) {
    content = content.replace("const [activeTab, setActiveTab] = useState<", "const [moreOpen, setMoreOpen] = useState(false)\n  const [moreSearch, setMoreSearch] = useState('')\n  const [activeTab, setActiveTab] = useState<");
}
// 3. Add quotes, vendors, estimates, profiles, locations, sales-payments sections right after calculator
const newSections = `
      {/* TAB CONTENT: VENDOR QUOTES */}
      {activeTab === 'quotes' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Vendor Quotations Master</h3>
              <p className="text-xs text-slate-400">Active token rate quotations received from verified suppliers and manufacturers.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Quote #</th>
                  <th className="p-3.5">Vendor</th>
                  <th className="p-3.5">Quote Date</th>
                  <th className="p-3.5">Valid From</th>
                  <th className="p-3.5">Valid To</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {quotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No vendor quotations found.
                    </td>
                  </tr>
                ) : (
                  quotes.map(q => (
                    <tr key={q.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-medium text-blue-400">{q.quote_number}</td>
                      <td className="p-3.5 text-slate-200">{q.party_name || q.party_id}</td>
                      <td className="p-3.5 text-xs text-slate-400">{q.quote_date}</td>
                      <td className="p-3.5 text-xs text-slate-400">{q.valid_from}</td>
                      <td className="p-3.5 text-xs text-slate-400">{q.valid_to || 'Open'}</td>
                      <td className="p-3.5 text-center">
                        <span className={\`px-2 py-0.5 rounded text-xs font-semibold \${
                          q.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                        }\`}>
                          {q.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SAVED ESTIMATES */}
      {activeTab === 'estimates' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Saved Procurement Estimates</h3>
              <p className="text-xs text-slate-400">Pre-PO cost calculations and supplier estimations recorded in the system.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Estimate #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Vendor</th>
                  <th className="p-3.5 text-right">Quantity</th>
                  <th className="p-3.5 text-right">Base Amount</th>
                  <th className="p-3.5 text-right">GST Amount</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {estimates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No saved procurement estimates found. Use the Estimate Calculator to generate a new estimate.
                    </td>
                  </tr>
                ) : (
                  estimates.map(e => (
                    <tr key={e.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-medium text-blue-400">{e.estimate_number}</td>
                      <td className="p-3.5 text-xs text-slate-400">{e.estimate_date}</td>
                      <td className="p-3.5 text-slate-200">{e.party_name || e.party_id}</td>
                      <td className="p-3.5 text-right font-mono">{e.quantity}</td>
                      <td className="p-3.5 text-right font-mono text-slate-300">₹{Number(e.base_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3.5 text-right font-mono text-slate-400">₹{Number(e.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-white">₹{Number(e.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: VENDORS / SUPPLIERS */}
      {activeTab === 'vendors' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Procurement Vendors & Suppliers</h3>
              <p className="text-xs text-slate-400">Registered hardware token manufacturers, distributors, and supply partners.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Vendor Name</th>
                  <th className="p-3.5">Contact Person</th>
                  <th className="p-3.5">Phone / Mobile</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">City / Location</th>
                  <th className="p-3.5 text-right">Credit Period</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {parties.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No procurement vendors found.
                    </td>
                  </tr>
                ) : (
                  parties.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-medium text-white">{p.party_name}</td>
                      <td className="p-3.5 text-slate-300">{p.contact_person || '-'}</td>
                      <td className="p-3.5 font-mono text-xs text-slate-300">{p.mobile || '-'}</td>
                      <td className="p-3.5 text-xs text-slate-400">{p.email || '-'}</td>
                      <td className="p-3.5 text-xs text-slate-400">{p.city || 'India'}</td>
                      <td className="p-3.5 text-right font-mono text-xs">{p.credit_period_days || 0} days</td>
                      <td className="p-3.5 text-center">
                        <span className={\`px-2 py-0.5 rounded text-xs font-semibold \${
                          p.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                        }\`}>
                          {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: OUR INTERNAL PROFILES */}
      {activeTab === 'profiles' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Our Internal Company Profiles</h3>
              <p className="text-xs text-slate-400">Purchasing entities, GST registrations, and multi-profile legal entities.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Legal Entity Name</th>
                  <th className="p-3.5">Trade Name</th>
                  <th className="p-3.5">GST Registration</th>
                  <th className="p-3.5">Contact Details</th>
                  <th className="p-3.5 text-center">Default Entity</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No internal company profiles configured.
                    </td>
                  </tr>
                ) : (
                  profiles.map(prof => (
                    <tr key={prof.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-medium text-white">{prof.legal_name}</td>
                      <td className="p-3.5 text-slate-300">{prof.trade_name || prof.legal_name}</td>
                      <td className="p-3.5 font-mono text-xs text-slate-300">
                        {prof.gst_registered ? prof.gstin || 'Registered' : 'Non-GST'}
                      </td>
                      <td className="p-3.5 text-xs text-slate-400">{prof.email || prof.mobile || '-'}</td>
                      <td className="p-3.5 text-center">
                        {prof.is_default ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            DEFAULT
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={\`px-2 py-0.5 rounded text-xs font-semibold \${
                          prof.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                        }\`}>
                          {prof.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: DELIVERY HUBS */}
      {activeTab === 'locations' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Delivery Hubs & Receiving Locations</h3>
              <p className="text-xs text-slate-400">Branch offices and logistics receiving centers for token delivery.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Hub / Location Name</th>
                  <th className="p-3.5">Contact Person</th>
                  <th className="p-3.5">Phone / Mobile</th>
                  <th className="p-3.5">Address</th>
                  <th className="p-3.5">City & State</th>
                  <th className="p-3.5 text-center">Default Hub</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No delivery locations configured.
                    </td>
                  </tr>
                ) : (
                  locations.map(loc => (
                    <tr key={loc.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-medium text-white">{loc.location_name}</td>
                      <td className="p-3.5 text-slate-300">{loc.contact_person || '-'}</td>
                      <td className="p-3.5 font-mono text-xs text-slate-300">{loc.mobile || '-'}</td>
                      <td className="p-3.5 text-xs text-slate-400">{loc.address_line || '-'}</td>
                      <td className="p-3.5 text-xs text-slate-300">{loc.city} {loc.pincode ? \`(\${loc.pincode})\` : ''}</td>
                      <td className="p-3.5 text-center">
                        {loc.is_default ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            DEFAULT
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={\`px-2 py-0.5 rounded text-xs font-semibold \${
                          loc.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                        }\`}>
                          {loc.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CUSTOMER PAYMENTS */}
      {activeTab === 'sales-payments' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Customer Payment Receipts</h3>
              <p className="text-xs text-slate-400">Payment entries, bank transactions, and customer settlement vouchers.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Receipt #</th>
                  <th className="p-3.5">Payment Date</th>
                  <th className="p-3.5">Customer / Party</th>
                  <th className="p-3.5">Payment Mode</th>
                  <th className="p-3.5">Transaction Ref / UTR</th>
                  <th className="p-3.5 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {salesPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No customer payment receipts recorded yet. Click &quot;Record Payment&quot; on any sales invoice to log payments.
                    </td>
                  </tr>
                ) : (
                  salesPayments.map((sp: any) => (
                    <tr key={sp.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-medium text-emerald-400">{sp.receipt_number}</td>
                      <td className="p-3.5 text-xs text-slate-400">{sp.payment_date}</td>
                      <td className="p-3.5 font-medium text-white">{sp.party_name || sp.customer_id}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                          {sp.payment_mode}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-400">{sp.transaction_reference_utr || '-'}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-400">
                        ₹{Number(sp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
`;
// Insert newSections right after:
// {/* TAB CONTENT 3: PURCHASE ORDERS (DIRECT ISSUE & CANCEL) */}
content = content.replace("{/* TAB CONTENT 3: PURCHASE ORDERS (DIRECT ISSUE & CANCEL) */}", newSections + "\n      {/* TAB CONTENT 3: PURCHASE ORDERS (DIRECT ISSUE & CANCEL) */}");
fs_1.default.writeFileSync('src/app/inventory/procurement/page.tsx', content, 'utf8');
console.log('Successfully injected missing tab content sections!');
