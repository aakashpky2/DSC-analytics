"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
let content = fs_1.default.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8');
// Let's inspect where modernNav starts and ends
const startMarker = '{/* Modernized Responsive Navigation with Overflow "More ▾" Menu */}';
const endMarker = '{/* TAB CONTENT 1: ESTIMATE CALCULATOR */}';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);
console.log('startIdx:', startIdx, 'endIdx:', endIdx);
// The new Level 1 & Level 2 navigation design
const twoLevelNav = `{/* Two-Level Module Hierarchy Navigation */}
      <div className="mb-6 space-y-3">
        {/* LEVEL 1: Primary Procurement Tabs + High-Level "More Modules ▾" Categories */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800 flex-wrap">
          {/* Main 5 Visible Procurement Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'calculator', label: 'Estimate Calculator', icon: Calculator },
              { id: 'quotes', label: 'Vendor Quotes', icon: FileSpreadsheet, badge: quotes.length },
              { id: 'orders', label: 'Purchase Orders', icon: FileText, badge: purchaseOrders.length },
              { id: 'bills', label: 'Purchase Bills', icon: ShoppingBag, badge: purchaseBills.length },
              { id: 'opening-stock', label: 'Opening Stock', icon: CheckCircle2, badge: openingStockList.length },
            ].map(t => {
              const Icon = t.icon
              const isDirectActive = activeTab === t.id && !selectedModule
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedModule(null)
                    setActiveTab(t.id as any)
                    setMoreOpen(false)
                  }}
                  className={\`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap \${
                    isDirectActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 bg-slate-900/60 border border-slate-800/80'
                  }\`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.label}</span>
                  {t.badge !== undefined && (
                    <span className={\`px-1.5 py-0.2 rounded text-[10px] font-mono \${
                      isDirectActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                    }\`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* More Modules ▾ Trigger (Only Top-Level Module Categories) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={\`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition border \${
                selectedModule
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : moreOpen
                  ? 'bg-slate-800 text-white border-blue-500/50'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-700/80 hover:bg-slate-800/80'
              }\`}
            >
              <span>{selectedModule ? selectedModule.name : 'More Modules'}</span>
              <ChevronDown className={\`w-3.5 h-3.5 transition-transform duration-200 \${moreOpen ? 'rotate-180 text-blue-300' : 'text-slate-400'}\`} />
            </button>

            {/* LEVEL 1 POPUP: Shows ONLY High-Level Module Headings (No Long Function List, No Internal Scrollbar) */}
            {moreOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMoreOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 divide-y divide-slate-800/60">
                  <div className="py-1">
                    {[
                      {
                        id: 'pricing',
                        name: 'Pricing Rules & Customer Levels',
                        icon: Calculator,
                        defaultTab: 'sales-rates',
                        desc: 'Rates, Categories & Level Rules'
                      },
                      {
                        id: 'templates',
                        name: 'Templates & Document Numbering',
                        icon: FileCode2,
                        defaultTab: 'templates',
                        desc: 'HTML Templates & Series Numbering'
                      },
                      {
                        id: 'reports',
                        name: 'Reports & Business Intelligence',
                        icon: FileSpreadsheet,
                        defaultTab: 'sales-monthly',
                        desc: 'Sales, Profit & Vendor Analysis'
                      },
                      {
                        id: 'masters',
                        name: 'Master Entities & Directories',
                        icon: Building2,
                        defaultTab: 'vendors',
                        desc: 'Suppliers, Hubs & Profiles'
                      },
                      {
                        id: 'stock',
                        name: 'Stock & Inventory',
                        icon: ShieldCheck,
                        defaultTab: 'profile-stocks',
                        desc: 'Ledger, Inward & Courier Tracking'
                      },
                      {
                        id: 'sales',
                        name: 'Sales Operations',
                        icon: ShoppingBag,
                        defaultTab: 'sales-estimates',
                        desc: 'Estimates, Invoices & Ledgers'
                      }
                    ].map(mod => {
                      const Icon = mod.icon
                      const isCurrentMod = selectedModule?.id === mod.id
                      return (
                        <button
                          key={mod.id}
                          onClick={() => {
                            setSelectedModule({ id: mod.id, name: mod.name })
                            setActiveTab(mod.defaultTab as any)
                            setMoreOpen(false)
                          }}
                          className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition \${
                            isCurrentMod
                              ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/90'
                          }\`}
                        >
                          <div className={\`p-1.5 rounded-md \${isCurrentMod ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}\`}>
                            <Icon className="w-4 h-4 shrink-0" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold leading-tight truncate">{mod.name}</div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">{mod.desc}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* LEVEL 2: Dedicated Module Workspace & Functional Sub-Tabs */}
        {selectedModule && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 shadow-inner">
            <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Module Workspace: {selectedModule.name}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedModule(null)
                  setActiveTab('calculator')
                }}
                className="text-[11px] text-slate-400 hover:text-white hover:underline flex items-center gap-1"
              >
                &larr; Back to Core Procurement
              </button>
            </div>

            {/* Level 2 Sub-Tabs per Module */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Module 1: Pricing Rules & Customer Levels */}
              {selectedModule.id === 'pricing' && [
                { id: 'sales-rates', label: 'Sales Rate Master', icon: Calculator },
                { id: 'pricing-categories', label: 'Pricing Categories', icon: Building2 },
                { id: 'customer-levels', label: 'Customer Levels & Rules', icon: ShieldCheck },
              ].map(sub => {
                const Icon = sub.icon
                const isSubActive = activeTab === sub.id
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveTab(sub.id as any)}
                    className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition \${
                      isSubActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-950/60 border border-slate-800'
                    }\`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                )
              })}

              {/* Module 2: Templates & Document Numbering */}
              {selectedModule.id === 'templates' && [
                { id: 'templates', label: 'Document Templates', icon: FileCode2, badge: templates.length },
                { id: 'numbering', label: 'Document Numbering', icon: FileText },
                { id: 'rules', label: 'Numbering Rules', icon: ShieldCheck },
              ].map(sub => {
                const Icon = sub.icon
                const isSubActive = activeTab === sub.id
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveTab(sub.id as any)}
                    className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition \${
                      isSubActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-950/60 border border-slate-800'
                    }\`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                    {sub.badge !== undefined && (
                      <span className={\`px-1.5 py-0.2 rounded text-[10px] font-mono \${
                        isSubActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                      }\`}>
                        {sub.badge}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Module 3: Reports & Business Intelligence */}
              {selectedModule.id === 'reports' && [
                { id: 'sales-monthly', label: 'Monthly Sales (FY)', icon: FileSpreadsheet },
                { id: 'sales-annual', label: 'Annual Sales (FY)', icon: ShieldCheck },
                { id: 'purchase-overall', label: 'Procurement Report', icon: ShoppingBag },
                { id: 'estimate-pipeline', label: 'Estimate Pipeline', icon: Calculator },
                { id: 'customer-analytics', label: 'Customer Profit Analytics', icon: ShieldCheck },
                { id: 'vendor-analytics', label: 'Vendor Landed Cost Comparison', icon: Calculator },
              ].map(sub => {
                const Icon = sub.icon
                const isSubActive = activeTab === sub.id
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveTab(sub.id as any)}
                    className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition \${
                      isSubActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-950/60 border border-slate-800'
                    }\`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                )
              })}

              {/* Module 4: Master Entities & Directories */}
              {selectedModule.id === 'masters' && [
                { id: 'vendors', label: 'Vendors / Suppliers', icon: Building2, badge: parties.length },
                { id: 'estimates', label: 'Saved Estimates', icon: CheckCircle2, badge: estimates.length },
                { id: 'profiles', label: 'Our Internal Profiles', icon: ShieldCheck, badge: profiles.length },
                { id: 'locations', label: 'Delivery Hubs', icon: Truck, badge: locations.length },
              ].map(sub => {
                const Icon = sub.icon
                const isSubActive = activeTab === sub.id
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveTab(sub.id as any)}
                    className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition \${
                      isSubActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-950/60 border border-slate-800'
                    }\`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                    {sub.badge !== undefined && (
                      <span className={\`px-1.5 py-0.2 rounded text-[10px] font-mono \${
                        isSubActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                      }\`}>
                        {sub.badge}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Module 5: Stock & Inventory */}
              {selectedModule.id === 'stock' && [
                { id: 'profile-stocks', label: 'Profile Stock Ledger', icon: ShieldCheck, badge: profileStockList.length },
                { id: 'receipts', label: 'Purchase Entries', icon: ShoppingBag, badge: purchaseReceipts.length },
                { id: 'inwards', label: 'Freight / Courier Inward', icon: Truck, badge: courierInwards.length },
                { id: 'couriers', label: 'Courier Masters', icon: Building2, badge: couriers.length },
                { id: 'analytics', label: 'Courier Performance', icon: CheckCircle2 },
                { id: 'token-register', label: 'Token Register & Profits', icon: FileSpreadsheet },
              ].map(sub => {
                const Icon = sub.icon
                const isSubActive = activeTab === sub.id
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveTab(sub.id as any)}
                    className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition \${
                      isSubActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-950/60 border border-slate-800'
                    }\`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                    {sub.badge !== undefined && (
                      <span className={\`px-1.5 py-0.2 rounded text-[10px] font-mono \${
                        isSubActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                      }\`}>
                        {sub.badge}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Module 6: Sales Operations */}
              {selectedModule.id === 'sales' && [
                { id: 'sales-estimates', label: 'Sales Estimates', icon: FileText },
                { id: 'sales-invoices', label: 'Sales Invoices', icon: ShoppingBag },
                { id: 'sales-payments', label: 'Customer Payments', icon: CheckCircle2 },
                { id: 'party-ledgers', label: 'Party Ledgers', icon: FileText },
                { id: 'outstanding-ageing', label: 'Outstanding & Ageing', icon: AlertCircle },
              ].map(sub => {
                const Icon = sub.icon
                const isSubActive = activeTab === sub.id
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveTab(sub.id as any)}
                    className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition \${
                      isSubActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-950/60 border border-slate-800'
                    }\`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>\n\n      `;
// Also ensure selectedModule state exists in page.tsx
if (!content.includes('const [selectedModule, setSelectedModule]')) {
    content = content.replace('const [moreOpen, setMoreOpen] = useState(false)', 'const [selectedModule, setSelectedModule] = useState<{ id: string; name: string } | null>(null)\n  const [moreOpen, setMoreOpen] = useState(false)');
}
// Replace the previous nav block
const newStartIdx = content.indexOf(startMarker);
const newEndIdx = content.indexOf(endMarker);
content = content.slice(0, newStartIdx) + twoLevelNav + content.slice(newEndIdx);
fs_1.default.writeFileSync('src/app/inventory/procurement/page.tsx', content, 'utf8');
console.log('Successfully updated to clean two-level module hierarchy!');
