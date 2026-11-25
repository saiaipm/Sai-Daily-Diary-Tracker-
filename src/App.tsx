import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AuthUser,
  initAuth,
  googleSignIn,
  googleGisSignIn,
  isEmbeddedIframe,
  isGisReady,
  logout,
} from './lib/firebase';
import {
  fetchSpreadsheetData,
  appendTransactions,
  appendRecharge,
  saveProducts,
  saveTransactions,
  saveRecharges,
  saveMembers,
  verifySpreadsheet,
} from './lib/googleSheets';
import { Product, Transaction, Recharge, DashboardMetrics, FamilyMember } from './types';

// Components
import ConnectSheetModal from './components/ConnectSheetModal';
import BottomNavigation from './components/BottomNavigation';
import Dashboard from './components/Dashboard';
import TransactionHistory from './components/TransactionHistory';
import ProductManager from './components/ProductManager';
import CheckoutModal from './components/CheckoutModal';
import RechargeModal from './components/RechargeModal';
import ProfileDrawer from './components/ProfileDrawer';

// Icons
import { Milk, Loader2, RefreshCw, AlertCircle, Sparkles, Users, UserPlus, Trash2, X, Plus, Menu, Copy, Check, ExternalLink, Info } from 'lucide-react';

export default function App() {
  // Authentication & Connection states
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(() => {
    const cached = localStorage.getItem('dairy_sheet_id');
    if (cached === 'disconnected') {
      return null;
    }
    return cached || '1ZAqXo28GKDNUTyMyDz3erqJgsD_skKEv_RrRuuNHub8';
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toast notifications state
  interface ToastItem {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedDomainShared, setCopiedDomainShared] = useState(false);

  const handleCopyDomain = (domain: string) => {
    navigator.clipboard.writeText(domain);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2000);
  };

  const handleCopySharedDomain = (domain: string) => {
    navigator.clipboard.writeText(domain);
    setCopiedDomainShared(true);
    setTimeout(() => setCopiedDomainShared(false), 2000);
  };

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'products'>('dashboard');

  // Database State
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recharges, setRecharges] = useState<Recharge[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);

  // Active Family member profile (the actor)
  const [activeMember, setActiveMember] = useState<string>(() => {
    return localStorage.getItem('dairy_active_member') || 'Dad 👨';
  });

  // Selected filter on dashboard (All vs Specific Member)
  const [selectedFilter, setSelectedFilter] = useState<string>('All');

  // Modal/Drawer open states
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutInitialProductId, setCheckoutInitialProductId] = useState<string | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [familyManagerOpen, setFamilyManagerOpen] = useState(false);

  // New family member inputs
  const [newMemberName, setNewMemberName] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);

  // Initialize Auth on Mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setAuthLoading(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Database Data when token & sheetId are available
  useEffect(() => {
    if (token && sheetId) {
      loadSheetData();
    }
  }, [token, sheetId]);

  // Handle Sheet connection and caching
  const handleSheetConnected = async (id: string) => {
    if (!token) return;
    setDataLoading(true);
    setError(null);
    try {
      const isValid = await verifySpreadsheet(token, id);
      if (!isValid) {
        throw new Error(
          'This sheet does not appear to have the correct tabs ("Products", "Transactions", "Recharges"). Ensure you pasted the correct Sheet ID.'
        );
      }
      localStorage.setItem('dairy_sheet_id', id);
      setSheetId(id);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to sheet.');
    } finally {
      setDataLoading(false);
    }
  };

  const handleDisconnectSheet = () => {
    localStorage.setItem('dairy_sheet_id', 'disconnected');
    setSheetId(null);
    setProducts([]);
    setTransactions([]);
    setRecharges([]);
    setError(null);
    showToast('Disconnected from Google Sheet', 'info');
  };

  const loadSheetData = async () => {
    if (!token || !sheetId) return;
    setDataLoading(true);
    setError(null);
    try {
      const data = await fetchSpreadsheetData(token, sheetId);
      setProducts(data.products);
      setTransactions(data.transactions);
      setRecharges(data.recharges);
      setMembers(data.members);

      // Verify currently active member profile
      if (data.members.length > 0) {
        const exists = data.members.some((m) => m.Name === activeMember);
        if (!exists) {
          const firstMember = data.members[0].Name;
          setActiveMember(firstMember);
          localStorage.setItem('dairy_active_member', firstMember);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        // Access token expired, trigger re-login
        handleLogout();
        setError('Your Google session has expired. Please sign in again.');
      } else {
        setError(
          `Failed to load data from your Google Sheet. Please check your internet connection or verify the sheet's status. Error: ${err.message}`
        );
      }
    } finally {
      setDataLoading(false);
    }
  };

  // Google Login click handler (Firebase Auth popup)
  const handleLogin = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setError(null);
    setAuthErrorCode(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setAuthErrorCode(err?.code || null);
      setError(err?.message || 'Login failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  // Direct Google Identity Services (GIS) login handler (bypasses Firebase iframe relay)
  const handleGisLogin = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setError(null);
    setAuthErrorCode(null);
    try {
      const result = await googleGisSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setAuthErrorCode(err?.code || null);
      setError(err?.message || 'Direct Google Sign-In failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setAuthErrorCode(null);
      // Keep sheet ID cached in localStorage so they don't have to re-enter it on re-login
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // 1. Transaction Checkout Operations
  const handleConfirmCheckout = async (
    items: { ProductID: string; Quantity: number }[],
    purchaseDate: string,
    overrideMember?: string
  ) => {
    if (!token || !sheetId) return;
    setSyncing(true);
    const memberToUse = overrideMember || activeMember;
    try {
      // Map quantities with the actual product prices at THIS moment in time
      const transactionItems = items.map((item) => {
        const prod = products.find((p) => p.ProductID === item.ProductID);
        if (!prod) throw new Error(`Product not found: ${item.ProductID}`);
        return {
          Date: purchaseDate,
          ProductID: item.ProductID,
          Quantity: item.Quantity,
          PriceAtTime: prod.Price,
          Member: memberToUse, // Tag with selected profile
        };
      });

      // Optimistic state updates
      const tempId = `tx_temp_${Date.now()}`;
      const newLocalTxs: Transaction[] = transactionItems.map((item) => ({
        TransactionID: tempId,
        Date: item.Date,
        ProductID: item.ProductID,
        Quantity: item.Quantity,
        PriceAtTime: item.PriceAtTime,
        TotalAmount: item.Quantity * item.PriceAtTime,
        Member: memberToUse,
      }));

      setTransactions((prev) => [...prev, ...newLocalTxs]);

      // Push to Google Sheets API
      const realId = await appendTransactions(token, sheetId, transactionItems);

      // Replace temp rows with actual ID
      setTransactions((prev) =>
        prev.map((t) => (t.TransactionID === tempId ? { ...t, TransactionID: realId } : t))
      );

      // Show Toast success
      if (items.length === 1) {
        const prod = products.find((p) => p.ProductID === items[0].ProductID);
        const name = prod ? prod.ProductName : 'item';
        showToast(`Logged ${items[0].Quantity}x ${name} for ${memberToUse}!`, 'success');
      } else {
        showToast(`Logged ${items.length} products for ${memberToUse}!`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to log purchase. Reloading sheet to sync state...');
      showToast('Failed to log purchase.', 'error');
      loadSheetData(); // reload on fail to keep data pristine
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  // 2. Recharge Operations
  const handleConfirmRecharge = async (amount: number, rechargeDate: string) => {
    if (!token || !sheetId) return;
    setSyncing(true);
    try {
      const tempId = `rec_temp_${Date.now()}`;
      const newLocalRecharge: Recharge = {
        RechargeID: tempId,
        Date: rechargeDate,
        Amount: amount,
        Member: activeMember,
      };

      setRecharges((prev) => [...prev, newLocalRecharge]);

      // Write to Google Sheets
      const realId = await appendRecharge(token, sheetId, {
        Date: rechargeDate,
        Amount: amount,
        Member: activeMember,
      });

      // Replace temp row with actual ID
      setRecharges((prev) =>
        prev.map((r) => (r.RechargeID === tempId ? { ...r, RechargeID: realId } : r))
      );

      showToast(`Added ₹${amount.toFixed(2)} to balance!`, 'success');
    } catch (err: any) {
      console.error(err);
      setError('Failed to record recharge. Reloading sheet to sync state...');
      showToast('Failed to log recharge.', 'error');
      loadSheetData();
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  // 3. Update products (save products tab back)
  const handleUpdateProducts = async (updatedProductsList: Product[]) => {
    if (!token || !sheetId) return;
    setSyncing(true);
    try {
      setProducts(updatedProductsList);
      await saveProducts(token, sheetId, updatedProductsList);
      showToast('Products list updated successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      setError('Failed to save products list. Reloading sheet to sync...');
      showToast('Failed to save products.', 'error');
      loadSheetData();
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  // 4. Update transactions (save transactions tab back, e.g. for delete/edit)
  const handleUpdateTransactions = async (updatedTxsList: Transaction[]) => {
    if (!token || !sheetId) return;
    setSyncing(true);
    try {
      setTransactions(updatedTxsList);
      await saveTransactions(token, sheetId, updatedTxsList);
      showToast('Transactions synchronized successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      setError('Failed to sync transactions list. Reloading sheet...');
      showToast('Failed to sync transactions.', 'error');
      loadSheetData();
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  // 5. Update recharges (save recharges tab back, e.g. for delete/edit)
  const handleUpdateRecharges = async (updatedRechargesList: Recharge[]) => {
    if (!token || !sheetId) return;
    setSyncing(true);
    try {
      setRecharges(updatedRechargesList);
      await saveRecharges(token, sheetId, updatedRechargesList);
      showToast('Recharges synchronized successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      setError('Failed to sync recharges. Reloading sheet...');
      showToast('Failed to sync recharges.', 'error');
      loadSheetData();
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  // 6. Family Member Management
  const handleSetActiveMember = (name: string) => {
    setActiveMember(name);
    localStorage.setItem('dairy_active_member', name);
    showToast(`Switched profile to ${name}`, 'info');
  };

  const handleRenameMember = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('Name cannot be empty.');
    }
    if (trimmed === oldName) return;
    if (members.some((m) => m.Name.toLowerCase() === trimmed.toLowerCase() && m.Name !== oldName)) {
      throw new Error('Family member name already exists.');
    }

    // Update members list
    const updatedMembers = members.map((m) => (m.Name === oldName ? { Name: trimmed } : m));
    setMembers(updatedMembers);

    // Update transactions list
    const updatedTxs = transactions.map((t) => (t.Member === oldName ? { ...t, Member: trimmed } : t));
    setTransactions(updatedTxs);

    // Update recharges list
    const updatedRecharges = recharges.map((r) => (r.Member === oldName ? { ...r, Member: trimmed } : r));
    setRecharges(updatedRecharges);

    // Update active member
    if (activeMember === oldName) {
      setActiveMember(trimmed);
      localStorage.setItem('dairy_active_member', trimmed);
    }

    if (token && sheetId) {
      setSyncing(true);
      try {
        await saveMembers(token, sheetId, updatedMembers);
        await saveTransactions(token, sheetId, updatedTxs);
        await saveRecharges(token, sheetId, updatedRecharges);
        showToast(`Renamed ${oldName} to ${trimmed}!`, 'success');
      } catch (err: any) {
        console.error(err);
        setError('Failed to rename family member in spreadsheet. Reloading...');
        showToast('Failed to rename family member.', 'error');
        loadSheetData();
        throw err;
      } finally {
        setSyncing(false);
      }
    } else {
      localStorage.setItem('dairy_local_members', JSON.stringify(updatedMembers));
      showToast(`Renamed ${oldName} to ${trimmed}!`, 'success');
    }
  };

  const handleAddMemberDrawer = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Name cannot be empty.');
    if (members.some((m) => m.Name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('Family member already exists.');
    }

    const updated = [...members, { Name: trimmed }];
    setMembers(updated);

    if (token && sheetId) {
      setSyncing(true);
      try {
        await saveMembers(token, sheetId, updated);
        showToast(`Added profile for ${trimmed}!`, 'success');
      } catch (err: any) {
        console.error(err);
        setError('Failed to add family member to spreadsheet. Reloading...');
        showToast('Failed to add member.', 'error');
        loadSheetData();
        throw err;
      } finally {
        setSyncing(false);
      }
    } else {
      localStorage.setItem('dairy_local_members', JSON.stringify(updated));
      showToast(`Added profile for ${trimmed}!`, 'success');
    }
  };

  const handleDeleteMemberDrawer = async (name: string) => {
    if (members.length <= 1) {
      throw new Error('Must keep at least one family member.');
    }

    const updated = members.filter((m) => m.Name !== name);
    setMembers(updated);
    
    if (activeMember === name) {
      const first = updated[0]?.Name || 'Dad 👨';
      setActiveMember(first);
      localStorage.setItem('dairy_active_member', first);
    }

    if (token && sheetId) {
      setSyncing(true);
      try {
        await saveMembers(token, sheetId, updated);
        showToast(`Removed profile for ${name}!`, 'info');
      } catch (err: any) {
        console.error(err);
        setError('Failed to delete family member from spreadsheet. Reloading...');
        showToast('Failed to delete member.', 'error');
        loadSheetData();
        throw err;
      } finally {
        setSyncing(false);
      }
    } else {
      localStorage.setItem('dairy_local_members', JSON.stringify(updated));
      showToast(`Removed profile for ${name}!`, 'info');
    }
  };

  const handleAddMember = async () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) {
      setMemberError('Name cannot be empty.');
      return;
    }
    if (members.some((m) => m.Name.toLowerCase() === trimmed.toLowerCase())) {
      setMemberError('Family member already exists.');
      return;
    }
    
    const updated = [...members, { Name: trimmed }];
    setMembers(updated);
    setNewMemberName('');
    setMemberError(null);

    if (token && sheetId) {
      setSyncing(true);
      try {
        await saveMembers(token, sheetId, updated);
        showToast(`Added profile for ${trimmed}!`, 'success');
      } catch (err: any) {
        console.error(err);
        setMemberError('Failed to save new family member to spreadsheet.');
        showToast('Failed to add member.', 'error');
        loadSheetData();
      } finally {
        setSyncing(false);
      }
    } else {
      localStorage.setItem('dairy_local_members', JSON.stringify(updated));
      showToast(`Added profile for ${trimmed}!`, 'success');
    }
  };

  // Calculate dashboard metrics on-the-fly to prevent desynchronization
  const calculateMetrics = (): DashboardMetrics => {
    const totalRecharges = recharges.reduce((sum, r) => sum + r.Amount, 0);
    const totalSpend = transactions.reduce((sum, t) => sum + t.TotalAmount, 0);
    const currentBalance = totalRecharges - totalSpend;

    // Get current month strings (YYYY-MM)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStr = (now.getMonth() + 1).toString().padStart(2, '0');
    const matchPrefix = `${currentYear}-${currentMonthStr}`;

    const monthlySpend = transactions
      .filter((t) => t.Date.startsWith(matchPrefix))
      .reduce((sum, t) => sum + t.TotalAmount, 0);

    const monthlyRecharges = recharges
      .filter((r) => r.Date.startsWith(matchPrefix))
      .reduce((sum, r) => sum + r.Amount, 0);

    return {
      currentBalance,
      monthlySpend,
      monthlyRecharges,
      totalSpend,
      totalRecharges,
    };
  };

  const metrics = calculateMetrics();

  // Rendering Views
  if (authLoading) {
    return (
      <div id="loading-container" className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <span className="text-sm font-semibold text-slate-500 mt-4">Initializing Daily Dairy...</span>
      </div>
    );
  }

  // SIGN IN SCREEN
  if (!user || !token) {
    const isUnauthorizedDomain = error && error.toLowerCase().includes('unauthorized-domain');
    const isPopupIssue = Boolean(
      (authErrorCode &&
        (authErrorCode.includes('popup-closed-by-user') ||
          authErrorCode.includes('popup-blocked') ||
          authErrorCode.includes('cancelled-popup-request') ||
          authErrorCode.startsWith('gis/popup'))) ||
        (error &&
          (error.includes('popup-closed-by-user') ||
            error.includes('popup-blocked') ||
            error.includes('cancelled-popup-request')))
    );
    const isInIframe = isEmbeddedIframe();
    const isGisError = Boolean(authErrorCode && authErrorCode.startsWith('gis/'));

    return (
      <div id="sign-in-screen" className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center p-4">
        <div
          id="sign-in-card"
          className={`w-full bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden p-8 transition-all duration-300 ${
            isUnauthorizedDomain ? 'max-w-md sm:max-w-xl text-left' : 'max-w-sm text-center'
          } space-y-6`}
        >
          <div className="mx-auto w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-50/50">
            <Milk size={36} className="stroke-[1.8px]" />
          </div>

          <div className={`${isUnauthorizedDomain ? 'text-left' : 'text-center'} space-y-3`}>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daily Dairy Tracker</h1>
            <p className="text-[18px] italic font-normal text-[#0765ee] tracking-tight font-sans">
              Good Morning!
            </p>
            <div className="pt-3">
              <p className="inline-block text-[18px] font-bold text-[#079429] bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 shadow-sm">
                {"Curd + Milk = <3"}
              </p>
            </div>
          </div>

          {isUnauthorizedDomain ? (
            <div className="space-y-4 animate-fade-in text-left">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-amber-950">Firebase Domain Authorization Required</h3>
                  <p className="text-[11px] text-amber-850 leading-relaxed">
                    Firebase Authentication has blocked this login request because the current domain is not authorized in your Firebase Console.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-700">
                <p className="font-bold text-slate-800">📋 Step-by-Step Authorization Instructions:</p>
                
                <ol className="list-decimal pl-4 space-y-2.5 leading-relaxed text-slate-600">
                  <li>
                    Open your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5">Firebase Console <ExternalLink size={11} /></a>.
                  </li>
                  <li>
                    Select your project: <strong className="text-slate-800 font-semibold bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono">gen-lang-client-0988830786</strong>
                  </li>
                  <li>
                    Go to <strong className="text-slate-800 font-semibold">Build &gt; Authentication</strong> from the left sidebar.
                  </li>
                  <li>
                    Click on the <strong className="text-slate-800 font-semibold">Settings</strong> tab at the top.
                  </li>
                  <li>
                    Click on <strong className="text-slate-800 font-semibold">Authorized domains</strong> in the left submenu under Settings.
                  </li>
                  <li>
                    Click <strong className="text-slate-800 font-semibold">Add domain</strong> and add these exact clean domains (no trailing slashes, no <code className="font-mono bg-white px-1 border border-slate-100 rounded">https://</code>):
                  </li>
                </ol>

                <div className="space-y-3.5 pt-3.5 border-t border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      1. Active Hostname (Add this first):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-semibold text-slate-800 select-all truncate">
                        {window.location.hostname}
                      </code>
                      <button
                        onClick={() => handleCopyDomain(window.location.hostname)}
                        className="py-1.5 px-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shrink-0"
                      >
                        {copiedDomain ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {window.location.hostname.includes('ais-dev-') && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        2. Shared Preview Domain (Add to enable sharing):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <code className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-semibold text-slate-800 select-all truncate">
                          {window.location.hostname.replace('ais-dev-', 'ais-pre-')}
                        </code>
                        <button
                          onClick={() => handleCopySharedDomain(window.location.hostname.replace('ais-dev-', 'ais-pre-'))}
                          className="py-1.5 px-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shrink-0"
                        >
                          {copiedDomainShared ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          <span>{copiedDomainShared ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-relaxed mt-3.5">
                  <span className="font-bold">⚠️ Formatting Check:</span> Enter clean hostnames only! Adding <code className="font-mono bg-white px-1 border border-slate-100 rounded">https://</code> or trailing paths will cause this error to persist.
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setError(null)}
                  className="flex-1 h-11 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition duration-150 cursor-pointer text-center"
                >
                  Clear Error
                </button>
                <button
                  onClick={handleLogin}
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>Retry Login</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3.5 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-100 flex flex-col gap-2.5 text-left">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 text-red-500 mt-0.5" />
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-semibold text-red-800">
                        {isPopupIssue
                          ? 'Sign-in popup did not complete'
                          : 'Sign-in error'}
                      </p>
                      <p className="text-[11px] leading-relaxed text-red-700">
                        {isPopupIssue
                          ? isInIframe
                            ? 'This embedded preview iframe is blocking or isolating the Google sign-in popup. Open the app in a new browser tab to sign in cleanly.'
                            : 'Your browser closed or blocked the Google login popup before sign-in finished. Please allow popups for this site or try the alternative sign-in method below.'
                          : error}
                      </p>
                      {(authErrorCode || error) && (
                        <p className="text-[10px] font-mono text-red-600/80 break-all bg-white/70 border border-red-100 rounded px-2 py-1">
                          {authErrorCode ? `${authErrorCode}: ` : ''}{error}
                        </p>
                      )}
                    </div>
                  </div>

                  {isPopupIssue && (
                    <div className="pt-2 border-t border-red-100/80 flex flex-col gap-2">
                      {isInIframe && (
                        <a
                          id="open-new-tab-btn"
                          href={window.location.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <span>Open App in New Tab to Sign In</span>
                          <ExternalLink size={13} />
                        </a>
                      )}

                      <button
                        id="google-alt-signin-btn"
                        type="button"
                        onClick={isGisError ? handleLogin : handleGisLogin}
                        disabled={signingIn}
                        className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          isInIframe
                            ? 'bg-white hover:bg-slate-50 border border-red-200 text-slate-700'
                            : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white shadow-xs'
                        }`}
                      >
                        {signingIn ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <span>
                            {isGisError ? 'Try Firebase Sign-In Popup' : 'Try Direct Google Sign-In'}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 space-y-2.5">
                {/* GOOGLE SIGN IN BUTTON styled precisely per design guidelines */}
                <button
                  id="google-signin-btn"
                  onClick={() => (isInIframe && isGisReady() ? handleGisLogin() : handleLogin())}
                  disabled={signingIn}
                  className="w-full h-12 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed text-slate-700 font-semibold border border-slate-300 rounded-xl transition duration-150 flex items-center justify-center shadow-sm cursor-pointer relative"
                >
                  <div className="absolute left-4">
                    {signingIn ? (
                      <Loader2 size={18} className="animate-spin text-blue-600" />
                    ) : (
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-[18px] h-[18px] block">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm">
                    {signingIn ? 'Signing in with Google...' : 'Sign in with Google'}
                  </span>
                </button>

                {isInIframe && !isPopupIssue && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 text-[11px] font-medium text-slate-500 hover:text-blue-600 transition flex items-center justify-center gap-1"
                  >
                    <span>Trouble signing in? Open in a new tab</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 text-[10px] text-slate-400">
                Securely encrypted. No third-party servers. Direct client-to-Google integration.
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // CONNECT GOOGLE SPREADSHEET SCREEN
  if (!sheetId) {
    return (
      <ConnectSheetModal
        token={token}
        onConnected={handleSheetConnected}
        onLogout={handleLogout}
        userEmail={user.email || 'Google User'}
      />
    );
  }

  return (
    <div id="app-viewport" className="min-h-screen bg-[#F4F7F6] text-slate-900 flex flex-col max-w-lg mx-auto shadow-2xl relative border-x border-slate-200">
      
      {/* App Header */}
      <header id="app-header" className="sticky top-0 bg-[#F4F7F6]/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0">
            <Milk size={18} />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-slate-900">Daily Dairy</h1>
            <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
              <Sparkles size={8} /> Active Sync
            </span>
          </div>
        </div>

        {/* Profile Switcher & Drawer buttons */}
        <div className="flex items-center gap-2">
          {syncing || dataLoading ? (
            <div className="flex items-center justify-center bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-xl shrink-0">
              <Loader2 className="animate-spin" size={12} />
            </div>
          ) : null}

          {/* Active Family Member badge - click opens Profile Drawer */}
          <button
            id="active-member-badge"
            onClick={() => setProfileDrawerOpen(true)}
            className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-2.5 py-1.5 hover:bg-blue-100 transition cursor-pointer flex items-center gap-1 shrink-0"
            title="Open profile settings & switch member"
          >
            <span>👤 {activeMember}</span>
          </button>

          {/* Google Account Profile Photo (DP) & Hamburger trigger */}
          <button
            id="profile-drawer-toggle-btn"
            onClick={() => setProfileDrawerOpen(true)}
            className="flex items-center gap-1.5 p-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer relative shrink-0 animate-fade-in"
            title="Open Profile Settings"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Google Profile'}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full border border-blue-500/20 object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {(user.displayName || user.email || 'G')[0].toUpperCase()}
              </div>
            )}
            <div className="pr-1 pl-0.5 text-slate-500">
              <Menu size={14} className="stroke-[2.5px]" />
            </div>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="app-main-content" className="flex-1 px-6 pt-5">
        
        {/* Error Alert Overlay */}
        {error && (
          <div id="app-error-banner" className="mb-5 p-3.5 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-2 text-xs text-rose-800 animate-slide-up">
            <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Sync Alert</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-700 font-bold px-1.5 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Active Tab Router */}
        {activeTab === 'dashboard' && (
          <Dashboard
            metrics={metrics}
            products={products}
            transactions={transactions}
            recharges={recharges}
            onOpenCheckout={(initialProductId?: string) => {
              setCheckoutInitialProductId(initialProductId || null);
              setCheckoutOpen(true);
            }}
            onOpenRecharge={() => setRechargeOpen(true)}
            members={members}
            activeMember={activeMember}
            onConfirmCheckout={handleConfirmCheckout}
          />
        )}

        {activeTab === 'history' && (
          <TransactionHistory
            products={products}
            transactions={transactions}
            recharges={recharges}
            members={members}
            activeMember={activeMember}
            onUpdateTransactions={handleUpdateTransactions}
            onUpdateRecharges={handleUpdateRecharges}
            onConfirmCheckout={handleConfirmCheckout}
          />
        )}

        {activeTab === 'products' && (
          <ProductManager
            products={products}
            onUpdateProducts={handleUpdateProducts}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onLogout={handleLogout}
        userEmail={user.email || 'Google User'}
      />

      {/* Checkout Sliding Drawer */}
      <CheckoutModal
        products={products}
        currentBalance={metrics.currentBalance}
        isOpen={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setCheckoutInitialProductId(null);
        }}
        onConfirmCheckout={handleConfirmCheckout}
        activeMember={activeMember}
        initialProductId={checkoutInitialProductId}
      />

      {/* Recharge Modal Popup */}
      <RechargeModal
        isOpen={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        onConfirmRecharge={handleConfirmRecharge}
        activeMember={activeMember}
      />

      {/* Profile Sidebar Drawer (Hamburger Menu / Google DP Triggered) */}
      <ProfileDrawer
        isOpen={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        user={user}
        sheetId={sheetId}
        members={members}
        activeMember={activeMember}
        setActiveMember={handleSetActiveMember}
        onRenameMember={handleRenameMember}
        onAddMember={handleAddMemberDrawer}
        onDeleteMember={handleDeleteMemberDrawer}
        onLogout={handleLogout}
        onDisconnectSheet={handleDisconnectSheet}
        onSync={loadSheetData}
        syncing={syncing || dataLoading}
      />

      {/* Floating Toast Notification Container */}
      <div id="toast-container" className="absolute bottom-20 left-4 right-4 z-50 pointer-events-none flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-auto w-full max-w-sm mx-auto bg-white border border-slate-150 rounded-2xl shadow-xl flex items-center p-3.5 gap-3"
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  toast.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                    : toast.type === 'error'
                    ? 'bg-rose-50 text-rose-600 border border-rose-100/50'
                    : 'bg-blue-50 text-blue-600 border border-blue-100/50'
                }`}
              >
                {toast.type === 'success' ? (
                  <Check size={16} className="stroke-[2.5px]" />
                ) : toast.type === 'error' ? (
                  <AlertCircle size={16} className="stroke-[2.5px]" />
                ) : (
                  <Info size={16} className="stroke-[2.5px]" />
                )}
              </div>
              <div className="flex-1 pr-1">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition cursor-pointer shrink-0"
              >
                <X size={12} className="stroke-[2px]" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
