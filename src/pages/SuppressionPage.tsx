import { formatDate } from '../services/normalize';
import { lower } from '../services/normalize';
import React, { useState } from 'react';
import { Search, Plus, Trash2, ShieldAlert } from 'lucide-react';
import type { SuppressionNumber } from '../types';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

interface SuppressionPageProps {
  suppressionList: SuppressionNumber[];
  onAddSuppression: (item: Omit<SuppressionNumber, 'id' | 'added_at'>) => Promise<void>;
  onRemoveSuppression: (id: string) => Promise<void>;
}

export const SuppressionPage: React.FC<SuppressionPageProps> = ({
  suppressionList,
  onAddSuppression,
  onRemoveSuppression,
}) => {
  const { showSuccess,showError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [busy,setBusy]=useState(false);
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [reason, setReason] = useState<'opt_out' | 'manual' | 'bounced' | 'complaint'>('opt_out');
  const [notes, setNotes] = useState('');

  const filtered = (suppressionList || []).filter(s => {
    if (!s) return false;
    const phone = lower(s.phone);
    const name = lower(s.contact_name);
    const notesStr = lower(s.notes);
    const reasonStr = lower(s.reason);
    const search = lower(searchTerm);

    return (
      phone.includes(search) ||
      name.includes(search) ||
      notesStr.includes(search) ||
      reasonStr.includes(search)
    );
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if(busy || !phone)return;
    setBusy(true);try{

    await onAddSuppression({
      phone,
      contact_name: contactName || 'Manual Entry',
      reason,
      added_by: 'Operator',
      notes,
    });

    showSuccess('Suppression Added', `${phone} was added to the blacklist.`);
    setIsAddModalOpen(false);
    setPhone('');
    setContactName('');
    setNotes('');}catch(e){showError('Suppression Failed',e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}
  };

  const handleRemove = async (id: string, phoneNum: string) => {
    if (window.confirm(`Remove ${phoneNum} from Suppression List? They will be eligible for future outreach campaigns.`)) {
      if(busy)return;setBusy(true);try{await onRemoveSuppression(id);
      showSuccess('Suppression Removed', `${phoneNum} is now unblocked.`);}catch(e){showError('Removal Failed',e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-subtle">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search suppressed numbers, names, or notes..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-[#FF5533] text-[#09090B]"
          />
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 flex items-center justify-center space-x-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Blocked Number</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <span>Suppressed Records: <strong>{filtered.length}</strong></span>
          <span className="text-rose-600 font-semibold flex items-center">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" /> n8n Automatically Skips These Numbers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="bg-[#F5F4F2]/70 text-zinc-700 font-semibold border-b border-zinc-200">
              <tr>
                <th className="px-6 py-3.5">Suppressed Phone</th>
                <th className="px-6 py-3.5">Contact Name</th>
                <th className="px-6 py-3.5">Reason</th>
                <th className="px-6 py-3.5">Added Date</th>
                <th className="px-6 py-3.5">Added By</th>
                <th className="px-6 py-3.5">Notes</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-[#09090B]">{item.phone}</td>
                  <td className="px-6 py-4 font-semibold text-zinc-800">{item.contact_name || '—'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.reason === 'opt_out'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : item.reason === 'bounced'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      {item.reason.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">
                    {formatDate(item.added_at,'date')}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">{item.added_by}</td>
                  <td className="px-6 py-4 text-zinc-500 max-w-xs truncate">{item.notes || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      disabled
                      onClick={() => handleRemove(item.id, item.phone)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Opt-out removal requires verified renewed consent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Number to Suppression List"
        subtitle="Blacklist a phone number from receiving future outreach campaign messages."
        maxWidth="md"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">Phone Number *</label>
            <input
              type="text"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +15550009988"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-[#09090B] focus:outline-none focus:border-[#FF5533]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">Contact Name (Optional)</label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] focus:outline-none focus:border-[#FF5533]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">Reason</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value as any)}
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] focus:outline-none"
            >
              <option value="opt_out">Opt-Out / STOP Reply</option>
              <option value="manual">Manual Operator Request</option>
              <option value="bounced">Invalid / Bounced Number</option>
              <option value="complaint">Unsubscribe Request</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">Notes / Reason Context</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Context or customer message..."
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] focus:outline-none focus:border-[#FF5533]"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs hover:bg-rose-700"
            >
              Block Number
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
