"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
let content = fs_1.default.readFileSync('src/app/billing/invoices/new/page.tsx', 'utf8');
// 1. Expand the container width from max-w-5xl to w-full max-w-7xl (or max-w-full)
content = content.replace('<div className="space-y-6 max-w-5xl mx-auto pb-12">', '<div className="space-y-6 w-full max-w-7xl mx-auto pb-12">');
// 2. Replace the commercial line items table
const oldTableBlock = `            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                    <th className="p-3">Type</th>
                    <th className="p-3">HSN / SAC</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Unit Rate (₹)</th>
                    <th className="p-3 text-right">Discount (₹)</th>
                    <th className="p-3">GST Slab</th>
                    <th className="p-3 text-right">Taxable (₹)</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((row, idx) => {
                    const gross = (Number(row.quantity) || 1) * (Number(row.unit_price) || 0)
                    const disc = Math.min(gross, Number(row.discount_amount) || 0)
                    const taxable = Math.max(0, gross - disc)

                    return (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        {/* Type */}
                        <td className="p-3">
                          <span
                            className={\`px-2 py-0.5 rounded text-[10px] font-bold \${
                              row.item_type === 'GOODS'
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                            }\`}
                          >
                            {row.item_type}
                          </span>
                        </td>

                        {/* HSN/SAC Dropdown from DB Master */}
                        <td className="p-3">
                          <select
                            value={row.hsn_sac}
                            onChange={(e) => handleItemChange(idx, 'hsn_sac', e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          >
                            {masters?.hsnSac?.map((h) => (
                              <option key={h.id} value={h.code}>
                                {h.code} ({h.type})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Description */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-64"
                          />
                        </td>

                        {/* Qty */}
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-16 text-right"
                          />
                        </td>

                        {/* Unit Rate */}
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unit_price}
                            onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-24 text-right"
                          />
                        </td>

                        {/* Discount Amount */}
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.discount_amount}
                            onChange={(e) =>
                              handleItemChange(idx, 'discount_amount', parseFloat(e.target.value) || 0)
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-20 text-right"
                          />
                        </td>

                        {/* GST Slab from DB Master */}
                        <td className="p-3">
                          <select
                            value={row.tax_rate_pct}
                            onChange={(e) =>
                              handleItemChange(idx, 'tax_rate_pct', parseFloat(e.target.value) || 0)
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          >
                            {masters?.taxRates?.map((t) => (
                              <option key={t.id} value={t.rate_pct}>
                                {t.rate_pct}% ({t.description.split('(')[0].trim()})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Taxable Value */}
                        <td className="p-3 text-right font-mono text-slate-200">
                          ₹{taxable.toFixed(2)}
                        </td>

                        {/* Action */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 disabled:opacity-20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>`;
