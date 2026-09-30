import { lower } from '../services/normalize';
import React, { useState } from 'react';
import { Search, Plus, Download } from 'lucide-react';
import type { Contact, Campaign } from '../types';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

interface ContactsPageProps {
  contacts: Contact[];
  campaigns: Campaign[];
  onAddContact: (contact: Omit<Contact, 'id' | 'created_at' | 'status'>,campaignId?:string) => Promise<void>;
}

export const ContactsPage: React.FC<ContactsPageProps> = ({ contacts, campaigns, onAddContact }) => {
  const { showSuccess, showError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [campaignId,setCampaignId]=useState('');
  const [busy,setBusy]=useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [industry, setIndustry] = useState('');

  const filtered = (contacts || []).filter(c => {
    if (!c) return false;
    const name = lower(c.name);
    const company = lower(c.company);
    const phone = lower(c.phone);
    const email = lower(c.email);
    const search = lower(searchTerm);

    const matchesSearch =
      name.includes(search) ||
      company.includes(search) ||
      phone.includes(search) ||
      email.includes(search);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'First Name', 'Company', 'Phone', 'Email', 'City', 'Industry', 'Status'];
    const cell=(value:unknown)=>{let v=String(value??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
    const rows=filtered.map(c=>[c.id,c.name,c.first_name,c.company,c.phone,c.email,c.city,c.industry,c.status].map(cell));
    const csvContent='data:text/csv;charset=utf-8,'+[headers.map(cell).join(','),...rows.map(r=>r.join(','))].join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EightBit_Contacts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess('Export Complete', `Exported ${filtered.length} contacts to CSV.`);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if(busy)return;
    if(!campaignId){showError('Draft Campaign Required','Select a draft campaign.');return;}
    if (!name || !company || !phone) return;
    setBusy(true);try{

    const firstName = name.trim().split(/\s+/)[0] || name;

    await onAddContact({
      name,
      first_name: firstName,
      company,
      phone,
      email,
      city,
      industry,
    },campaignId);

    showSuccess('Contact Added', `${name} has been added to the database.`);
    setIsAddModalOpen(false);
    setName('');
    setCompany('');
    setPhone('');
    setEmail('');
    setCity('');
    setIndustry('');}catch(e){showError('Contact Not Added',e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}
  };

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
              placeholder="Search contacts by name, company, or phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-[#FF5533] text-[#09090B]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Contacts</option>
            <option value="active">Active</option>
            <option value="opted_out">Opted Out</option>
            <option value="invalid">Invalid</option>
          </select>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold border border-zinc-200 flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-[#FF5533] hover:bg-[#E64422] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5533]/20 flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <span>Showing {filtered.length} of {contacts.length} total contacts</span>
          <span className="font-semibold text-zinc-700">Supported Tags: {'{{name}}, {{first_name}}, {{company}}, {{city}}, {{industry}}'}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="bg-[#F5F4F2]/70 text-zinc-700 font-semibold border-b border-zinc-200">
              <tr>
                <th className="px-6 py-3.5">Contact Name</th>
                <th className="px-6 py-3.5">Company</th>
                <th className="px-6 py-3.5">Phone Number</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Location</th>
                <th className="px-6 py-3.5">Industry</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(contact => (
                <tr key={contact.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-[#09090B]">{contact.name}</div>
                    <div className="text-[11px] text-zinc-400">Var: {'{{first_name}}'} = {contact.first_name}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-zinc-800">{contact.company}</td>
                  <td className="px-6 py-4 font-mono font-medium text-zinc-900">{contact.phone}</td>
                  <td className="px-6 py-4 text-zinc-500">{contact.email || '—'}</td>
                  <td className="px-6 py-4 text-zinc-500">{contact.city || '—'}</td>
                  <td className="px-6 py-4 text-zinc-500">{contact.industry || '—'}</td>
                  <td className="px-6 py-4">
                    <Badge status={contact.status} />
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
        title="Add Single Contact"
        subtitle="Manually add a contact row to your outreach database."
        maxWidth="md"
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          <label className="block text-xs font-bold">Draft Campaign<select value={campaignId} onChange={e=>setCampaignId(e.target.value)} required className="block w-full border rounded-lg p-2"><option value="">Select a draft campaign</option>{campaigns.filter(c=>c.status==='draft').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alexander Wright"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] focus:outline-none focus:border-[#FF5533]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">Company *</label>
            <input
              type="text"
              required
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Nexus Dynamics"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] focus:outline-none focus:border-[#FF5533]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">WhatsApp Phone *</label>
            <input
              type="text"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +15551234567"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-[#09090B] focus:outline-none focus:border-[#FF5533]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#09090B] mb-1">Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="alex@nexus.io"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] focus:outline-none focus:border-[#FF5533]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#09090B] mb-1">City (Optional)</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="San Francisco"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] focus:outline-none focus:border-[#FF5533]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">Industry (Optional)</label>
            <input
              type="text"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="Enterprise Software"
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
              className="px-4 py-2 rounded-xl bg-[#FF5533] text-white text-xs font-bold shadow-xs hover:bg-[#E64422]"
            >
              Save Contact
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
