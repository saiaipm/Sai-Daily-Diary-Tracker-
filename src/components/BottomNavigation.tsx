import React from 'react';
import { LayoutDashboard, History, ShoppingBag, LogOut } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: 'dashboard' | 'history' | 'products';
  onChangeTab: (tab: 'dashboard' | 'history' | 'products') => void;
  onLogout: () => void;
  userEmail: string;
}

export default function BottomNavigation({
  activeTab,
  onChangeTab,
  onLogout,
  userEmail,
}: BottomNavigationProps) {
  return (
    <nav id="bottom-nav" className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg px-6 py-2.5 z-40 flex justify-between items-center max-w-lg mx-auto rounded-t-3xl md:px-12">
      <button
        id="nav-tab-dashboard"
        onClick={() => onChangeTab('dashboard')}
        className={`flex flex-col items-center gap-1 transition-all py-1.5 px-3 rounded-2xl cursor-pointer ${
          activeTab === 'dashboard'
            ? 'text-blue-600 font-semibold scale-105 bg-blue-50/70'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <LayoutDashboard size={20} className={activeTab === 'dashboard' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
        <span className="text-[10px] tracking-wider">Dashboard</span>
      </button>

      <button
        id="nav-tab-history"
        onClick={() => onChangeTab('history')}
        className={`flex flex-col items-center gap-1 transition-all py-1.5 px-3 rounded-2xl cursor-pointer ${
          activeTab === 'history'
            ? 'text-blue-600 font-semibold scale-105 bg-blue-50/70'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <History size={20} className={activeTab === 'history' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
        <span className="text-[10px] tracking-wider">History</span>
      </button>

      <button
        id="nav-tab-products"
        onClick={() => onChangeTab('products')}
        className={`flex flex-col items-center gap-1 transition-all py-1.5 px-3 rounded-2xl cursor-pointer ${
          activeTab === 'products'
            ? 'text-blue-600 font-semibold scale-105 bg-blue-50/70'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <ShoppingBag size={20} className={activeTab === 'products' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
        <span className="text-[10px] tracking-wider">Products</span>
      </button>

      <button
        id="nav-logout-btn"
        onClick={onLogout}
        title={`Sign out (${userEmail})`}
        className="flex flex-col items-center gap-1 text-rose-500 hover:text-rose-700 transition-all py-1.5 px-3 rounded-2xl cursor-pointer"
      >
        <LogOut size={20} className="stroke-[1.8px]" />
        <span className="text-[10px] tracking-wider">Sign Out</span>
      </button>
    </nav>
  );
}
