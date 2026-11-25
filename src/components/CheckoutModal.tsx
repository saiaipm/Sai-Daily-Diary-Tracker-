import React, { useState } from 'react';
import { Product } from '../types';
import { ShoppingCart, Plus, Minus, X, AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import ProductIcon, { cleanProductName } from './ProductIcon';

interface CheckoutModalProps {
  products: Product[];
  currentBalance: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCheckout: (items: { ProductID: string; Quantity: number }[], date: string) => Promise<void>;
  activeMember: string;
  initialProductId?: string | null;
}

export default function CheckoutModal({
  products,
  currentBalance,
  isOpen,
  onClose,
  onConfirmCheckout,
  activeMember,
  initialProductId,
}: CheckoutModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmStep, setShowConfirmStep] = useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setShowConfirmStep(false);
      setQuantities({});
      setError(null);
    } else if (initialProductId) {
      setQuantities({ [initialProductId]: 1 });
    }
  }, [isOpen, initialProductId]);

  if (!isOpen) return null;

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const selectedItems = Object.entries(quantities)
    .filter(([_, qty]) => Number(qty) > 0)
    .map(([id, qty]) => {
      const product = products.find((p) => p.ProductID === id);
      return {
        ProductID: id,
        Quantity: qty,
        product,
      };
    })
    .filter((item) => item.product !== undefined) as {
    ProductID: string;
    Quantity: number;
    product: Product;
  }[];

  const totalAmount = selectedItems.reduce(
    (sum, item) => sum + item.product.Price * item.Quantity,
    0
  );

  const isOverBalance = totalAmount > currentBalance;

  const handleConfirm = async () => {
    if (selectedItems.length === 0) {
      setError('Please add at least one item to your checkout.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const itemsToSubmit = selectedItems.map((item) => ({
        ProductID: item.ProductID,
        Quantity: item.Quantity,
      }));
      await onConfirmCheckout(itemsToSubmit, date);
      setQuantities({});
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="checkout-modal-overlay" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-4 transition-all">
      <div id="checkout-modal-content" className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-blue-600">
            <ShoppingCart size={22} className="stroke-[2.5px]" />
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Log Purchases</h2>
          </div>
          <button
            id="close-checkout-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Active Profile Info */}
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-2.5 flex items-center justify-between text-xs text-blue-800 font-semibold">
          <span>Logging items for family member:</span>
          <span className="bg-white border border-blue-200 rounded-lg px-2 py-0.5 font-bold">👤 {activeMember}</span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
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
                Purchase Date
              </label>
              <input
                id="checkout-date-picker"
                type="date"
                value={date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full bg-transparent border-none text-sm font-semibold text-slate-800 focus:outline-none p-0 mt-0.5 cursor-pointer"
              />
            </div>
          </div>

          {/* Product Picker List */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Select Dairy Items
            </h3>
            {products.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-400">
                No products configured. Add products first!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {products.map((product) => {
                  const qty = quantities[product.ProductID] || 0;
                  return (
                    <div
                      key={product.ProductID}
                      id={`product-row-${product.ProductID}`}
                      className="py-3 flex items-center justify-between"
                    >
                      <div className="flex-1 pr-3 flex gap-3 items-center min-w-0">
                        <ProductIcon name={product.ProductName} size={16} className="w-8 h-8 rounded-xl shadow-sm bg-slate-50 border border-slate-100 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 text-sm truncate">
                            {cleanProductName(product.ProductName)}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            ₹{product.Price.toFixed(2)} / {product.Unit}
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-1">
                        <button
                          id={`qty-minus-${product.ProductID}`}
                          onClick={() => handleUpdateQuantity(product.ProductID, -1)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                            qty > 0
                              ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-sm font-bold'
                              : 'text-slate-300 cursor-not-allowed'
                          }`}
                          disabled={qty === 0}
                        >
                          <Minus size={14} />
                        </button>
                        <span
                          id={`qty-display-${product.ProductID}`}
                          className={`w-6 text-center text-sm font-bold ${
                            qty > 0 ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        >
                          {qty}
                        </span>
                        <button
                          id={`qty-plus-${product.ProductID}`}
                          onClick={() => handleUpdateQuantity(product.ProductID, 1)}
                          className="w-7 h-7 rounded-lg bg-white text-blue-600 hover:bg-blue-50 shadow-sm font-bold flex items-center justify-center transition cursor-pointer"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart Summary & Action Drawer */}
        <div className="bg-slate-50 border-t border-slate-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Total Spend</span>
            <span id="checkout-total-price" className="text-2xl font-bold text-slate-900">
              ₹{totalAmount.toFixed(2)}
            </span>
          </div>

          {isOverBalance && totalAmount > 0 && (
            <div id="balance-warning" className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
              <div>
                <span className="font-semibold">Insufficient Balance:</span> This purchase of ₹
                {totalAmount.toFixed(2)} exceeds your current wallet balance of ₹
                {currentBalance.toFixed(2)}. (Logged for tracking)
              </div>
            </div>
          )}

          {showConfirmStep ? (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-800">
                <AlertTriangle className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="font-semibold block">Accident-Proof Logging Confirmation:</span>
                  <span className="mt-0.5 block">
                    Are you sure you want to log these {selectedItems.length} items (Total ₹{totalAmount.toFixed(2)}) under <span className="font-bold">{activeMember}</span>?
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmStep(false)}
                  disabled={loading}
                  className="flex-1 bg-white hover:bg-slate-100 text-slate-500 font-semibold py-3 px-4 rounded-xl border border-slate-200 transition text-center cursor-pointer text-xs"
                >
                  No, Edit List
                </button>
                <button
                  id="confirm-checkout-btn-final"
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Saving to Sheet...</span>
                    </>
                  ) : (
                    <span>Yes, Log Purchase ✓</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                id="cancel-checkout-btn"
                onClick={onClose}
                className="flex-1 bg-white hover:bg-slate-100 text-slate-500 font-semibold py-3 px-4 rounded-xl border border-slate-200 transition text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-checkout-btn"
                onClick={() => setShowConfirmStep(true)}
                disabled={loading || totalAmount === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                Log Purchase
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