const newTableBlock = `            {/* Responsive Desktop Table (Hidden on small mobile screens to prevent overflow, replaced by Card Layout) */}
            <div className="hidden md:block border border-slate-800 rounded-xl bg-slate-950 overflow-hidden">
              <table className="w-full text-left text-xs table-fixed">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                    <th style={{ width: '8%' }} className="py-2.5 px-3">Type</th>
                    <th style={{ width: '13%' }} className="py-2.5 px-3">HSN / SAC</th>
                    <th style={{ width: '31%' }} className="py-2.5 px-3">Description</th>
                    <th style={{ width: '7%' }} className="py-2.5 px-3 text-right">Qty</th>
                    <th style={{ width: '12%' }} className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                    <th style={{ width: '10%' }} className="py-2.5 px-3 text-right">Discount (₹)</th>
                    <th style={{ width: '11%' }} className="py-2.5 px-3">GST Slab</th>
                    <th style={{ width: '8%' }} className="py-2.5 px-3 text-right">Taxable</th>
                    <th style={{ width: '4%' }} className="py-2.5 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((row, idx) => {
                    const gross = (Number(row.quantity) || 1) * (Number(row.unit_price) || 0)
                    const disc = Math.min(gross, Number(row.discount_amount) || 0)
                    const taxable = Math.max(0, gross - disc)

                    return (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        {/* Type */}
                        <td className="py-2.5 px-3">
                          <span
                            className={\`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold truncate max-w-full \${
                              row.item_type === 'GOODS'
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                            }\`}
                          >
                            {row.item_type}
                          </span>
                        </td>

                        {/* HSN/SAC Dropdown */}
                        <td className="py-2.5 px-3">
                          <select
                            value={row.hsn_sac}
                            onChange={(e) => handleItemChange(idx, 'hsn_sac', e.target.value)}
                            className="w-full min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white truncate focus:outline-none focus:border-indigo-500"
                            title={row.hsn_sac}
                          >
                            {masters?.hsnSac?.map((h) => (
                              <option key={h.id} value={h.code} className="bg-slate-950 text-white">
                                {h.code} ({h.type})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Description */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full min-w-0 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 truncate"
                            title={row.description}
                          />
                        </td>

                        {/* Qty */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="w-full min-w-0 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-right focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </td>

                        {/* Unit Rate */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unit_price}
                            onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </td>

                        {/* Discount */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.discount_amount}
                            onChange={(e) =>
                              handleItemChange(idx, 'discount_amount', parseFloat(e.target.value) || 0)
                            }
                            className="w-full min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </td>

                        {/* GST Slab */}
                        <td className="py-2.5 px-3">
                          <select
                            value={row.tax_rate_pct}
                            onChange={(e) =>
                              handleItemChange(idx, 'tax_rate_pct', parseFloat(e.target.value) || 0)
                            }
                            className="w-full min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white truncate focus:outline-none focus:border-indigo-500"
                          >
                            {masters?.taxRates?.map((t) => (
                              <option key={t.id} value={t.rate_pct} className="bg-slate-950 text-white">
                                {t.rate_pct}% ({t.description.split('(')[0].trim()})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Taxable */}
                        <td className="py-2.5 px-3 text-right font-mono text-slate-200 truncate">
                          ₹{taxable.toFixed(2)}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 disabled:opacity-20 transition"
                            title="Remove line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Stacked Card Layout (Under md < 768px, zero horizontal overflow) */}
            <div className="md:hidden space-y-3">
              {items.map((row, idx) => {
                const gross = (Number(row.quantity) || 1) * (Number(row.unit_price) || 0)
                const disc = Math.min(gross, Number(row.discount_amount) || 0)
                const taxable = Math.max(0, gross - disc)

                return (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500">#{idx + 1}</span>
                        <span
                          className={\`px-2 py-0.5 rounded text-[10px] font-bold \${
                            row.item_type === 'GOODS'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                              : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                          }\`}
                        >
                          {row.item_type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className="text-slate-500 hover:text-rose-400 p-1 disabled:opacity-20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Item Description</label>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">HSN / SAC</label>
                        <select
                          value={row.hsn_sac}
                          onChange={(e) => handleItemChange(idx, 'hsn_sac', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        >
                          {masters?.hsnSac?.map((h) => (
                            <option key={h.id} value={h.code} className="bg-slate-950 text-white">
                              {h.code} ({h.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">GST Slab</label>
                        <select
                          value={row.tax_rate_pct}
                          onChange={(e) => handleItemChange(idx, 'tax_rate_pct', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        >
                          {masters?.taxRates?.map((t) => (
                            <option key={t.id} value={t.rate_pct} className="bg-slate-950 text-white">
                              {t.rate_pct}% ({t.description.split('(')[0].trim()})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 text-right">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 text-right">Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 text-right">Discount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.discount_amount}
                          onChange={(e) => handleItemChange(idx, 'discount_amount', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono"
                        />
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Line Taxable:</span>
                      <span className="font-mono font-bold text-white">₹{taxable.toFixed(2)}</span>
                    </div>
                  </div>
                )
              })}
            </div>`;
if (!content.includes(oldTableBlock)) {
    console.error('Could not find oldTableBlock!');
    process.exit(1);
}
content = content.replace(oldTableBlock, newTableBlock);
fs_1.default.writeFileSync('src/app/billing/invoices/new/page.tsx', content, 'utf8');
console.log('Successfully updated /billing/invoices/new with responsive layout and fixed table!');
