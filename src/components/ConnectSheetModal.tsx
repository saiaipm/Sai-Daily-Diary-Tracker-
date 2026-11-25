import React, { useState } from 'react';
import { createSpreadsheet } from '../lib/googleSheets';
import { Loader2, Database, Plus, CheckCircle, FileSpreadsheet, ArrowRight } from 'lucide-react';

interface ConnectSheetModalProps {
  token: string;
  onConnected: (sheetId: string) => void;
  onLogout: () => void;
  userEmail: string;
}

export default function ConnectSheetModal({
  token,
  onConnected,
  onLogout,
  userEmail,
}: ConnectSheetModalProps) {
  const [sheetIdInput, setSheetIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateNew = async () => {
    setLoading(true);
    setError(null);
    try {
      const newId = await createSpreadsheet(token);
      onConnected(newId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create a new Google Sheet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectExisting = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let id = sheetIdInput.trim();
    if (!id) {
      setError('Please enter a valid Google Sheet ID or URL.');
      return;
    }

    // Extract ID from full Google Sheet URL if pasted
    // Pattern: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
    if (id.includes('docs.google.com/spreadsheets')) {
      const matches = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (matches && matches[1]) {
        id = matches[1];
      } else {
        setError('Could not extract Spreadsheet ID from URL. Please double-check.');
        return;
      }
    }

    onConnected(id);
  };

  return (
    <div id="connect-sheet-container" className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center p-4">
      <div id="connect-sheet-card" className="w-full max-w-md bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
            <FileSpreadsheet size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Connect Your Google Sheet
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Daily Dairy Tracker stores all your transactions, products, and recharges directly inside your own Google Drive. You maintain 100% data ownership.
          </p>
          <div className="mt-3 text-xs bg-blue-50/50 text-blue-600 border border-blue-100 inline-block px-3 py-1.5 rounded-full font-bold">
            Signed in as {userEmail}
          </div>
        </div>

        {error && (
          <div id="error-alert" className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-xs text-rose-800 font-medium animate-fade-in">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Option A: Create New Sheet */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-center sm:text-left">
              Option A: Automated Setup (Recommended)
            </h2>
            <button
              id="create-sheet-button"
              onClick={handleCreateNew}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Creating your Sheet...</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>Create Brand New Sheet</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              We'll create "Daily Dairy Tracker" with pre-filled defaults.
            </p>
          </div>

          <div className="relative flex py-3 items-center">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-4 text-xs text-slate-400 font-bold tracking-widest">OR</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* Option B: Connect Existing */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-center sm:text-left">
              Option B: Connect Existing Sheet
            </h2>
            <form onSubmit={handleConnectExisting} className="space-y-3">
              <div>
                <input
                  id="sheet-id-input"
                  type="text"
                  placeholder="Paste Google Sheet URL or ID"
                  value={sheetIdInput}
                  onChange={(e) => setSheetIdInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-800 bg-slate-50 placeholder-slate-300"
                />
              </div>
              <button
                id="connect-existing-submit"
                type="submit"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 border border-slate-200 cursor-pointer text-sm"
              >
                <span>Connect Existing Sheet</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

          <div className="relative flex py-3 items-center">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-4 text-xs text-slate-400 font-bold tracking-widest">OR</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* Option C: Reconnect Shared Family Database */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-center sm:text-left">
              Option C: Shared Family Sheet
            </h2>
            <button
              id="connect-default-sheet-button"
              onClick={() => onConnected('1ZAqXo28GKDNUTyMyDz3erqJgsD_skKEv_RrRuuNHub8')}
              className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-semibold py-3.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <Database size={16} />
              <span>Connect Family Default Sheet</span>
            </button>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Quickly reconnect to the app's default shared spreadsheet.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Need to switch accounts?</span>
          <button
            id="logout-button"
            onClick={onLogout}
            className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer hover:underline"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
