import React, { useState } from 'react';
import { Product, Transaction, Recharge, DashboardMetrics, FamilyMember } from '../types';
import { Wallet, Plus, ArrowUpRight, ShoppingBag, ArrowDownRight, TrendingUp, Calendar, AlertCircle, Users, Check, Loader2, Minus, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ProductIcon, { cleanProductName } from './ProductIcon';

interface DashboardProps {
  metrics: DashboardMetrics;
  products: Product[];
  transactions: Transaction[];
  recharges: Recharge[];
  onOpenCheckout: (initialProductId?: string) => void;
  onOpenRecharge: () => void;
  members: FamilyMember[];
  activeMember: string;
  onConfirmCheckout?: (items: { ProductID: string; Quantity: number }[], date: string) => Promise<void>;
}

export default function Dashboard({
  metrics,
  products,
  transactions,
  recharges,
  onOpenCheckout,
  onOpenRecharge,
  members,
  activeMember,
  onConfirmCheckout,
}: DashboardProps) {
  // Always view family combined pool data
  const filteredTxs = transactions;
  const filteredRecharges = recharges;

  // Recalculate metrics based on combined pool
  const totalRechargesVal = filteredRecharges.reduce((sum, r) => sum + r.Amount, 0);
  const totalSpendVal = filteredTxs.reduce((sum, t) => sum + t.TotalAmount, 0);
  const displayBalance = totalRechargesVal - totalSpendVal;
  const isNegative = displayBalance < 0;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = (now.getMonth() + 1).toString().padStart(2, '0');
  const matchPrefix = `${currentYear}-${currentMonthStr}`;

  const monthlySpendVal = filteredTxs
    .filter((t) => t.Date.startsWith(matchPrefix))
    .reduce((sum, t) => sum + t.TotalAmount, 0);

  const monthlyRechargesVal = filteredRecharges
    .filter((r) => r.Date.startsWith(matchPrefix))
    .reduce((sum, r) => sum + r.Amount, 0);
  
  // Format last 15 days of spending for Recharts
  const getChartData = () => {
    const dataMap: Record<string, number> = {};
    
    // Initialize last 15 days
    for (let i = 14; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dataMap[dateStr] = 0;
    }

    // Populate transaction sums
    filteredTxs.forEach((t) => {
      if (dataMap[t.Date] !== undefined) {
        dataMap[t.Date] += t.TotalAmount;
      }
    });

    return Object.entries(dataMap).map(([date, amount]) => {
      const [_, m, d] = date.split('-');
      return {
        label: `${d}/${m}`,
        amount: parseFloat(amount.toFixed(2)),
      };
    });
  };

  const chartData = getChartData();

  // Get last 5 activities (either recharges or checkout batches)
  const getRecentActivity = () => {
    interface ActivityItem {
      id: string;
      type: 'purchase' | 'recharge';
      date: string;
      title: string;
      amount: number;
    }

    const items: ActivityItem[] = [];

    // Group transactions by TransactionID for clean log display
    const groupedTx: Record<string, { date: string; amount: number; items: string[] }> = {};
    filteredTxs.forEach((t) => {
      if (!groupedTx[t.TransactionID]) {
        groupedTx[t.TransactionID] = {
          date: t.Date,
          amount: 0,
          items: [],
        };
      }
      groupedTx[t.TransactionID].amount += t.TotalAmount;
      const prod = products.find((p) => p.ProductID === t.ProductID);
      const name = prod ? prod.ProductName : 'Unknown Item';
      groupedTx[t.TransactionID].items.push(`${t.Quantity}x ${name}`);
    });

    Object.entries(groupedTx).forEach(([id, group]) => {
      items.push({
        id,
        type: 'purchase',
        date: group.date,
        title: group.items.slice(0, 2).join(', ') + (group.items.length > 2 ? '...' : ''),
        amount: group.amount,
      });
    });

    // Add recharges
    filteredRecharges.forEach((r) => {
      items.push({
        id: r.RechargeID,
        type: 'recharge',
        date: r.Date,
        title: 'Wallet Recharge',
        amount: r.Amount,
      });
    });

    // Sort by date desc, then by id desc
    return items
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, 5);
  };

  const recentActivities = getRecentActivity();

  const getFrequentProducts = () => {
    if (!products || products.length === 0) return [];
    
    // Count transaction frequency per product
    const frequencies: Record<string, number> = {};
    transactions.forEach((t) => {
      frequencies[t.ProductID] = (frequencies[t.ProductID] || 0) + t.Quantity;
    });

    // Sort all products by their transaction frequency (descending)
    const sorted = [...products].sort((a, b) => {
      const freqA = frequencies[a.ProductID] || 0;
      const freqB = frequencies[b.ProductID] || 0;
      if (freqB !== freqA) {
        return freqB - freqA;
      }
      return a.ProductName.localeCompare(b.ProductName);
    });

    return sorted.slice(0, 4);
  };

  const frequentProducts = getFrequentProducts();

  return (
    <div id="dashboard-tab-content" className="space-y-6 pb-24 animate-fade-in">
      
      {/* Balance Card */}
      <div
        id="balance-card-container"
        className={`rounded-[32px] p-8 shadow-xl shadow-blue-50 border relative overflow-hidden transition-all duration-300 ${
          isNegative
            ? 'bg-rose-50 text-rose-950 border-rose-100'
            : 'bg-blue-600 text-white border-blue-700'
        }`}
      >
        <div className="relative z-10">
          <div className="flex justify-between items-center">
            <span className={`text-xs font-semibold tracking-widest uppercase ${isNegative ? 'text-rose-500' : 'text-blue-100'}`}>
              Wallet Balance
            </span>
            <Wallet size={20} className={isNegative ? 'text-rose-500' : 'text-blue-100'} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span id="current-balance-display" className={`text-4xl font-bold tracking-tight ${isNegative ? 'text-rose-600' : 'text-white'}`}>
              ₹{displayBalance.toFixed(2)}
            </span>
            <span className={`text-xs ${isNegative ? 'text-rose-500' : 'text-blue-100'} opacity-85`}>
              Shared family cash
            </span>
          </div>

          {isNegative && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
              <AlertCircle size={14} className="shrink-0 text-rose-500" />
              <span>
                Shared family balance is below ₹0. Please recharge to clear dues.
              </span>
            </div>
          )}

          {/* Quick Actions inside Card for Compact design */}
          <div className="grid grid-cols-2 gap-3 mt-8">
            <button
              id="quick-checkout-btn"
              onClick={onOpenCheckout}
              className={`py-3 px-5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer ${
                isNegative
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-white text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Plus size={16} />
              <span>Buy</span>
            </button>
            <button
              id="quick-recharge-btn"
              onClick={onOpenRecharge}
              className={`py-3 px-5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                isNegative
                  ? 'bg-white text-rose-600 border border-rose-150 hover:bg-rose-100/50'
                  : 'bg-white/10 text-white border border-white/20 hover:bg-white/15'
              }`}
            >
              <ArrowUpRight size={16} />
              <span>Recharge</span>
            </button>
          </div>
        </div>

        {/* Decorative blur-3xl circle matching the Clean Minimalism design HTML */}
        {!isNegative && (
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        )}
      </div>

      {/* Monthly Summary Statistics */}
      <div id="monthly-stats-grid" className="grid grid-cols-2 gap-4">
        {/* Spent card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col items-center justify-center text-center gap-2 min-w-0 w-full">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-700 shrink-0 border border-slate-100">
            <ShoppingBag size={18} />
          </div>
          <div className="min-w-0 w-full">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block truncate">
              Monthly Spent
            </span>
            <span id="monthly-spend-display" className="text-sm xs:text-base sm:text-lg md:text-xl font-bold text-slate-900 mt-1 block truncate" title={`₹${monthlySpendVal.toFixed(2)}`}>
              ₹{monthlySpendVal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Recharged card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col items-center justify-center text-center gap-2 min-w-0 w-full">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0 border border-blue-50/50">
            <ArrowUpRight size={18} />
          </div>
          <div className="min-w-0 w-full">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block truncate">
              Monthly Recharges
            </span>
            <span id="monthly-recharge-display" className="text-sm xs:text-base sm:text-lg md:text-xl font-bold text-slate-900 mt-1 block truncate" title={`₹${monthlyRechargesVal.toFixed(2)}`}>
              ₹{monthlyRechargesVal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Frequent Purchases / Quick Order Card */}
      {products.length > 0 && (
        <div id="frequent-purchases-card" className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 border border-amber-100">
                <Zap size={16} fill="currentColor" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Frequent Purchases
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Tap to log purchases for <span className="font-semibold text-slate-600">{activeMember}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Grid of frequent items */}
          <div className="grid grid-cols-2 gap-3">
            {frequentProducts.map((product) => {
              const count = transactions
                .filter((t) => t.ProductID === product.ProductID)
                .reduce((sum, t) => sum + t.Quantity, 0);

              const cleanName = cleanProductName(product.ProductName);

              return (
                <div
                  key={product.ProductID}
                  className="border rounded-2xl p-4.5 transition flex flex-col justify-between border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <ProductIcon name={product.ProductName} size={18} className="shadow-sm" />
                      {count > 0 && (
                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                          {count} bought
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <h4 className="text-xs font-bold text-slate-800 leading-tight" title={product.ProductName}>
                        {cleanName}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1 font-medium">
                        ₹{product.Price.toFixed(2)} / {product.Unit}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenCheckout(product.ProductID)}
                    className="mt-4 w-full py-2 bg-white border border-slate-100 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-[10px] font-bold text-slate-600 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Quick Buy</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Recharts visualizer */}
      <div id="spending-chart-card" className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Spending (Last 15 Days)
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Daily Log
          </span>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  fontSize: '11px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                }}
                formatter={(value: any) => [`₹${value}`, 'Amount']}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#2563EB"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSpend)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Family Balance Board (visible when viewing Combined Pool) */}
      {members.length > 0 && (
        <div id="family-balance-board" className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5">
            <Users size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Family Balance Board</h3>
          </div>
          <div className="space-y-3">
            {members.map((member) => {
              const mRecharges = recharges
                .filter((r) => r.Member === member.Name)
                .reduce((sum, r) => sum + r.Amount, 0);
              const mSpend = transactions
                .filter((t) => t.Member === member.Name)
                .reduce((sum, t) => sum + t.TotalAmount, 0);
              const mBal = mRecharges - mSpend;

              return (
                <div key={member.Name} className="flex justify-between items-center text-xs bg-slate-50 border border-slate-100 rounded-2xl p-3.5 hover:bg-slate-100 transition duration-150">
                  <div>
                    <span className="font-bold text-slate-800 block">{member.Name}</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Recharges: <span className="text-blue-600 font-semibold">₹{mRecharges.toFixed(0)}</span> • Spend: <span className="text-rose-600 font-semibold">₹{mSpend.toFixed(0)}</span>
                    </span>
                  </div>
                  <span className={`font-bold px-3 py-1 rounded-xl text-xs ${
                    mBal < 0 
                      ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}>
                    {mBal < 0 ? '' : '+'}₹{mBal.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity List */}
      <div id="recent-activity-card" className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
          <Calendar size={16} className="text-slate-400" />
          <span>Recent Activity</span>
        </h3>

        {recentActivities.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No recent activity logged for the family.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivities.map((activity) => {
              const isPurchase = activity.type === 'purchase';
              const [y, m, d] = activity.date.split('-');
              return (
                <div
                  key={activity.id}
                  id={`activity-${activity.id}`}
                  className="py-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 ${
                        isPurchase ? 'bg-slate-50 text-slate-700' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {isPurchase ? (
                        <ArrowDownRight size={14} />
                      ) : (
                        <ArrowUpRight size={14} />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-850 max-w-[200px] truncate">
                        {activity.title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {`${d}/${m}/${y}`}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold ${
                      isPurchase ? 'text-slate-900' : 'text-blue-600'
                    }`}
                  >
                    {isPurchase ? '-' : '+'}₹{activity.amount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
