import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  User as UserIcon, 
  Users, 
  Trash2, 
  Edit2, 
  Plus, 
  LogOut, 
  FileSpreadsheet, 
  RefreshCw, 
  Unlink, 
  AlertCircle 
} from 'lucide-react';
import { FamilyMember } from '../types';
import { AuthUser } from '../lib/firebase';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  sheetId: string;
  members: FamilyMember[];
  activeMember: string;
  setActiveMember: (name: string) => void;
  onRenameMember: (oldName: string, newName: string) => Promise<void>;
  onAddMember: (name: string) => Promise<void>;
  onDeleteMember: (name: string) => Promise<void>;
  onLogout: () => void;
  onDisconnectSheet: () => void;
  onSync: () => void;
  syncing: boolean;
}

export default function ProfileDrawer({
  isOpen,
  onClose,
  user,
  sheetId,
  members,
  activeMember,
  setActiveMember,
  onRenameMember,
  onAddMember,
  onDeleteMember,
  onLogout,
  onDisconnectSheet,
  onSync,
  syncing,
}: ProfileDrawerProps) {
  const [copied, setCopied] = useState(false);
  
  // Member management states
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  const handleCopyId = () => {
    navigator.clipboard.writeText(sheetId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startRename = (name: string) => {
    setEditingMember(name);
    setEditValue(name);
    setLocalError(null);
  };

  const cancelRename = () => {
    setEditingMember(null);
    setEditValue('');
    setLocalError(null);
  };

  const saveRename = async (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setLocalError('Name cannot be empty.');
      return;
    }
    if (trimmed === oldName) {
      setEditingMember(null);
      return;
    }
    setActionLoading(true);
    setLocalError(null);
    try {
      await onRenameMember(oldName, trimmed);
      setEditingMember(null);
    } catch (err: any) {
      setLocalError(err.message || 'Rename failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddLocalMember = async () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) {
      setLocalError('Please enter a name.');
      return;
    }
    if (members.some(m => m.Name.toLowerCase() === trimmed.toLowerCase())) {
      setLocalError('Profile name already exists.');
      return;
    }
    setActionLoading(true);
    setLocalError(null);
    try {
      await onAddMember(trimmed);
      setNewMemberName('');
    } catch (err: any) {
      setLocalError(err.message || 'Add failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLocalMember = async (name: string) => {
    if (members.length <= 1) {
      setLocalError('You must keep at least one profile.');
      return;
    }

    setActionLoading(true);
    setLocalError(null);
    try {
      await onDeleteMember(name);
    } catch (err: any) {
      setLocalError(err.message || 'Delete failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            id="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 max-w-lg mx-auto border-x border-slate-200"
          />

          {/* Side Drawer Panel */}
          <motion.div
            id="profile-drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-80 max-w-[85%] bg-white shadow-2xl z-50 flex flex-col h-screen border-l border-slate-100 max-w-lg mx-auto"
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
                <UserIcon size={16} className="text-blue-600" />
                <span>My Profile Center</span>
              </div>
              <button
                id="close-drawer-btn"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-slate-200/50 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Google Account Detail Card */}
              <div id="google-profile-card" className="bg-gradient-to-tr from-blue-50/50 to-indigo-50/20 border border-blue-100/60 rounded-[24px] p-4 flex flex-col items-center text-center space-y-3">
                <div id="google-avatar-container" className="relative">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google User'}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full border-2 border-blue-600/70 shadow-md object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl border-2 border-white shadow-md">
                      {(user.displayName || user.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs tracking-tight">
                    {user.displayName || 'Google User'}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Spreadsheet connection section */}
              <div id="drawer-sheet-section" className="space-y-2.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Google Sheet Settings
                </label>
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-700 truncate flex-1">
                      Daily Dairy Tracker Sheet
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 bg-white border border-slate-100 rounded-lg p-2 flex items-center justify-between gap-1.5">
                    <span className="truncate max-w-[130px]">{sheetId}</span>
                    <button
                      onClick={handleCopyId}
                      className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      title="Copy spreadsheet ID"
                    >
                      {copied ? (
                        <>
                          <Check size={11} className="text-emerald-600" />
                          <span className="text-emerald-600 text-[9px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span className="text-[9px]">Copy ID</span>
                        </>
                      )}
                    </button>
                  </div>

                  <a
                    href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 rounded-xl text-[10px] font-bold text-emerald-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ExternalLink size={12} />
                    <span>Open Google Sheet</span>
                  </a>
                </div>
              </div>

              {/* Active logging profile */}
              <div id="drawer-active-profile-section" className="space-y-2.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Active Member Profile
                </label>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Logging milk purchases and wallet recharges under this profile:
                </p>
                <select
                  id="drawer-active-member-select"
                  value={activeMember}
                  onChange={(e) => setActiveMember(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                >
                  {members.map((m) => (
                    <option key={m.Name} value={m.Name}>
                      👤 {m.Name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Manage Family Members & Editing Names */}
              <div id="drawer-family-section" className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Edit Family Members
                  </label>
                  <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {members.length} total
                  </span>
                </div>

                {localError && (
                  <div className="p-2.5 bg-rose-50 text-rose-750 text-[10px] font-medium rounded-xl border border-rose-100 flex items-center gap-1.5">
                    <AlertCircle size={12} className="shrink-0 text-rose-500" />
                    <span>{localError}</span>
                  </div>
                )}

                {/* Profiles grid/list */}
                <div className="space-y-1.5">
                  {members.map((member) => {
                    const isEditing = editingMember === member.Name;
                    const isActive = member.Name === activeMember;

                    return (
                      <div
                        key={member.Name}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                          isActive
                            ? 'bg-blue-50/50 border-blue-150 text-slate-800'
                            : 'bg-slate-50/60 border-slate-150/50 text-slate-700'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1 mr-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename(member.Name);
                                if (e.key === 'Escape') cancelRename();
                              }}
                              className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600"
                              autoFocus
                              disabled={actionLoading || syncing}
                            />
                            <button
                              onClick={() => saveRename(member.Name)}
                              disabled={actionLoading || syncing}
                              className="text-emerald-600 hover:bg-emerald-50 p-1 rounded-md cursor-pointer shrink-0"
                            >
                              <Check size={13} className="stroke-[2.5px]" />
                            </button>
                            <button
                              onClick={cancelRename}
                              disabled={actionLoading || syncing}
                              className="text-slate-400 hover:bg-slate-100 p-1 rounded-md cursor-pointer shrink-0"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs font-bold truncate flex items-center gap-1 flex-1">
                              👤 {member.Name} {isActive && <span className="text-[9px] font-bold text-blue-600 bg-white border border-blue-200 rounded px-1.5 py-0.5 ml-1">Active</span>}
                            </span>
                            {memberToDelete === member.Name ? (
                              <div className="flex items-center gap-1 shrink-0 animate-fade-in">
                                <button
                                  onClick={() => {
                                    handleDeleteLocalMember(member.Name);
                                    setMemberToDelete(null);
                                  }}
                                  disabled={actionLoading || syncing}
                                  className="text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-rose-200 cursor-pointer transition shrink-0"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setMemberToDelete(null)}
                                  disabled={actionLoading || syncing}
                                  className="text-slate-500 bg-white hover:bg-slate-50 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-200 cursor-pointer transition shrink-0"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startRename(member.Name)}
                                  disabled={actionLoading || syncing}
                                  className="text-slate-400 hover:text-blue-600 p-1 hover:bg-white rounded transition cursor-pointer"
                                  title="Edit Name"
                                >
                                  <Edit2 size={12} />
                                </button>
                                {members.length > 1 && (
                                  <button
                                    onClick={() => setMemberToDelete(member.Name)}
                                    disabled={actionLoading || syncing}
                                    className="text-slate-300 hover:text-rose-600 p-1 hover:bg-white rounded transition cursor-pointer"
                                    title="Delete Profile"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add new inline member row */}
                <div className="pt-2 border-t border-slate-100/60 flex gap-1.5">
                  <input
                    type="text"
                    placeholder="New family member"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddLocalMember();
                    }}
                    disabled={actionLoading || syncing}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    onClick={handleAddLocalMember}
                    disabled={actionLoading || syncing}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

            </div>

            {/* Drawer Footer (Actions) */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-2.5">
              <button
                onClick={onSync}
                disabled={syncing || actionLoading}
                className="w-full py-2.5 bg-white hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-55"
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                <span>Force Sheet Sync</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onDisconnectSheet();
                  }}
                  className="py-2 px-3 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <Unlink size={11} />
                  <span>Unlink Sheet</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="py-2 px-3 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <LogOut size={11} />
                  <span>Sign Out</span>
                </button>
              </div>
              <div className="text-center text-[9px] text-slate-400 pt-1">
                Daily Dairy • Direct sheets persistence
              </div>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
