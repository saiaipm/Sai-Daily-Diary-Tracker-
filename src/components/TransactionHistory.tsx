import React, { useState } from 'react';
import { Product, Transaction, Recharge, FamilyMember } from '../types';
import { Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, Edit2, Trash2, CalendarDays, FilterX, Info, Loader2, ArrowUpRight, ArrowDownRight, X, TrendingUp, Plus } from 'lucide-react';

interface TransactionHistoryProps {
  products: Product[];
  transactions: Transaction[];
  recharges: Recharge[];
  members: FamilyMember[];
  activeMember?: string;
  onUpdateTransactions: (updated: Transaction[]) => Promise<void>;
  onUpdateRecharges: (updated: Recharge[]) => Promise<void>;
  onConfirmCheckout?: (
    items: { ProductID: string; Quantity: number }[],
    purchaseDate: string,
    member?: string
  ) => Promise<void>;
}

export default function TransactionHistory({
  products,
  transactions,
  recharges,
  members,
  activeMember,
  onUpdateTransactions,
  onUpdateRecharges,
  onConfirmCheckout,
}: TransactionHistoryProps) {
  // Tabs: "all" | "purchases" | "recharges"
  const [activeLedger, setActiveLedger] = useState<'all' | 'purchases' | 'recharges'>('all');
  
  // Interactive Custom Calendar State
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth()); // 0-indexed
  
  // Range Date Filter
  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(null); // YYYY-MM-DD
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null); // YYYY-MM-DD

  // Add Purchase for Specific Date Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState<string>('');
  const [addModalMember, setAddModalMember] = useState<string>('');
  const [addModalQuantities, setAddModalQuantities] = useState<Record<string, number>>({});
  const [addModalLoading, setAddModalLoading] = useState(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);

  // Edit / Delete states
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingQty, setEditingQty] = useState<number>(1);
  const [editingDate, setEditingDate] = useState<string>('');
  const [editingProductId, setEditingProductId] = useState<string>('');
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [editingMember, setEditingMember] = useState<string>('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete inline confirmation states
  const [txToDeleteState, setTxToDeleteState] = useState<Transaction | null>(null);
  const [rechargeToDeleteState, setRechargeToDeleteState] = useState<Recharge | null>(null);

  // Edit Recharge states
  const [editingRecharge, setEditingRecharge] = useState<Recharge | null>(null);
  const [editingRechargeAmount, setEditingRechargeAmount] = useState<string>('');
  const [editingRechargeDate, setEditingRechargeDate] = useState<string>('');
  const [editingRechargeMember, setEditingRechargeMember] = useState<string>('');

  const openAddPurchaseModal = (targetDate?: string) => {
    const defaultDate = targetDate || selectedStartDate || new Date().toISOString().split('T')[0];
    setAddModalDate(defaultDate);
    setAddModalMember(activeMember || members[0]?.Name || 'Self');
    setAddModalQuantities({});
    setAddModalError(null);
    setAddModalOpen(true);
  };

  const handleSaveAddPurchase = async () => {
    const itemsToSubmit: { ProductID: string; Quantity: number }[] = Object.entries(addModalQuantities)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([ProductID, Quantity]) => ({ ProductID, Quantity: Quantity as number }));

    if (itemsToSubmit.length === 0) {
      setAddModalError('Please select quantity for at least one product.');
      return;
    }

    if (!addModalDate) {
      setAddModalError('Please select a valid date.');
      return;
    }

    if (!onConfirmCheckout) {
      setAddModalError('Checkout service unavailable.');
      return;
    }

    setAddModalLoading(true);
    setAddModalError(null);

    try {
      await onConfirmCheckout(itemsToSubmit, addModalDate, addModalMember);
      setAddModalOpen(false);
    } catch (err: any) {
      setAddModalError(err.message || 'Failed to add purchase.');
    } finally {
      setAddModalLoading(false);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calculate daily spending cache for calendar badges
  const dailySpendMap: Record<string, number> = {};
  transactions.forEach((t) => {
    dailySpendMap[t.Date] = (dailySpendMap[t.Date] || 0) + t.TotalAmount;
  });

  // Calculate daily recharges cache for calendar visualizer
  const dailyRechargeMap: Record<string, number> = {};
  recharges.forEach((r) => {
    dailyRechargeMap[r.Date] = (dailyRechargeMap[r.Date] || 0) + r.Amount;
  });

  // Generate days for standard grid
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Build calendar cells
  const calendarCells = [];
  // Empty slots for previous month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  // Days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  // Handle Edit Transaction Modal Save
  const handleSaveTxEdit = async () => {
    if (!editingTx) return;
    if (editingQty <= 0) {
      setEditError('Quantity must be greater than 0.');
      return;
    }
    const numericPrice = parseFloat(editingPrice);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setEditError('Price must be a valid positive number.');
      return;
    }

    setEditLoading(true);
    setEditError(null);
    try {
      // Create new list
      const updatedList = transactions.map((t) => {
        if (t.TransactionID === editingTx.TransactionID && t.ProductID === editingTx.ProductID && t.Date === editingTx.Date) {
          return {
            ...t,
            ProductID: editingProductId,
            Quantity: editingQty,
            Date: editingDate,
            PriceAtTime: numericPrice,
            TotalAmount: editingQty * numericPrice,
            Member: editingMember,
          };
        }
        return t;
      });

      await onUpdateTransactions(updatedList);
      setEditingTx(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update transaction.');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Delete Transaction
  const handleDeleteTx = async (txToDelete: Transaction) => {
    try {
      const updatedList = transactions.filter(
        (t) => !(t.TransactionID === txToDelete.TransactionID && t.ProductID === txToDelete.ProductID && t.Date === txToDelete.Date)
      );
      await onUpdateTransactions(updatedList);
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
    }
  };

  // Handle Edit Recharge Modal Save
  const handleSaveRechargeEdit = async () => {
    if (!editingRecharge) return;
    const numericAmount = parseFloat(editingRechargeAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setEditError('Amount must be a valid positive number.');
      return;
    }

    setEditLoading(true);
    setEditError(null);
    try {
      const updatedList = recharges.map((r) => {
        if (r.RechargeID === editingRecharge.RechargeID) {
          return {
            ...r,
            Amount: numericAmount,
            Date: editingRechargeDate,
            Member: editingRechargeMember,
          };
        }
        return r;
      });

      await onUpdateRecharges(updatedList);
      setEditingRecharge(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update recharge.');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Delete Recharge
  const handleDeleteRecharge = async (recToDelete: Recharge) => {
    try {
      const updatedList = recharges.filter((r) => r.RechargeID !== recToDelete.RechargeID);
      await onUpdateRecharges(updatedList);
    } catch (err: any) {
      console.error('Error deleting recharge:', err);
    }
  };

  // Filter logs based on calendar range clicks
  const isDateMatchingFilter = (dateStr: string) => {
    if (!selectedStartDate) return true; // No filter
    if (selectedStartDate && !selectedEndDate) {
      return dateStr === selectedStartDate;
    }
    return dateStr >= selectedStartDate && dateStr <= selectedEndDate;
  };

  const filteredTransactions = transactions.filter((t) => isDateMatchingFilter(t.Date));
  const filteredRecharges = recharges.filter((r) => isDateMatchingFilter(r.Date));

  // Calculate summary aggregates for selected range / filter
  const filteredSpendTotal = filteredTransactions.reduce((sum, t) => sum + t.TotalAmount, 0);
  const filteredRechargeTotal = filteredRecharges.reduce((sum, r) => sum + r.Amount, 0);
  const filteredNetFlow = filteredRechargeTotal - filteredSpendTotal;

  // Calculate summary aggregates for currently viewed calendar month
  const currentMonthStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}`;
  const monthTransactions = transactions.filter((t) => t.Date.startsWith(currentMonthStr));
  const monthRecharges = recharges.filter((r) => r.Date.startsWith(currentMonthStr));
  const monthSpendTotal = monthTransactions.reduce((sum, t) => sum + t.TotalAmount, 0);
  const monthRechargeTotal = monthRecharges.reduce((sum, r) => sum + r.Amount, 0);
  const monthNetFlow = monthRechargeTotal - monthSpendTotal;

  // Group transactions by date for visual listing
  const groupedTransactions: Record<string, Transaction[]> = {};
  filteredTransactions.forEach((t) => {
    if (!groupedTransactions[t.Date]) {
      groupedTransactions[t.Date] = [];
    }
    groupedTransactions[t.Date].push(t);
  });

  // Sort dates desc
  const sortedTransactionDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));
  const sortedRecharges = [...filteredRecharges].sort((a, b) => b.Date.localeCompare(a.Date));

  // Unified Items representation for the "All" tab
  // Helper to resolve product name or fallback gracefully for legacy/deleted products
  const getDisplayProductName = (productId: string) => {
    const prod = products.find((p) => p.ProductID === productId);
    if (prod) {
      return { name: prod.ProductName, isArchived: false };
    }
    if (!productId) {
      return { name: 'Unknown Product', isArchived: true };
    }
    let formatted = productId
      .replace(/^prod[_-]/i, '')
      .replace(/[_-]/g, ' ')
      .trim();
    formatted = formatted
      .split(' ')
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ');
    return {
      name: formatted || `Product (${productId})`,
      isArchived: true,
    };
  };

  interface UnifiedItem {
    type: 'purchase' | 'recharge';
    id: string;
    date: string;
    member?: string;
    amount: number;
    label: string;
    sublabel: string;
    isArchived?: boolean;
    original: Transaction | Recharge;
  }

  const unifiedList: UnifiedItem[] = [];

  filteredTransactions.forEach((tx) => {
    const prodInfo = getDisplayProductName(tx.ProductID);
    const cleanName = prodInfo.name.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji_Presentation}|\p{Emoji}/gu, '').trim();
    unifiedList.push({
      type: 'purchase',
      id: `${tx.TransactionID}-${tx.ProductID}-${tx.Date}`,
      date: tx.Date,
      member: tx.Member,
      amount: tx.TotalAmount,
      label: cleanName,
      sublabel: `${tx.Quantity} × ₹${tx.PriceAtTime.toFixed(2)}`,
      isArchived: prodInfo.isArchived,
      original: tx,
    });
  });

  filteredRecharges.forEach((rec) => {
    unifiedList.push({
      type: 'recharge',
      id: rec.RechargeID,
      date: rec.Date,
      member: rec.Member,
      amount: rec.Amount,
      label: 'Wallet Recharge',
      sublabel: `ID: ${rec.RechargeID.substring(0, 10)}...`,
      original: rec,
    });
  });

  // Sort unified items by date descending
  const sortedUnified = [...unifiedList].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.id.localeCompare(a.id);
  });

  // Group unified items by date
  const groupedUnified: Record<string, UnifiedItem[]> = {};
  sortedUnified.forEach((item) => {
    if (!groupedUnified[item.date]) {
      groupedUnified[item.date] = [];
    }
    groupedUnified[item.date].push(item);
  });

  const sortedUnifiedDates = Object.keys(groupedUnified).sort((a, b) => b.localeCompare(a));

  const getFilterAlertLabel = () => {
    if (!selectedStartDate) return null;
    const formatDate = (ds: string) => ds.split('-').reverse().join('/');
    if (!selectedEndDate) {
      return (
        <>
          Showing logs for <span className="font-bold text-blue-600">{formatDate(selectedStartDate)}</span>
        </>
      );
    }
    return (
      <>
        Showing logs from <span className="font-bold text-blue-600">{formatDate(selectedStartDate)}</span> to <span className="font-bold text-blue-600">{formatDate(selectedEndDate)}</span>
      </>
    );
  };

  const handleClearFilter = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
  };

  return (
    <div id="history-tab-content" className="space-y-6 pb-24 animate-fade-in">
      {/* Interactive Calendar view Card */}
      <div id="calendar-view-card" className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <CalendarDays size={20} className="stroke-[2.2px]" />
            <h3 className="font-bold text-sm tracking-tight text-slate-900">Interactive Calendar</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="calendar-prev-month"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span id="calendar-month-year" className="text-xs font-semibold text-slate-800 min-w-[90px] text-center">
              {months[currentMonth]} {currentYear}
            </span>
            <button
              id="calendar-next-month"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* 7 columns grid header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div>Su</div>
          <div>Mo</div>
          <div>Tu</div>
          <div>We</div>
          <div>Th</div>
          <div>Fr</div>
          <div>Sa</div>
        </div>

        {/* Calendar Grid cells */}
        <div id="calendar-cells-grid" className="grid grid-cols-7 gap-1">
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-12"></div>;
            }

            const monthStr = (currentMonth + 1).toString().padStart(2, '0');
            const dayStr = day.toString().padStart(2, '0');
            const fullDateStr = `${currentYear}-${monthStr}-${dayStr}`;

            const totalSpend = dailySpendMap[fullDateStr] || 0;
            const totalRecharge = dailyRechargeMap[fullDateStr] || 0;
            
            const isStart = selectedStartDate === fullDateStr;
            const isEnd = selectedEndDate === fullDateStr;
            const isWithinRange = selectedStartDate && selectedEndDate && fullDateStr > selectedStartDate && fullDateStr < selectedEndDate;
            const isSelected = isStart || isEnd;

            return (
              <button
                key={`day-${day}`}
                id={`calendar-day-${fullDateStr}`}
                onClick={() => {
                  if (!selectedStartDate) {
                    setSelectedStartDate(fullDateStr);
                    setSelectedEndDate(null);
                  } else if (selectedStartDate && !selectedEndDate) {
                    if (fullDateStr < selectedStartDate) {
                      setSelectedStartDate(fullDateStr);
                    } else if (fullDateStr === selectedStartDate) {
                      setSelectedStartDate(null);
                    } else {
                      setSelectedEndDate(fullDateStr);
                    }
                  } else {
                    setSelectedStartDate(fullDateStr);
                    setSelectedEndDate(null);
                  }
                }}
                className={`h-12 rounded-xl flex flex-col items-center justify-between p-1 transition cursor-pointer border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-700'
                    : isWithinRange
                      ? 'bg-blue-50/70 border-blue-200 text-blue-800 font-semibold'
                      : 'bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <span className="text-[11px] font-bold">{day}</span>
                
                {/* Visual badges for recharges or spending */}
                <div className="w-full flex flex-col gap-0.5 items-center">
                  {totalSpend > 0 && (
                    <span
                      className={`text-[8px] px-1 py-0.2 rounded font-bold scale-90 leading-tight block w-full truncate text-center ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : isWithinRange
                            ? 'bg-blue-100/40 text-blue-800'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                      title={`Spend: ₹${totalSpend}`}
                    >
                      ₹{Math.round(totalSpend)}
                    </span>
                  )}
                  {totalRecharge > 0 && (
                    <span
                      className={`text-[8px] px-1 py-0.2 rounded font-bold scale-90 leading-tight block w-full truncate text-center ${
                        isSelected
                          ? 'bg-blue-800 text-white'
                          : isWithinRange
                            ? 'bg-blue-200/40 text-blue-900'
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}
                      title={`Recharged: ₹${totalRecharge}`}
                    >
                      +₹{Math.round(totalRecharge)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Calendar Aggregate / Selection Summary Section */}
        <div id="calendar-summary-card" className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${selectedStartDate ? 'bg-blue-600 animate-pulse' : 'bg-slate-400'}`}></span>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {selectedStartDate
                  ? selectedEndDate && selectedEndDate !== selectedStartDate
                    ? `Selected Range (${selectedStartDate.split('-').reverse().join('/')} – ${selectedEndDate.split('-').reverse().join('/')})`
                    : `Selected Date (${selectedStartDate.split('-').reverse().join('/')})`
                  : `${months[currentMonth]} ${currentYear} Summary`}
              </span>
            </div>
            {selectedStartDate ? (
              <button
                id="clear-calendar-filter-btn"
                onClick={handleClearFilter}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-100 transition cursor-pointer flex items-center gap-1"
              >
                <FilterX size={13} />
                <span>Clear Selection</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">
                Tap dates to inspect specific range
              </span>
            )}
          </div>

          {/* Aggregate Stat Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Total Purchases / Spent */}
            <div id="calendar-summary-purchases-card" className="bg-rose-50/50 border border-rose-100/80 rounded-2xl p-3 text-center transition">
              <div className="flex items-center justify-center gap-1 text-rose-600 mb-0.5">
                <ArrowDownRight size={13} />
                <span className="text-[10px] font-bold uppercase tracking-widest block truncate">
                  Purchases
                </span>
              </div>
              <span id="calendar-summary-purchases-amount" className="text-sm sm:text-base font-bold text-slate-900 block truncate" title={`₹${(selectedStartDate ? filteredSpendTotal : monthSpendTotal).toFixed(2)}`}>
                ₹{(selectedStartDate ? filteredSpendTotal : monthSpendTotal).toFixed(2)}
              </span>
              <span className="text-[10px] font-medium text-slate-400 block truncate mt-0.5">
                {(selectedStartDate ? filteredTransactions : monthTransactions).length} transaction{(selectedStartDate ? filteredTransactions : monthTransactions).length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Total Recharges */}
            <div id="calendar-summary-recharges-card" className="bg-blue-50/50 border border-blue-100/80 rounded-2xl p-3 text-center transition">
              <div className="flex items-center justify-center gap-1 text-blue-600 mb-0.5">
                <ArrowUpRight size={13} />
                <span className="text-[10px] font-bold uppercase tracking-widest block truncate">
                  Recharges
                </span>
              </div>
              <span id="calendar-summary-recharges-amount" className="text-sm sm:text-base font-bold text-blue-700 block truncate" title={`₹${(selectedStartDate ? filteredRechargeTotal : monthRechargeTotal).toFixed(2)}`}>
                +₹{(selectedStartDate ? filteredRechargeTotal : monthRechargeTotal).toFixed(2)}
              </span>
              <span className="text-[10px] font-medium text-slate-400 block truncate mt-0.5">
                {(selectedStartDate ? filteredRecharges : monthRecharges).length} record{(selectedStartDate ? filteredRecharges : monthRecharges).length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Net Flow / Balance Impact */}
            {(() => {
              const net = selectedStartDate ? filteredNetFlow : monthNetFlow;
              const isPositive = net >= 0;
              return (
                <div
                  id="calendar-summary-net-card"
                  className={`border rounded-2xl p-3 text-center transition ${
                    isPositive
                      ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                      : 'bg-amber-50/50 border-amber-100 text-amber-900'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 opacity-80 mb-0.5">
                    <TrendingUp size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-widest block truncate">
                      Net Flow
                    </span>
                  </div>
                  <span id="calendar-summary-net-amount" className="text-sm sm:text-base font-bold block truncate" title={`₹${net.toFixed(2)}`}>
                    {isPositive ? '+' : ''}₹{net.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-medium opacity-70 block truncate mt-0.5">
                    {isPositive ? 'Net Surplus' : 'Net Deficit'}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Quick Action: Add Purchase for selected date */}
          <button
            id="calendar-add-purchase-btn"
            onClick={() => openAddPurchaseModal(selectedStartDate || undefined)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-1"
          >
            <Plus size={15} />
            <span>
              {selectedStartDate
                ? `+ Add Purchase on ${selectedStartDate.split('-').reverse().join('/')}`
                : '+ Add Purchase on Selected Date'}
            </span>
          </button>
        </div>
      </div>

      {/* Selector: All vs Purchases vs Recharges */}
      <div className="flex border border-slate-200 rounded-2xl overflow-hidden p-1 bg-white shadow-sm">
        <button
          id="toggle-all-ledger"
          onClick={() => {
            setActiveLedger('all');
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeLedger === 'all'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-100'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <List size={14} />
          <span>All</span>
        </button>
        <button
          id="toggle-purchases-ledger"
          onClick={() => {
            setActiveLedger('purchases');
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeLedger === 'purchases'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-100'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <ArrowDownRight size={14} />
          <span>Purchase Logs</span>
        </button>
        <button
          id="toggle-recharges-ledger"
          onClick={() => {
            setActiveLedger('recharges');
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeLedger === 'recharges'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-100'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <ArrowUpRight size={14} />
          <span>Recharge History</span>
        </button>
      </div>

      {/* Date Filter Alert */}
      {selectedStartDate && (
        <div id="filter-status-alert" className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-800 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>
              {getFilterAlertLabel()}
            </span>
            <div className="flex items-center gap-2 ml-1 text-[11px] font-semibold text-slate-600">
              <span className="bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                Spent: <strong className="text-rose-600">₹{filteredSpendTotal.toFixed(2)}</strong>
              </span>
              <span className="bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                Recharged: <strong className="text-blue-600">+₹{filteredRechargeTotal.toFixed(2)}</strong>
              </span>
            </div>
          </div>
          <button
            id="clear-calendar-filter"
            onClick={handleClearFilter}
            className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer animate-fade-in self-end sm:self-auto shrink-0"
          >
            <FilterX size={14} />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* All Ledger List */}
      {activeLedger === 'all' && (
        <div className="space-y-4">
          {sortedUnifiedDates.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[32px] border border-slate-200 text-xs text-slate-400 flex flex-col items-center gap-2">
              <Info size={24} className="text-slate-300" />
              <span>No activities or recharges found matching your calendar filter.</span>
            </div>
          ) : (
            sortedUnifiedDates.map((dateStr) => {
              const dayItems = groupedUnified[dateStr];
              const daySpent = dayItems.filter((i) => i.type === 'purchase').reduce((sum, i) => sum + i.amount, 0);
              const dayRecharged = dayItems.filter((i) => i.type === 'recharge').reduce((sum, i) => sum + i.amount, 0);
              const [y, m, d] = dateStr.split('-');

              return (
                <div
                  key={dateStr}
                  id={`unified-date-group-${dateStr}`}
                  className="bg-white border border-slate-200 rounded-[32px] overflow-hidden p-6 shadow-sm space-y-3"
                >
                  {/* Date Header */}
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        {`${d}/${m}/${y}`}
                      </span>
                      <button
                        id={`add-item-unified-${dateStr}`}
                        onClick={() => openAddPurchaseModal(dateStr)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-100/80 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>Add Item</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold">
                      {daySpent > 0 && (
                        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100/50">
                          Spent: ₹{daySpent.toFixed(2)}
                        </span>
                      )}
                      {dayRecharged > 0 && (
                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/50">
                          Recharged: +₹{dayRecharged.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items inside Date Group */}
                  <div className="divide-y divide-slate-50">
                    {dayItems.map((item) => {
                      if (item.type === 'purchase') {
                        const tx = item.original as Transaction;
                        const prodInfo = getDisplayProductName(tx.ProductID);
                        const cleanName = prodInfo.name.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji_Presentation}|\p{Emoji}/gu, '').trim();

                        return (
                          <div
                            key={`${tx.TransactionID}-${tx.ProductID}`}
                            id={`tx-row-unified-${tx.TransactionID}-${tx.ProductID}`}
                            className="py-3 flex items-center justify-between text-xs animate-fade-in"
                          >
                            <div className="flex-1 pr-3">
                              <div className="flex items-center flex-wrap gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                                  <ArrowDownRight size={11} />
                                </div>
                                <span className="font-semibold text-slate-900">{cleanName}</span>
                                {prodInfo.isArchived && (
                                  <span className="inline-flex items-center bg-amber-50 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200/60">
                                    Archived
                                  </span>
                                )}
                                <span className="text-slate-400">({tx.Quantity} × ₹{tx.PriceAtTime.toFixed(2)})</span>
                                {tx.Member && (
                                  <span className="inline-flex items-center bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200">
                                    {tx.Member}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 pl-6">
                                ID: {tx.TransactionID.substring(0, 10)}...
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <span className="font-bold text-slate-900">
                                ₹{tx.TotalAmount.toFixed(2)}
                              </span>

                              {/* Actions */}
                              {txToDeleteState && txToDeleteState.TransactionID === tx.TransactionID && txToDeleteState.ProductID === tx.ProductID && txToDeleteState.Date === tx.Date ? (
                                <div className="flex items-center gap-1.5 shrink-0 animate-fade-in">
                                  <button
                                    onClick={() => {
                                      handleDeleteTx(tx);
                                      setTxToDeleteState(null);
                                    }}
                                    className="text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg text-[10px] font-bold border border-rose-200 cursor-pointer transition shrink-0"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setTxToDeleteState(null)}
                                    className="text-slate-500 bg-white hover:bg-slate-50 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 cursor-pointer transition shrink-0"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    id={`edit-tx-unified-${tx.TransactionID}-${tx.ProductID}`}
                                    onClick={() => {
                                      setTxToDeleteState(null);
                                      setEditingTx(tx);
                                      setEditingQty(tx.Quantity);
                                      setEditingDate(tx.Date);
                                      setEditingProductId(tx.ProductID);
                                      setEditingPrice(tx.PriceAtTime.toString());
                                      setEditingMember(tx.Member || '');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                                    title="Edit transaction quantity"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    id={`delete-tx-unified-${tx.TransactionID}-${tx.ProductID}`}
                                    onClick={() => setTxToDeleteState(tx)}
                                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition cursor-pointer"
                                    title="Delete transaction"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        const rec = item.original as Recharge;

                        return (
                          <div
                            key={rec.RechargeID}
                            id={`recharge-row-unified-${rec.RechargeID}`}
                            className="py-3 flex items-center justify-between text-xs animate-fade-in"
                          >
                            <div className="flex-1 pr-3">
                              <div className="flex items-center flex-wrap gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                  <ArrowUpRight size={11} />
                                </div>
                                <span className="font-semibold text-slate-900">Wallet Recharge</span>
                                {rec.Member && (
                                  <span className="inline-flex items-center bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-blue-100/50">
                                    {rec.Member}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 pl-6">
                                ID: {rec.RechargeID.substring(0, 10)}...
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-bold text-blue-600">
                                +₹{rec.Amount.toFixed(2)}
                              </span>

                              {/* Actions */}
                              {rechargeToDeleteState && rechargeToDeleteState.RechargeID === rec.RechargeID ? (
                                <div className="flex items-center gap-1.5 shrink-0 animate-fade-in">
                                  <button
                                    onClick={() => {
                                      handleDeleteRecharge(rec);
                                      setRechargeToDeleteState(null);
                                    }}
                                    className="text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg text-[10px] font-bold border border-rose-200 cursor-pointer transition shrink-0"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setRechargeToDeleteState(null)}
                                    className="text-slate-500 bg-white hover:bg-slate-50 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 cursor-pointer transition shrink-0"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    id={`edit-recharge-unified-${rec.RechargeID}`}
                                    onClick={() => {
                                      setRechargeToDeleteState(null);
                                      setEditingRecharge(rec);
                                      setEditingRechargeAmount(rec.Amount.toString());
                                      setEditingRechargeDate(rec.Date);
                                      setEditingRechargeMember(rec.Member || '');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                                    title="Edit recharge amount"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    id={`delete-recharge-unified-${rec.RechargeID}`}
                                    onClick={() => setRechargeToDeleteState(rec)}
                                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition cursor-pointer"
                                    title="Delete recharge record"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Transaction / Purchases List */}
      {activeLedger === 'purchases' && (
        <div className="space-y-4">
          {sortedTransactionDates.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[32px] border border-slate-200 text-xs text-slate-400 flex flex-col items-center gap-2">
              <Info size={24} className="text-slate-300" />
              <span>No purchases found matching your calendar filter.</span>
            </div>
          ) : (
            sortedTransactionDates.map((dateStr) => {
              const dayTxs = groupedTransactions[dateStr];
              const dayTotal = dayTxs.reduce((sum, t) => sum + t.TotalAmount, 0);
              const [y, m, d] = dateStr.split('-');

              return (
                <div
                  key={dateStr}
                  id={`purchase-date-group-${dateStr}`}
                  className="bg-white border border-slate-200 rounded-[32px] overflow-hidden p-6 shadow-sm space-y-3"
                >
                  {/* Date Header */}
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        {`${d}/${m}/${y}`}
                      </span>
                      <button
                        id={`add-item-purchase-${dateStr}`}
                        onClick={() => openAddPurchaseModal(dateStr)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-100/80 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>Add Item</span>
                      </button>
                    </div>
                    <span className="text-xs font-bold text-rose-600">
                      Spent: ₹{dayTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Items inside Date Group */}
                  <div className="divide-y divide-slate-50">
                    {dayTxs.map((tx) => {
                      const prodInfo = getDisplayProductName(tx.ProductID);
                      const cleanName = prodInfo.name.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji_Presentation}|\p{Emoji}/gu, '').trim();

                      return (
                        <div
                          key={`${tx.TransactionID}-${tx.ProductID}`}
                          id={`tx-row-${tx.TransactionID}-${tx.ProductID}`}
                          className="py-3 flex items-center justify-between text-xs"
                        >
                          <div className="flex-1 pr-3">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="font-semibold text-slate-900">{cleanName}</span>
                              {prodInfo.isArchived && (
                                <span className="inline-flex items-center bg-amber-50 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200/60">
                                  Archived
                                </span>
                              )}
                              <span className="text-slate-400">({tx.Quantity} × ₹{tx.PriceAtTime.toFixed(2)})</span>
                              {tx.Member && (
                                <span className="inline-flex items-center bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200">
                                  {tx.Member}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              ID: {tx.TransactionID.substring(0, 10)}...
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="font-bold text-slate-900">
                              ₹{tx.TotalAmount.toFixed(2)}
                            </span>

                            {/* Actions */}
                            {txToDeleteState && txToDeleteState.TransactionID === tx.TransactionID && txToDeleteState.ProductID === tx.ProductID && txToDeleteState.Date === tx.Date ? (
                              <div className="flex items-center gap-1.5 shrink-0 animate-fade-in">
                                <button
                                  onClick={() => {
                                    handleDeleteTx(tx);
                                    setTxToDeleteState(null);
                                  }}
                                  className="text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg text-[10px] font-bold border border-rose-200 cursor-pointer transition shrink-0"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setTxToDeleteState(null)}
                                  className="text-slate-500 bg-white hover:bg-slate-50 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 cursor-pointer transition shrink-0"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  id={`edit-tx-${tx.TransactionID}-${tx.ProductID}`}
                                  onClick={() => {
                                    setTxToDeleteState(null);
                                    setEditingTx(tx);
                                    setEditingQty(tx.Quantity);
                                    setEditingDate(tx.Date);
                                    setEditingProductId(tx.ProductID);
                                    setEditingPrice(tx.PriceAtTime.toString());
                                    setEditingMember(tx.Member || '');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                                  title="Edit transaction quantity"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  id={`delete-tx-${tx.TransactionID}-${tx.ProductID}`}
                                  onClick={() => setTxToDeleteState(tx)}
                                  className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition cursor-pointer"
                                  title="Delete transaction"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Recharge Ledger List */}
      {activeLedger === 'recharges' && (
        <div className="space-y-4">
          {sortedRecharges.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[32px] border border-slate-200 text-xs text-slate-400 flex flex-col items-center gap-2">
              <Info size={24} className="text-slate-300" />
              <span>No recharge records found matching your calendar filter.</span>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm divide-y divide-slate-100">
              {sortedRecharges.map((rec) => {
                const [y, m, d] = rec.Date.split('-');
                return (
                  <div
                    key={rec.RechargeID}
                    id={`recharge-row-${rec.RechargeID}`}
                    className="py-3.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <ArrowUpRight size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">Wallet Recharge</span>
                          {rec.Member && (
                            <span className="inline-flex items-center bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-blue-100/50">
                              {rec.Member}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {`${d}/${m}/${y}`} • ID: {rec.RechargeID.substring(0, 10)}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-blue-600">
                        +₹{rec.Amount.toFixed(2)}
                      </span>

                      {/* Actions */}
                      {rechargeToDeleteState && rechargeToDeleteState.RechargeID === rec.RechargeID ? (
                        <div className="flex items-center gap-1.5 shrink-0 animate-fade-in">
                          <button
                            onClick={() => {
                              handleDeleteRecharge(rec);
                              setRechargeToDeleteState(null);
                            }}
                            className="text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg text-[10px] font-bold border border-rose-200 cursor-pointer transition shrink-0"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setRechargeToDeleteState(null)}
                            className="text-slate-500 bg-white hover:bg-slate-50 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 cursor-pointer transition shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            id={`edit-recharge-${rec.RechargeID}`}
                            onClick={() => {
                              setRechargeToDeleteState(null);
                              setEditingRecharge(rec);
                              setEditingRechargeAmount(rec.Amount.toString());
                              setEditingRechargeDate(rec.Date);
                              setEditingRechargeMember(rec.Member || '');
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                            title="Edit recharge amount"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            id={`delete-recharge-${rec.RechargeID}`}
                            onClick={() => setRechargeToDeleteState(rec)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition cursor-pointer"
                            title="Delete recharge record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Transaction Modal overlay */}
      {editingTx && (
        <div id="edit-tx-modal-overlay" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="edit-tx-modal-content" className="w-full max-w-sm bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">Edit Purchase</h3>
              <button onClick={() => setEditingTx(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {editError && (
                <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-medium border border-rose-100">
                  {editError}
                </div>
              )}

              {/* Product Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Product / Item
                </label>
                <select
                  id="edit-tx-product-select"
                  value={editingProductId}
                  onChange={(e) => {
                    const newProdId = e.target.value;
                    setEditingProductId(newProdId);
                    const selectedProd = products.find((p) => p.ProductID === newProdId);
                    if (selectedProd) {
                      setEditingPrice(selectedProd.Price.toString());
                    }
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-800 bg-slate-50 cursor-pointer"
                >
                  {!products.some((p) => p.ProductID === editingProductId) && editingProductId && (
                    <option value={editingProductId}>
                      {getDisplayProductName(editingProductId).name} (Archived / Legacy ID: {editingProductId})
                    </option>
                  )}
                  {products.map((p) => (
                    <option key={p.ProductID} value={p.ProductID}>
                      {p.ProductName} (Default: ₹{p.Price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Price per Unit (₹)
                </label>
                <input
                  id="edit-tx-price-input"
                  type="number"
                  step="any"
                  value={editingPrice}
                  onChange={(e) => setEditingPrice(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-800 bg-slate-50"
                />
              </div>

              {/* Quantity Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Quantity
                </label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-1 justify-between max-w-[140px]">
                  <button
                    onClick={() => setEditingQty((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 font-bold border border-slate-200 cursor-pointer"
                  >
                    -
                  </button>
                  <span id="edit-tx-qty-display" className="text-sm font-semibold text-slate-950">{editingQty}</span>
                  <button
                    onClick={() => setEditingQty((q) => q + 1)}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 font-bold border border-slate-200 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Assigned Member dropdown */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Assigned Profile
                </label>
                <select
                  id="edit-tx-member-select"
                  value={editingMember}
                  onChange={(e) => setEditingMember(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-800 bg-slate-50 cursor-pointer"
                >
                  {members.map((m) => (
                    <option key={m.Name} value={m.Name}>
                      {m.Name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Delivery Date
                </label>
                <input
                  id="edit-tx-date-input"
                  type="date"
                  value={editingDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEditingDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-800 bg-slate-50 cursor-pointer"
                />
              </div>

              {/* Live Calculations Summary Card */}
              <div className="bg-blue-50/50 p-4 rounded-2xl text-xs space-y-1 border border-blue-100/30">
                <div className="flex justify-between">
                  <span className="text-slate-500">Calculated Total:</span>
                  <span className="font-bold text-blue-600 text-sm">
                    ₹{((editingQty || 0) * (parseFloat(editingPrice) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Add another product to date button */}
              <button
                type="button"
                id="edit-modal-add-another-prod-btn"
                onClick={() => {
                  const targetD = editingDate || editingTx.Date;
                  setEditingTx(null);
                  openAddPurchaseModal(targetD);
                }}
                className="w-full text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl py-2 px-3 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} />
                <span>Add another product on {editingDate ? editingDate.split('-').reverse().join('/') : editingTx.Date.split('-').reverse().join('/')}</span>
              </button>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditingTx(null)}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="save-tx-edit-btn"
                  onClick={handleSaveTxEdit}
                  disabled={editLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  {editLoading ? <Loader2 className="animate-spin" size={13} /> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recharge Modal overlay */}
      {editingRecharge && (
        <div id="edit-recharge-modal-overlay" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="edit-recharge-modal-content" className="w-full max-w-sm bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">Edit Recharge</h3>
              <button onClick={() => setEditingRecharge(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {editError && (
                <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-medium border border-rose-100">
                  {editError}
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Recharge Amount (₹)
                </label>
                <input
                  id="edit-recharge-amount-input"
                  type="number"
                  step="any"
                  value={editingRechargeAmount}
                  onChange={(e) => setEditingRechargeAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-blue-600 text-blue-600 bg-slate-50"
                />
              </div>

              {/* Assigned Member dropdown */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Assigned Profile
                </label>
                <select
                  id="edit-recharge-member-select"
                  value={editingRechargeMember}
                  onChange={(e) => setEditingRechargeMember(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-800 bg-slate-50 cursor-pointer"
                >
                  {members.map((m) => (
                    <option key={m.Name} value={m.Name}>
                      {m.Name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Recharge Date
                </label>
                <input
                  id="edit-recharge-date-input"
                  type="date"
                  value={editingRechargeDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEditingRechargeDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-800 bg-slate-50 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditingRecharge(null)}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="save-recharge-edit-btn"
                  onClick={handleSaveRechargeEdit}
                  disabled={editLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  {editLoading ? <Loader2 className="animate-spin" size={13} /> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Products to Specific Date Modal Overlay */}
      {addModalOpen && (
        <div id="add-tx-date-modal-overlay" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="add-tx-date-modal-content" className="w-full max-w-md bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Add Products to Order</h3>
                <p className="text-[11px] text-slate-400">Add forgotten items or new purchases to a specific date</p>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-full hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {addModalError && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl text-xs font-medium border border-rose-100">
                  {addModalError}
                </div>
              )}

              {/* Target Date Input & Profile Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Order Date
                  </label>
                  <input
                    id="add-tx-date-input"
                    type="date"
                    value={addModalDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setAddModalDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-600 text-slate-800 bg-slate-50 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Log For Member
                  </label>
                  <select
                    id="add-tx-member-select"
                    value={addModalMember}
                    onChange={(e) => setAddModalMember(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-600 text-slate-800 bg-slate-50 cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.Name} value={m.Name}>
                        {m.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Selection List */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Select Products & Quantities
                </label>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {products.map((p) => {
                    const qty = addModalQuantities[p.ProductID] || 0;
                    return (
                      <div
                        key={p.ProductID}
                        id={`add-prod-card-${p.ProductID}`}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                          qty > 0
                            ? 'bg-blue-50/40 border-blue-200/80 shadow-2xs'
                            : 'bg-slate-50/50 border-slate-200/60'
                        }`}
                      >
                        <div className="flex-1 pr-2 min-w-0">
                          <div className="font-semibold text-slate-900 text-xs truncate">
                            {p.ProductName}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            ₹{p.Price.toFixed(2)} / {p.Unit}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl p-1 shadow-2xs shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setAddModalQuantities((prev) => ({
                                ...prev,
                                [p.ProductID]: Math.max(0, (prev[p.ProductID] || 0) - 1),
                              }))
                            }
                            disabled={qty <= 0}
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-30 text-slate-700 font-bold flex items-center justify-center cursor-pointer transition text-xs"
                          >
                            -
                          </button>
                          <span
                            className={`w-6 text-center text-xs font-bold ${
                              qty > 0 ? 'text-blue-600 font-extrabold' : 'text-slate-400'
                            }`}
                          >
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAddModalQuantities((prev) => ({
                                ...prev,
                                [p.ProductID]: (prev[p.ProductID] || 0) + 1,
                              }))
                            }
                            className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold flex items-center justify-center cursor-pointer transition text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calculations summary */}
              {(() => {
                const totalItems = Object.values(addModalQuantities).reduce((a: number, b) => a + (b as number), 0);
                const totalCost = Object.entries(addModalQuantities).reduce((sum, [pId, q]) => {
                  const prod = products.find((p) => p.ProductID === pId);
                  return sum + (prod ? prod.Price * (q as number) : 0);
                }, 0);

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider">Total Selected</span>
                      <span className="font-bold text-slate-800">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider">Total Amount</span>
                      <span className="font-bold text-rose-600 text-sm">₹{totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 py-2.5 px-3 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                id="submit-add-purchase-btn"
                onClick={handleSaveAddPurchase}
                disabled={addModalLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                {addModalLoading ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <span>Log Purchase ({addModalDate ? addModalDate.split('-').reverse().join('/') : ''})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
