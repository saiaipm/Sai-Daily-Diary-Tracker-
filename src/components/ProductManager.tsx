import React, { useState } from 'react';
import { Product } from '../types';
import { ShoppingBag, Plus, Edit2, Check, X, Loader2, Info, ArrowRight, Grid, List } from 'lucide-react';
import ProductIcon, { cleanProductName } from './ProductIcon';

interface ProductManagerProps {
  products: Product[];
  onUpdateProducts: (updated: Product[]) => Promise<void>;
}

export default function ProductManager({
  products,
  onUpdateProducts,
}: ProductManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Form states for adding product
  const [newProductName, setNewProductName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Form states for editing product
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);

  // Handle Add Product Submission
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const name = newProductName.trim();
    const priceNum = parseFloat(newPrice);
    const unit = newUnit.trim();

    if (!name || isNaN(priceNum) || priceNum <= 0 || !unit) {
      setAddError('All fields are required. Price must be a valid number greater than 0.');
      return;
    }

    setAddLoading(true);
    try {
      const newId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      const newProduct: Product = {
        ProductID: newId,
        ProductName: name,
        Price: priceNum,
        Unit: unit,
      };

      const updatedProducts = [...products, newProduct];
      await onUpdateProducts(updatedProducts);

      // Clear form
      setNewProductName('');
      setNewPrice('');
      setNewUnit('');
      setIsAdding(false);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add product.');
    } finally {
      setAddLoading(false);
    }
  };

  // Start Edit Mode
  const startEdit = (product: Product) => {
    setEditingId(product.ProductID);
    setEditName(product.ProductName);
    setEditPrice(product.Price.toString());
    setEditUnit(product.Unit);
    setEditError(null);
  };

  // Save Product Changes
  const handleSaveEdit = async () => {
    const name = editName.trim();
    const priceNum = parseFloat(editPrice);
    const unit = editUnit.trim();

    if (!name || isNaN(priceNum) || priceNum <= 0 || !unit) {
      setEditError('Fields cannot be empty. Price must be a positive number.');
      return;
    }

    setEditLoading(true);
    try {
      const updatedProducts = products.map((p) => {
        if (p.ProductID === editingId) {
          return {
            ...p,
            ProductName: name,
            Price: priceNum,
            Unit: unit,
          };
        }
        return p;
      });

      await onUpdateProducts(updatedProducts);
      setEditingId(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to save edits.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div id="products-tab-content" className="space-y-6 pb-24 animate-fade-in">
      {/* Tab Header with toggle to add product */}
      <div className="flex justify-between items-center bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <ShoppingBag size={20} className="text-blue-600 stroke-[2.2px]" />
          <div>
            <h3 className="font-bold text-sm text-slate-900 tracking-tight">Dairy Directory</h3>
            <span className="text-[10px] text-slate-400 font-semibold">{products.length} Items Configured</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Layout viewMode toggle buttons */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200/60 shrink-0">
            <button
              id="view-mode-grid"
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid View"
            >
              <Grid size={13} />
            </button>
            <button
              id="view-mode-list"
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="List View"
            >
              <List size={13} />
            </button>
          </div>

          <button
            id="toggle-add-product-panel"
            onClick={() => setIsAdding(!isAdding)}
            className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              isAdding
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isAdding ? (
              <>
                <X size={14} />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Plus size={14} />
                <span>Add Product</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Product Panel */}
      {isAdding && (
        <form
          id="add-product-form"
          onSubmit={handleAddProduct}
          className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm space-y-4 animate-slide-up"
        >
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Create Custom Product
          </h4>

          {addError && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-medium border-l-4 border-rose-500">
              {addError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Product Name
              </label>
              <input
                id="new-product-name"
                type="text"
                placeholder="e.g., Paneer, Organic Cow Milk"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-slate-50 placeholder-slate-300"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Unit Description
              </label>
              <input
                id="new-product-unit"
                type="text"
                placeholder="e.g., 200g tub, 1L packet"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-slate-50 placeholder-slate-300"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Unit Price (₹)
              </label>
              <input
                id="new-product-price"
                type="number"
                step="any"
                placeholder="0.00"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-slate-50 placeholder-slate-300"
              />
            </div>
          </div>

          <button
            id="submit-add-product"
            type="submit"
            disabled={addLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm"
          >
            {addLoading ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                <span>Saving to Google Sheet...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Save New Product</span>
              </>
            )}
          </button>
        </form>
      )}

      {viewMode === 'list' ? (
        <div id="product-list-container" className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16">Icon</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product Name</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unit</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Price</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const isEditing = editingId === product.ProductID;
                  return (
                    <tr
                      key={product.ProductID}
                      id={`product-row-list-${product.ProductID}`}
                      className="hover:bg-slate-50/30 transition group"
                    >
                      <td className="py-4 px-6">
                        <ProductIcon name={product.ProductName} size={18} className="shadow-sm w-10 h-10 rounded-xl" />
                      </td>
                      <td className="py-4 px-6">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full max-w-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:border-blue-600"
                              placeholder="Product name"
                            />
                            {editError && <div className="text-[10px] font-bold text-rose-600">{editError}</div>}
                          </div>
                        ) : (
                          <div className="font-bold text-slate-900 text-sm break-words max-w-md leading-snug">
                            {cleanProductName(product.ProductName)}
                          </div>
                        )}
                        <span className="text-[9px] font-mono text-slate-400 mt-1 block">ID: {product.ProductID}</span>
                      </td>
                      <td className="py-4 px-6">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                            className="w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:border-blue-600"
                            placeholder="Unit (e.g. 1L)"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {product.Unit}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              step="any"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-20 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:border-blue-600"
                              placeholder="Price"
                            />
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-blue-600">
                            ₹{product.Price.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingId(null)}
                              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 py-1.5 px-2.5 rounded-lg text-[10px] font-bold cursor-pointer transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              disabled={editLoading}
                              className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                            >
                              {editLoading ? <Loader2 className="animate-spin" size={10} /> : 'Save'}
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`edit-prod-list-btn-${product.ProductID}`}
                            onClick={() => startEdit(product)}
                            className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer hover:underline text-xs"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Product List Grid */
        <div id="product-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
          {products.map((product) => {
            const isEditing = editingId === product.ProductID;

            return (
              <div
                key={product.ProductID}
                id={`product-card-${product.ProductID}`}
                className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm space-y-4 flex flex-col justify-between"
              >
                {isEditing ? (
                  // Editing state form
                  <div className="space-y-3 flex-1">
                    <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Edit Product Details
                      </span>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {editError && (
                      <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold rounded-lg">
                        {editError}
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                          Name
                        </label>
                        <input
                          id={`edit-prod-name-${product.ProductID}`}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-slate-50"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                            Unit
                          </label>
                          <input
                            id={`edit-prod-unit-${product.ProductID}`}
                            type="text"
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                            Price (₹)
                          </label>
                          <input
                            id={`edit-prod-price-${product.ProductID}`}
                            type="number"
                            step="any"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-slate-50"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 py-1.5 px-2 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        id={`save-prod-edit-${product.ProductID}`}
                        onClick={handleSaveEdit}
                        disabled={editLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {editLoading ? <Loader2 className="animate-spin" size={10} /> : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Normal state view
                  <>
                    <div className="flex-1 flex gap-4 items-start min-w-0">
                      <ProductIcon name={product.ProductName} size={20} className="shadow-sm w-12 h-12 rounded-2xl shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="font-bold text-sm text-slate-900 break-words leading-snug">
                          {cleanProductName(product.ProductName)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full shrink-0 uppercase tracking-widest">
                            {product.Unit}
                          </span>
                          <span className="text-slate-300 select-none">•</span>
                          <div className="text-xs font-bold text-blue-600">
                            ₹{product.Price.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ unit</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                      <span className="truncate max-w-[120px] font-mono">ID: {product.ProductID}</span>
                      <button
                        id={`edit-prod-btn-${product.ProductID}`}
                        onClick={() => startEdit(product)}
                        className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 cursor-pointer hover:underline"
                      >
                        <Edit2 size={11} />
                        <span>Modify</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50/50 border border-blue-100 rounded-[32px] p-6 flex items-start gap-3.5">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-500 leading-relaxed">
          <span className="font-bold text-slate-900">Google Sheets Sync:</span> Adding or updating products modifies the `Products` worksheet immediately. Changes to prices will only apply to future checkouts; previous transactions preserve their historical prices to maintain balance integrity.
        </div>
      </div>
    </div>
  );
}
