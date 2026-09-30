import React, { useState, useRef } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Play,
  Eye
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Modal } from '../ui/Modal';
import type { Template, ImportValidationResult, SuppressionNumber } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../ui/Toast';

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  suppressionList: SuppressionNumber[];
  onCampaignCreated: (campaignData: any) => Promise<void>;
}

export const CampaignWizardModal: React.FC<CampaignWizardModalProps> = ({
  isOpen,
  onClose,
  templates,
  suppressionList,
  onCampaignCreated,
}) => {
  const { showError } = useToast();

  const [step, setStep] = useState<number>(1);

  const [campaignName, setCampaignName] = useState('');
  const [sendingInterval, setSendingInterval] = useState(120);
  const allowedDays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [timezone, setTimezone] = useState('Asia/Karachi');

  const [uploadedFile,setUploadedFile]=useState<File|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const submissionLock=useRef(false);
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [importConfirmed, setImportConfirmed] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [customTemplateContent, setCustomTemplateContent] = useState<string>(
    templates[0]?.content || 'Hi {{first_name}},\n\nI came across {{company}} in {{city}} and wanted to reach out regarding...'
  );
  const [previewContactIdx, setPreviewContactIdx] = useState<number>(0);

  const daysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleTemplateSelect = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = templates.find(t => t.id === tplId);
    if (tpl) {
      setCustomTemplateContent(tpl.content);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(null);setValidationResult(null);setImportConfirmed(false);setFileName('');

    if(!/\.(csv|xlsx)$/i.test(file.name)||file.size>5*1024*1024){showError('Invalid File','Use a CSV or XLSX file of up to 5 MB.');return;}
    setUploadedFile(file);
    setFileName(file.name);
    setValidationResult(null);setImportConfirmed(false);
    setIsParsing(true);

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        preview:5001,
        skipEmptyLines: true,
        complete: (results) => {
          setIsParsing(false);
          const result = ApiService.validateImportData(results.data as any[], suppressionList);
          if(result.total_rows>5000){showError('Too Many Rows','Import up to 5000 rows per request.');setUploadedFile(null);setValidationResult(null);return;}
          setValidationResult(result);
          setImportConfirmed(false);
        },
        error: (err) => {
          setIsParsing(false);
          showError('CSV Parsing Error', err.message);
        },
      });
    } else if (fileExt === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          setIsParsing(false);
          const result = ApiService.validateImportData(data as any[], suppressionList);
          if(result.total_rows>5000){showError('Too Many Rows','Import up to 5000 rows per request.');setUploadedFile(null);setValidationResult(null);return;}
          setValidationResult(result);
          setImportConfirmed(false);
        } catch (err: any) {
          setIsParsing(false);
          showError('Excel Reading Error', err?.message || 'Failed to read file');
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setIsParsing(false);
      showError('Unsupported File Format', 'Please upload a valid .csv or .xlsx file.');
    }
  };

  const handleLaunch = async () => {
    if(submissionLock.current)return;
    try{ApiService.validateCampaign({name:campaignName,custom_template_content:customTemplateContent,timezone,start_time:startTime,end_time:endTime,sending_interval:Number(sendingInterval)});}catch(e){showError('Invalid Campaign',e instanceof Error?e.message:'Check campaign settings.');return;}
    if (!campaignName.trim()) {
      showError('Validation Required', 'Please enter a campaign name.');
      setStep(1);
      return;
    }
    if (!validationResult || validationResult.valid_contacts.length === 0) {
      showError('No Valid Contacts', 'Please upload a file containing at least one valid phone contact.');
      setStep(2);
      return;
    }
    if (!importConfirmed) {
      showError('Confirmation Required', 'Please confirm the contact import before launching.');
      setStep(2);
      return;
    }

    const templateObj = templates.find(t => t.id === selectedTemplateId);

    if(!uploadedFile){showError('Upload Required','Upload a CSV or XLSX file before creating a campaign.');return;}
    submissionLock.current=true;setSubmitting(true);
    try{await onCampaignCreated({
      file:uploadedFile,
      name: campaignName,
      template_id: selectedTemplateId,
      template_name: templateObj?.name || 'Custom Template',
      total_contacts: validationResult.valid_contacts.length,
      sending_interval: Number(sendingInterval),
      allowed_days: allowedDays,
      start_time: startTime,
      end_time: endTime,
      timezone,
      custom_template_content: customTemplateContent,
      contacts: validationResult.valid_contacts,
    });

    onClose();}catch(e){showError('Campaign Setup Failed',e instanceof Error?e.message:'Please retry.');onClose();}finally{submissionLock.current=false;setSubmitting(false);}
  };

  const currentPreviewContact = validationResult?.valid_contacts[previewContactIdx] || {
    name: 'Alexander Wright',
    first_name: 'Alexander',
    company: 'Nexus Dynamics',
    city: 'San Francisco',
    industry: 'Software',
    phone: '+15551234567',
  };

  const interpolatedPreview = ApiService.interpolateTemplate(customTemplateContent, {
    name: currentPreviewContact.name,
    first_name: currentPreviewContact.first_name,
    company: currentPreviewContact.company,
    city: currentPreviewContact.city || 'your area',
    industry: currentPreviewContact.industry || 'your industry',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={()=>{if(!submissionLock.current)onClose();}}
      title="Create New Outreach Campaign"
      subtitle="Configure dispatch schedule, import callsets, and personalize template tags."
      maxWidth="4xl"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          {[
            { num: 1, label: 'Schedule & Details' },
            { num: 2, label: 'Import Contacts' },
            { num: 3, label: 'Template & Variables' },
            { num: 4, label: 'Review & Launch' },
          ].map(s => (
            <button
              key={s.num}
              onClick={() => setStep(s.num)}
              className={`flex items-center space-x-2 text-xs font-semibold py-1 px-3 rounded-lg transition-colors ${
                step === s.num
                  ? 'bg-[#FF5533] text-white shadow-xs'
                  : step > s.num
                  ? 'text-emerald-700 bg-emerald-50'
                  : 'text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === s.num
                    ? 'bg-white text-[#FF5533]'
                    : step > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-200 text-zinc-600'
                }`}
              >
                {s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-[#09090B] mb-1.5">
                Campaign Name <span className="text-[#FF5533]">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="e.g. Q3 Enterprise SaaS Outreach - Batch A"
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-[#FF5533] focus:bg-white text-[#09090B]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#09090B] mb-1.5 flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1 text-zinc-500" /> Sending Interval (seconds)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={sendingInterval}
                  onChange={e => setSendingInterval(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-[#FF5533] focus:bg-white text-[#09090B]"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Delay between consecutive dispatches to prevent WhatsApp throttling.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#09090B] mb-1.5">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-[#FF5533] focus:bg-white text-[#09090B]"
                >
                  <option value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                  <option value="Europe/London">Europe/London (GMT/BST, UTC+0)</option>
                  <option value="America/New_York">America/New_York (EST/EDT, UTC-5)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT, UTC-6)</option>
                  <option value="America/Denver">America/Denver (MST/MDT, UTC-7)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT, UTC-8)</option>
                  <option value="Asia/Riyadh">Asia/Riyadh (AST, UTC+3)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                  <option value="UTC">UTC (UTC+0)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#09090B] mb-1.5 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-zinc-500" /> Sending Days — Daily
              </label>
              <div className="flex flex-wrap gap-2">
                {daysList.map(day => {
                  const isSelected = allowedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled
                      aria-label={`${day}: sends within the daily window`}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        isSelected
                          ? 'bg-[#FF5533] text-white border-[#FF5533] shadow-xs'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#09090B] mb-1.5">
                  Daily Start Window
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-[#FF5533] text-[#09090B]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#09090B] mb-1.5">
                  Daily End Window
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-[#FF5533] text-[#09090B]"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="border-2 border-dashed border-zinc-300 hover:border-[#FF5533] bg-zinc-50/50 rounded-2xl p-8 text-center transition-all relative">
              <input
                type="file"
                accept=".csv, .xlsx"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-12 h-12 rounded-2xl bg-[#FF5533]/10 text-[#FF5533] flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#09090B]">
                {fileName ? fileName : 'Upload Excel (.xlsx) or CSV File'}
              </h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Drag and drop your contact spreadsheet, or click to browse files.
              </p>
              <div className="flex items-center justify-center space-x-2 text-[11px] text-zinc-400 mt-3">
                <span>Format: <code>name</code>, <code>company</code>, <code>phone</code>, <code>email</code>, <code>city</code>, <code>industry</code></span>
              </div>
            </div>

            <div className="flex items-center justify-between">

            </div>

            {isParsing && (
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-center text-xs font-semibold text-zinc-600">
                Parsing spreadsheet rows and validating phone numbers...
              </div>
            )}

            {validationResult && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                    <p className="text-[10px] text-zinc-500 uppercase font-semibold">Total Rows</p>
                    <p className="text-lg font-bold text-[#09090B]">{validationResult.total_rows}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-[10px] text-emerald-700 uppercase font-semibold">Valid Contacts</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {validationResult.valid_contacts.length}
                    </p>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                    <p className="text-[10px] text-rose-700 uppercase font-semibold">Invalid / Blocked</p>
                    <p className="text-lg font-bold text-rose-700">
                      {validationResult.invalid_rows.length}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-[10px] text-amber-700 uppercase font-semibold">Duplicates</p>
                    <p className="text-lg font-bold text-amber-700">
                      {validationResult.duplicate_rows.length}
                    </p>
                  </div>
                </div>

                {validationResult.invalid_rows.length > 0 && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-rose-900 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1 text-rose-600" />
                      Invalid Rows Bypassed ({validationResult.invalid_rows.length})
                    </p>
                    <ul className="list-disc list-inside text-rose-700 text-[11px] max-h-24 overflow-y-auto space-y-0.5">
                      {validationResult.invalid_rows.map((inv, idx) => (
                        <li key={idx}>
                          Row {inv.row_number}: {inv.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-700">
                      Valid Contacts Ready to Import ({validationResult.valid_contacts.length})
                    </span>
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Checked against Suppression
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-100/60 text-zinc-600 font-semibold border-b border-zinc-200">
                        <tr>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Company</th>
                          <th className="px-4 py-2">Validated Phone</th>
                          <th className="px-4 py-2">City</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {validationResult.valid_contacts.map((c, i) => (
                          <tr key={i} className="hover:bg-zinc-50">
                            <td className="px-4 py-2 font-semibold text-[#09090B]">{c.name}</td>
                            <td className="px-4 py-2 text-zinc-600">{c.company}</td>
                            <td className="px-4 py-2 font-mono text-zinc-800">{c.phone}</td>
                            <td className="px-4 py-2 text-zinc-500">{c.city || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center space-x-3 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importConfirmed}
                      onChange={e => setImportConfirmed(e.target.checked)}
                      className="w-4 h-4 text-[#FF5533] rounded focus:ring-0"
                    />
                    <span className="text-xs font-bold text-emerald-900">
                      Confirm importing {validationResult.valid_contacts.length} valid contacts for this campaign.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-[#09090B] mb-1.5">
                Select Base Message Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={e => handleTemplateSelect(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-[#FF5533] text-[#09090B]"
              >
                {templates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.category || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#09090B]">Template Message Content</label>
                <div className="flex items-center space-x-1">
                  {['{{first_name}}', '{{company}}', '{{city}}', '{{industry}}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setCustomTemplateContent(prev => prev + ' ' + tag)}
                      className="px-2 py-0.5 text-[10px] font-mono bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded border border-zinc-300 transition-colors"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={5}
                value={customTemplateContent}
                onChange={e => setCustomTemplateContent(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-sans focus:outline-none focus:border-[#FF5533] focus:bg-white text-[#09090B] leading-relaxed"
              />
            </div>

            <div className="bg-[#F5F4F2] border border-zinc-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-[#FF5533]" />
                  <span className="text-xs font-bold text-[#09090B]">
                    WhatsApp Message Preview
                  </span>
                </div>
                {validationResult && validationResult.valid_contacts.length > 1 && (
                  <div className="flex items-center space-x-2 text-xs text-zinc-500">
                    <span>Contact {previewContactIdx + 1} of {validationResult.valid_contacts.length}</span>
                    <button
                      type="button"
                      disabled={previewContactIdx === 0}
                      onClick={() => setPreviewContactIdx(p => p - 1)}
                      className="px-2 py-0.5 rounded bg-white border border-zinc-200 disabled:opacity-40"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      disabled={previewContactIdx >= validationResult.valid_contacts.length - 1}
                      onClick={() => setPreviewContactIdx(p => p + 1)}
                      className="px-2 py-0.5 rounded bg-white border border-zinc-200 disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>

              <div className="max-w-md bg-[#E2F7CB] text-[#09090B] p-3.5 rounded-2xl rounded-tl-none shadow-sm text-xs font-normal leading-relaxed whitespace-pre-wrap border border-emerald-200/60">
                {interpolatedPreview}
                <div className="text-[9px] text-zinc-500 text-right mt-1 font-mono">10:42 AM ✓✓</div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <h4 className="text-sm font-bold text-emerald-950 flex items-center">
                <Sparkles className="w-4 h-4 text-emerald-600 mr-2" /> Campaign Ready for Execution
              </h4>
              <p className="text-xs text-emerald-800 mt-1">
                Please double check all parameters before launching dispatches.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                <p className="font-bold text-[#09090B] uppercase tracking-wider text-[10px] text-zinc-500">
                  General Info & Schedule
                </p>
                <p><span className="text-zinc-500">Name:</span> <strong className="text-[#09090B]">{campaignName || 'Untitled'}</strong></p>
                <p><span className="text-zinc-500">Interval:</span> <strong>{sendingInterval} seconds</strong></p>
                <p><span className="text-zinc-500">Days:</span> <strong>{allowedDays.join(', ')}</strong></p>
                <p><span className="text-zinc-500">Window:</span> <strong>{startTime} - {endTime} ({timezone})</strong></p>
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                <p className="font-bold text-[#09090B] uppercase tracking-wider text-[10px] text-zinc-500">
                  Callset & Template
                </p>
                <p><span className="text-zinc-500">File:</span> <strong>{fileName || 'No file selected'}</strong></p>
                <p><span className="text-zinc-500">Confirmed Contacts:</span> <strong className="text-emerald-600">{validationResult?.valid_contacts.length || 0}</strong></p>
                <p><span className="text-zinc-500">Template:</span> <strong>{selectedTemplateId || 'Custom message'}</strong></p>
              </div>
            </div>

            <div className="p-4 bg-zinc-900 text-white rounded-2xl space-y-1">
              <p className="text-xs font-bold text-zinc-300">Message Preview Sample:</p>
              <p className="text-xs italic text-zinc-300">"{interpolatedPreview}"</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-zinc-100 pt-4 mt-6">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center space-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={submitting || isParsing || (step === 1 && !campaignName.trim()) || (step === 2 && (!uploadedFile || !validationResult?.valid_contacts.length || !importConfirmed)) || (step === 3 && !customTemplateContent.trim())}
              className="px-5 py-2.5 rounded-xl bg-[#09090B] hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || isParsing}
              onClick={handleLaunch}
              className="px-6 py-2.5 rounded-xl bg-[#FF5533] hover:bg-[#E64422] text-white text-xs font-bold shadow-md shadow-[#FF5533]/25 flex items-center space-x-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{submitting ? 'Creating…' : 'Create Campaign'}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
