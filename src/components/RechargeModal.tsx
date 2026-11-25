import React, { useState } from 'react';
import { Wallet, X, Calendar, Loader2, ArrowUpRight } from 'lucide-react';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmRecharge: (amount: number, date: string) => Promise<void>;
  activeMember: string;
}

export default function RechargeModal({
  isOpen,
  onClose,
  onConfirmRecharge,
  activeMember,
}: RechargeModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickAmounts = [200, 500, 1000, 2000];

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid recharge amount greater than 0.');
      return;
    }

    setLoading(true);
    try {
      await onConfirmRecharge(numericAmount, date);
      setAmount('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record recharge. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="recharge-modal-overlay" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-4 transition-all">
      <div id="recharge-modal-content" className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-blue-600">
            <Wallet size={22} className="stroke-[2.5px]" />
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Recharge Wallet</h2>
          </div>
          <button
            id="close-recharge-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Active Profile Info */}
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-2.5 flex items-center justify-between text-xs text-blue-800 font-semibold">
          <span>Adding recharge funds for member:</span>
          <span className="bg-white border border-blue-200 rounded-lg px-2 py-0.5 font-bold">👤 {activeMember}</span>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConfirm} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-xs text-rose-800 font-medium">
              {error}
            </div>
          )}

          {/* Date Picker */}
          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <Calendar size={18} className="text-slate-400" />
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Recharge Date
              </label>
              <input
                id="recharge-date-picker"
                type="date"
                value={date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full bg-transparent border-none text-sm font-semibold text-slate-800 focus:outline-none p-0 mt-0.5 cursor-pointer"
              />
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
              Recharge Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-slate-400">₹</span>
              <input
                id="recharge-amount-input"
                type="number"
                placeholder="0.00"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl pl-10 pr-4 py-4 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-blue-600 bg-slate-50 placeholder-slate-300"
                autoFocus
              />
            </div>
          </div>

          {/* Quick Pack buttons */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
              Quick Packs
            </label>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  id={`quick-recharge-${q}`}
                  type="button"
                  onClick={() => setAmount(q.toString())}
                  className="py-2.5 px-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl transition flex items-center justify-center gap-0.5 cursor-pointer"
                >
                  <span>+</span>
                  <span>₹{q}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              id="cancel-recharge-btn"
              type="button"
              onClick={onClose}
              className="flex-1 bg-white hover:bg-slate-100 text-slate-500 font-semibold py-3 px-4 rounded-xl border border-slate-200 transition text-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-recharge-btn"
              type="submit"
              disabled={loading || !amount}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight size={16} />
                  <span>Add Funds</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
