import { lower } from '../services/normalize';
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, FileCode, Edit3, Trash2, Sparkles } from 'lucide-react';
import type { Template } from '../types';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { ApiService } from '../services/api';

interface TemplatesPageProps {
  templates: Template[];
  onCreateTemplate: (tpl: Omit<Template, 'id' | 'created_at'>) => Promise<void>;
  onUpdateTemplate: (id: string, tpl: Partial<Template>) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
}) => {
  const { showSuccess,showError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(templates[0] || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [busy,setBusy]=useState(false);const lock=useRef(false);
  useEffect(()=>{setSelectedTemplate(prev=>templates.find(t=>t.id===prev?.id)||templates[0]||null);},[templates]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Sales');
  const [content, setContent] = useState('');

  const sampleContacts = [
    { name: 'Alexander Wright', first_name: 'Alexander', company: 'Nexus Dynamics', city: 'San Francisco', industry: 'Enterprise Software' },
    { name: 'Sophia Chen', first_name: 'Sophia', company: 'Apex Digital Systems', city: 'New York', industry: 'Fintech' },
    { name: 'Marcus Vance', first_name: 'Marcus', company: 'Vanguard Health Tech', city: 'Boston', industry: 'Healthcare' },
  ];
  const [sampleIdx, setSampleIdx] = useState(0);

  const filtered = (templates || []).filter(t => {
    if (!t) return false;
    const name = lower(t.name);
    const contentText = lower(t.content);
    const categoryName = lower(t.category);
    const search = lower(searchTerm);

    return (
      name.includes(search) ||
      contentText.includes(search) ||
      categoryName.includes(search)
    );
  });

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setCategory('Sales');
    setContent('Hi {{first_name}},\n\nI came across {{company}} and wanted to reach out regarding...');
    setIsModalOpen(true);
  };

  const openEditModal = (tpl: Template) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setCategory(tpl.category || 'Sales');
    setContent(tpl.content);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if(lock.current || !name || !content)return;
    lock.current=true;setBusy(true);try{

    const foundVars = Array.from(new Set(content.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || []))
      .map(v => v.replace(/[\{\}\s]/g, ''));

    if (editingId) {
      await onUpdateTemplate(editingId, { name, category, content, variables: foundVars });
      showSuccess('Template Updated', `Template "${name}" saved.`);
    } else {
      await onCreateTemplate({ name, category, content, variables: foundVars });
      showSuccess('Template Created', `New template "${name}" added.`);
    }

    setIsModalOpen(false);}catch(e){showError('Template Save Failed',e instanceof Error?e.message:'Please retry.');}finally{lock.current=false;setBusy(false);}
  };

  const handleDelete = async (id: string, tplName: string) => {
    if(lock.current)return;
    if (window.confirm(`Are you sure you want to delete template "${tplName}"?`)) {
      lock.current=true;setBusy(true);try{await onDeleteTemplate(id);
      showSuccess('Template Deleted', `Template "${tplName}" was removed.`);
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(templates.find(t => t.id !== id) || null);
      }}catch(e){showError('Template Delete Failed',e instanceof Error?e.message:'Please retry.');}finally{lock.current=false;setBusy(false);}
    }
  };

  const activeContact = sampleContacts[sampleIdx];
  const previewText = selectedTemplate
    ? ApiService.interpolateTemplate(selectedTemplate.content, {
        name: activeContact.name,
        first_name: activeContact.first_name,
        company: activeContact.company,
        city: activeContact.city,
        industry: activeContact.industry,
      })
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-subtle">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search templates or variables..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-[#FF5533] text-[#09090B]"
          />
        </div>

        <button
          onClick={openCreateModal}
          className="px-5 py-2.5 bg-[#FF5533] hover:bg-[#E64422] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5533]/20 flex items-center justify-center space-x-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Template</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filtered.map(tpl => {
            const isSelected = selectedTemplate?.id === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => setSelectedTemplate(tpl)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white ${
                  isSelected
                    ? 'border-[#FF5533] shadow-card ring-1 ring-[#FF5533]/30'
                    : 'border-zinc-200/80 hover:border-zinc-300 shadow-subtle'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <FileCode className="w-4 h-4 text-[#FF5533]" />
                    <h4 className="font-bold text-sm text-[#09090B]">{tpl.name}</h4>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full mr-2">
                      {tpl.category || 'General'}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        openEditModal(tpl);
                      }}
                      title="Edit Template"
                      className="p-1 text-zinc-400 hover:text-zinc-800 rounded hover:bg-zinc-100"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(tpl.id, tpl.name);
                      }}
                      title="Delete Template"
                      className="p-1 text-zinc-400 hover:text-rose-600 rounded hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-600 font-sans line-clamp-3 leading-relaxed whitespace-pre-wrap">
                  {tpl.content}
                </p>

                <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-zinc-100 text-[10px] font-mono text-zinc-500">
                  <span>Variables:</span>
                  {tpl.variables?.map(v => (
                    <span key={v} className="bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-[#FF5533]" />
                <h3 className="font-bold text-sm text-[#09090B]">Live Personalization Preview</h3>
              </div>
              <select
                value={sampleIdx}
                onChange={e => setSampleIdx(Number(e.target.value))}
                className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
              >
                {sampleContacts.map((c, i) => (
                  <option key={i} value={i}>
                    {c.first_name} ({c.company})
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate ? (
              <div className="space-y-4">
                <div className="text-xs space-y-1 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                  <p className="font-semibold text-zinc-700">Sample Contact Variables:</p>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    name: "{activeContact.name}", first_name: "{activeContact.first_name}", company: "{activeContact.company}", city: "{activeContact.city}"
                  </p>
                </div>

                <div className="p-4 bg-[#DCF8C6] border border-emerald-200/80 rounded-2xl rounded-tr-none text-xs text-[#09090B] font-sans leading-relaxed whitespace-pre-wrap shadow-xs">
                  {previewText}
                  <div className="text-[9px] text-zinc-500 text-right mt-2 font-mono">
                    10:45 AM ✓✓
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 text-center py-12">
                Select a template from the library to view live personalization interpolation.
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-100 text-[11px] text-zinc-400">
            Supported tags: <code>{'{{name}}'}</code>, <code>{'{{first_name}}'}</code>, <code>{'{{company}}'}</code>, <code>{'{{city}}'}</code>, <code>{'{{industry}}'}</code>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Template' : 'Create New Template'}
        subtitle="Manage WhatsApp message templates with dynamic contact variable placeholders."
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">Template Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. B2B SaaS Growth Outreach"
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] focus:outline-none focus:border-[#FF5533]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#09090B] mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] focus:outline-none"
            >
              <option value="Sales">Sales & Outreach</option>
              <option value="Product">Product Announcement</option>
              <option value="Follow-up">Follow-up & Nurture</option>
              <option value="Events">Events & Invitations</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#09090B]">Message Body *</label>
              <div className="flex items-center space-x-1">
                {['{{first_name}}', '{{company}}', '{{city}}', '{{industry}}'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setContent(prev => prev + ' ' + tag)}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded border border-zinc-300"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={6}
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#09090B] font-sans focus:outline-none focus:border-[#FF5533] leading-relaxed"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#FF5533] text-white text-xs font-bold shadow-xs hover:bg-[#E64422]"
            >
              Save Template
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
