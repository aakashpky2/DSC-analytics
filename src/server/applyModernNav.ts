import fs from 'fs'

let content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

const oldNavStart = content.indexOf('{/* Navigation Tabs */}\n      <div className="flex border-b border-slate-800 mb-6 gap-2 overflow-x-auto pb-1">')
if (oldNavStart === -1) {
  console.error('Could not find old navigation tabs block!')
  process.exit(1)
}

const oldNavEnd = content.indexOf('</div>\n\n      {/* TAB CONTENT 1: ESTIMATE CALCULATOR */}')
if (oldNavEnd === -1) {
  console.error('Could not find end of old navigation tabs block!')
  process.exit(1)
}

console.log('Found block from', oldNavStart, 'to', oldNavEnd)

const modernNav = `{/* Modernized Responsive Navigation with Overflow "More ▾" Menu */}
      <div className="relative mb-6 border-b border-slate-800">
        <div className="flex items-center justify-between gap-2 pb-2">
          {/* Main Visible Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'calculator', label: 'Estimate Calculator', icon: Calculator },
              { id: 'quotes', label: 'Vendor Quotes', icon: FileSpreadsheet, badge: quotes.length },
              { id: 'orders', label: 'Purchase Orders', icon: FileText, badge: purchaseOrders.length },
              { id: 'bills', label: 'Purchase Bills', icon: ShoppingBag, badge: purchaseBills.length },
              { id: 'opening-stock', label: 'Opening Stock', icon: CheckCircle2, badge: openingStockList.length },
            ].map(t => {
              const Icon = t.icon
              const isActive = activeTab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id as any)
                    setMoreOpen(false)
                  }}
                  className={\`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap \${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 bg-slate-900/60 border border-slate-800/80'
                  }\`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.label}</span>
                  {t.badge !== undefined && (
                    <span className={\`px-1.5 py-0.2 rounded text-[10px] font-mono \${
                      isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                    }\`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              )
            })}

            {/* If currently selected tab is inside the "More" menu, show an active pill indicator */}
            {![
              'calculator', 'quotes', 'orders', 'bills', 'opening-stock'
            ].includes(activeTab) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                <span>Active: {[
                  { id: 'profile-stocks', label: 'Profile Stock Ledger' },
                  { id: 'sales-estimates', label: 'Sales Estimates' },
                  { id: 'sales-invoices', label: 'Sales Invoices' },
                  { id: 'sales-payments', label: 'Customer Payments' },
                  { id: 'party-ledgers', label: 'Party Ledgers' },
                  { id: 'outstanding-ageing', label: 'Outstanding & Ageing' },
                  { id: 'sales-monthly', label: 'Monthly Sales (FY)' },
                  { id: 'sales-annual', label: 'Annual Sales (FY)' },
                  { id: 'purchase-overall', label: 'Procurement Report' },
                  { id: 'estimate-pipeline', label: 'Estimate Pipeline' },
                  { id: 'customer-analytics', label: 'Customer Profit Analytics' },
                  { id: 'vendor-analytics', label: 'Vendor Landed Cost Comparison' },
                  { id: 'receipts', label: 'Purchase Entries' },
                  { id: 'inwards', label: 'Freight / Courier Inward' },
                  { id: 'couriers', label: 'Courier Masters' },
                  { id: 'analytics', label: 'Courier Performance' },
                  { id: 'templates', label: 'Document Templates' },
                  { id: 'numbering', label: 'Document Numbering' },
                  { id: 'rules', label: 'Numbering Rules' },
                  { id: 'sales-rates', label: 'Sales Rate Master' },
                  { id: 'pricing-categories', label: 'Pricing Categories' },
                  { id: 'customer-levels', label: 'Customer Levels & Rules' },
                  { id: 'token-register', label: 'Token Register & Profits' },
                  { id: 'vendors', label: 'Vendors / Suppliers' },
                  { id: 'estimates', label: 'Saved Estimates' },
                  { id: 'profiles', label: 'Our Internal Profiles' },
                  { id: 'locations', label: 'Delivery Hubs' }
                ].find(x => x.id === activeTab)?.label || activeTab}</span>
              </div>
            )}
          </div>

          {/* More ▾ Dropdown Trigger */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={\`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition border \${
                moreOpen || ![
                  'calculator', 'quotes', 'orders', 'bills', 'opening-stock'
                ].includes(activeTab)
                  ? 'bg-slate-800 text-white border-blue-500/50 shadow-sm'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-700/80 hover:bg-slate-800/80'
              }\`}
            >
              <span>More Modules</span>
              <ChevronDown className={\`w-3.5 h-3.5 transition-transform duration-200 \${moreOpen ? 'rotate-180 text-blue-400' : 'text-slate-400'}\`} />
            </button>

            {/* More Dropdown Menu */}
            {moreOpen && (
              <>
                {/* Backdrop to close when clicking outside */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMoreOpen(false)}
                />

                <div className="absolute right-0 mt-2 w-80 md:w-96 max-h-[75vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 space-y-3">
                  {/* Search inside More Menu */}
                  <div className="px-1 pt-1">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search more modules..."
                        value={moreSearch}
                        onChange={e => setMoreSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Group 1: Stock & Logistics */}
                  {[
                    {
                      category: 'Stock, Receipts & Logistics',
                      items: [
                        { id: 'profile-stocks', label: 'Profile Stock Ledger', icon: ShieldCheck, badge: profileStockList.length },
                        { id: 'receipts', label: 'Purchase Entries', icon: ShoppingBag, badge: purchaseReceipts.length },
                        { id: 'inwards', label: 'Freight / Courier Inward', icon: Truck, badge: courierInwards.length },
                        { id: 'couriers', label: 'Courier Masters', icon: Building2, badge: couriers.length },
                        { id: 'analytics', label: 'Courier Performance', icon: CheckCircle2 },
                        { id: 'token-register', label: 'Token Register & Profits', icon: FileSpreadsheet },
                      ]
                    },
                    {
                      category: 'Token Sales & Customer Statements',
                      items: [
                        { id: 'sales-estimates', label: 'Sales Estimates', icon: FileText },
                        { id: 'sales-invoices', label: 'Sales Invoices', icon: ShoppingBag },
                        { id: 'sales-payments', label: 'Customer Payments', icon: CheckCircle2 },
                        { id: 'party-ledgers', label: 'Party Ledgers', icon: FileText },
                        { id: 'outstanding-ageing', label: 'Outstanding & Ageing', icon: AlertCircle },
                      ]
                    },
                    {
                      category: 'Reports & Business Intelligence',
                      items: [
                        { id: 'sales-monthly', label: 'Monthly Sales (FY)', icon: FileSpreadsheet },
                        { id: 'sales-annual', label: 'Annual Sales (FY)', icon: ShieldCheck },
                        { id: 'purchase-overall', label: 'Procurement Report', icon: ShoppingBag },
                        { id: 'estimate-pipeline', label: 'Estimate Pipeline', icon: Calculator },
                        { id: 'customer-analytics', label: 'Customer Profit Analytics', icon: ShieldCheck },
                        { id: 'vendor-analytics', label: 'Vendor Landed Cost Comparison', icon: Calculator },
                      ]
                    },
                    {
                      category: 'Pricing Rules & Customer Levels',
                      items: [
                        { id: 'sales-rates', label: 'Sales Rate Master', icon: Calculator },
                        { id: 'pricing-categories', label: 'Pricing Categories', icon: Building2 },
                        { id: 'customer-levels', label: 'Customer Levels & Rules', icon: ShieldCheck },
                      ]
                    },
                    {
                      category: 'Templates & Document Numbering',
                      items: [
                        { id: 'templates', label: 'Document Templates', icon: FileCode2, badge: templates.length },
                        { id: 'numbering', label: 'Document Numbering', icon: FileText },
                        { id: 'rules', label: 'Numbering Rules', icon: ShieldCheck },
                      ]
                    },
                    {
                      category: 'Master Entities & Directories',
                      items: [
                        { id: 'vendors', label: 'Vendors / Suppliers', icon: Building2, badge: parties.length },
                        { id: 'estimates', label: 'Saved Estimates', icon: CheckCircle2, badge: estimates.length },
                        { id: 'profiles', label: 'Our Internal Profiles', icon: ShieldCheck, badge: profiles.length },
                        { id: 'locations', label: 'Delivery Hubs', icon: Truck, badge: locations.length },
                      ]
                    }
                  ].map((grp, gIdx) => {
                    const filteredItems = grp.items.filter(item =>
                      !moreSearch || item.label.toLowerCase().includes(moreSearch.toLowerCase())
                    )
                    if (filteredItems.length === 0) return null

                    return (
                      <div key={gIdx} className="space-y-1">
                        <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {grp.category}
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          {filteredItems.map(item => {
                            const Icon = item.icon
                            const isCurrent = activeTab === item.id
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setActiveTab(item.id as any)
                                  setMoreOpen(false)
                                }}
                                className={\`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition text-left \${
                                  isCurrent
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                }\`}
                              >
                                <span className="flex items-center gap-2 truncate">
                                  <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                  <span className="truncate">{item.label}</span>
                                </span>
                                {item.badge !== undefined && (
                                  <span className={\`ml-2 px-1.5 py-0.2 rounded text-[10px] font-mono shrink-0 \${
                                    isCurrent ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                                  }\`}>
                                    {item.badge}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>`

content = content.slice(0, oldNavStart) + modernNav + content.slice(oldNavEnd + '</div>'.length)

fs.writeFileSync('src/app/inventory/procurement/page.tsx', content, 'utf8')
console.log('Successfully replaced old tab strip with modern responsive overflow navigation!')
