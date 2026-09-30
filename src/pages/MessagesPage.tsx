import { formatDate } from '../services/normalize';
import { lower } from '../services/normalize';
import React, { useState } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import type { OutboundMessage } from '../types';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

interface MessagesPageProps {
  messages: OutboundMessage[];
}

export const MessagesPage: React.FC<MessagesPageProps> = ({ messages }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMessage, setSelectedMessage] = useState<OutboundMessage | null>(null);

  const filtered = (messages || []).filter(m => {
    if (!m) return false;
    const name = lower(m.contact_name);
    const company = lower(m.company);
    const phone = lower(m.phone);
    const text = lower(m.message_text);
    const search = lower(searchTerm);

    const matchesSearch =
      name.includes(search) ||
      company.includes(search) ||
      phone.includes(search) ||
      text.includes(search);
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-subtle">
        <div className="flex items-center space-x-3 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by contact, company, phone, or message body..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-[#FF5533] text-[#09090B]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="text-xs font-semibold text-zinc-500">
          Total Logs: <span className="font-extrabold text-[#09090B]">{filtered.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="bg-[#F5F4F2]/70 text-zinc-700 font-semibold border-b border-zinc-200">
              <tr>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Phone</th>
                <th className="px-5 py-3.5">Message Snippet</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Sent Time</th>
                <th className="px-5 py-3.5">Delivered Time</th>
                <th className="px-5 py-3.5">Read Time</th>
                <th className="px-5 py-3.5">Error Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(msg => (
                <tr
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4 font-bold text-[#09090B]">{msg.contact_name}</td>
                  <td className="px-5 py-4 text-zinc-700 font-semibold">{msg.company}</td>
                  <td className="px-5 py-4 font-mono text-zinc-800">{msg.phone}</td>
                  <td className="px-5 py-4 max-w-xs truncate text-zinc-600">{msg.message_text}</td>
                  <td className="px-5 py-4">
                    <Badge status={msg.status} />
                  </td>
                  <td className="px-5 py-4 text-zinc-400">
                    {msg.sent_at ? formatDate(msg.sent_at,'time') : '—'}
                  </td>
                  <td className="px-5 py-4 text-zinc-400">
                    {msg.delivered_at ? formatDate(msg.delivered_at,'time') : '—'}
                  </td>
                  <td className="px-5 py-4 text-zinc-400">
                    {msg.read_at ? formatDate(msg.read_at,'time') : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {msg.error_message ? (
                      <span className="inline-flex items-center text-rose-600 font-semibold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Error
                      </span>
                    ) : (
                      <span className="text-zinc-300">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedMessage && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedMessage(null)}
          title="Outbound Message Details"
          subtitle={`Recipient: ${selectedMessage.contact_name} (${selectedMessage.phone})`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-semibold">Campaign</p>
                <p className="font-bold text-[#09090B]">{selectedMessage.campaign_name || 'Direct Outreach'}</p>
              </div>
              <Badge status={selectedMessage.status} size="md" />
            </div>

            <div>
              <p className="font-bold text-[#09090B] mb-1">Full Message Text:</p>
              <div className="p-3.5 bg-[#DCF8C6] border border-emerald-200 rounded-xl text-[#09090B] whitespace-pre-wrap font-sans leading-relaxed">
                {selectedMessage.message_text}
              </div>
            </div>

            {selectedMessage.error_message && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                <p className="font-bold flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-rose-600" /> Error Diagnostics:
                </p>
                <p className="text-xs">{selectedMessage.error_message}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-500 pt-2 border-t border-zinc-100">
              <div>
                <span className="block font-semibold">Sent</span>
                <span>{selectedMessage.sent_at ? formatDate(selectedMessage.sent_at,'full') : '—'}</span>
              </div>
              <div>
                <span className="block font-semibold">Delivered</span>
                <span>{selectedMessage.delivered_at ? formatDate(selectedMessage.delivered_at,'full') : '—'}</span>
              </div>
              <div>
                <span className="block font-semibold">Read</span>
                <span>{selectedMessage.read_at ? formatDate(selectedMessage.read_at,'full') : '—'}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
