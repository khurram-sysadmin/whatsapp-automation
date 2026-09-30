import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, type NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ToastProvider, useToast } from './components/ui/Toast';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';
import { ContactsPage } from './pages/ContactsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { MessagesPage } from './pages/MessagesPage';
import { RepliesPage } from './pages/RepliesPage';
import { SuppressionPage } from './pages/SuppressionPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CampaignWizardModal } from './components/campaigns/CampaignWizardModal';
import type {
  Campaign,
  Contact,
  Template,
  OutboundMessage,
  ConversationReply,
  SuppressionNumber,
  AppSettings,
  DashboardKPIs
} from './types';
import { ApiService } from './services/api';
import { Logger } from './utils/logger';
import { defaults, normalizeStats, validUUID } from './services/normalize';

const VALID_TABS: NavTab[] = [
  'dashboard',
  'campaigns',
  'contacts',
  'templates',
  'messages',
  'replies',
  'suppression',
  'settings',
];

const getTabFromURL = (): NavTab | 'not_found' => {
  const basePath = new URL('../', import.meta.url).pathname;
  const pathname = window.location.pathname;
  const relativePath = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  const path = relativePath.replace(/^\/+|\/+$/g, '').replace(/^index\.html$/i, '').toLowerCase();
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  const target = hash || path;
  if (!target) return 'dashboard';
  if (VALID_TABS.includes(target as NavTab)) return target as NavTab;
  return 'not_found';
};

const AppContent: React.FC = () => {
  const { showSuccess, showError } = useToast();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [setupRequired,setSetupRequired]=useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const authRef = useRef(false);
  const aliveRef = useRef(true);
  const refreshRef = useRef<Promise<void> | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab | 'not_found'>(getTabFromURL);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(()=>{const id=new URL(window.location.href).searchParams.get('campaignId');return validUUID(id)?id:null;});
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() => ({ ...defaults }));
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messages, setMessages] = useState<OutboundMessage[]>([]);
  const [replies, setReplies] = useState<ConversationReply[]>([]);
  const [suppressionList, setSuppressionList] = useState<SuppressionNumber[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs>({
    total_campaigns: 0,
    active_campaigns: 0,
    total_contacts: 0,
    queued_messages: 0,
    sent_messages: 0,
    delivered_messages: 0,
    read_messages: 0,
    replied_messages: 0,
    failed_messages: 0,
    opted_out_contacts: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refreshAllData = useCallback(async () => {
    if (refreshRef.current) return refreshRef.current;
    if (!authRef.current) return;
    const task = (async () => {
      setIsRefreshing(true);
      const results = await Promise.allSettled([
        ApiService.fetchSettings(), ApiService.fetchCampaigns(), ApiService.fetchContacts(),
        ApiService.fetchTemplates(), ApiService.fetchReplies(), ApiService.fetchSuppressionList(), ApiService.fetchDashboardKPIs(),
      ]);
      if (!aliveRef.current || !authRef.current) return;
      const setters = [setSettings,setCampaigns,setContacts,setTemplates,setReplies,setSuppressionList,setKpis] as Array<(value: any) => void>;
      const failures: string[]=[];
      results.forEach((result,i)=>{if(result.status==='fulfilled')setters[i](result.value);else failures.push(['Settings','Campaigns','Contacts','Templates','Replies','Suppression list','Statistics'][i]+': '+(result.reason instanceof Error?result.reason.message:'Unable to refresh this section.'));});
      setFetchError(failures.length ? [...new Set(failures)].join(' ') : null);
      setIsLoading(false);setIsRefreshing(false);
    })();
    refreshRef.current=task;
    try { await task; } finally { refreshRef.current=null; }
  }, []);

  const checkSession = useCallback(async () => {
    setSessionLoading(true);setSessionError(null);
    try { const session=await ApiService.session();if(!aliveRef.current)return;authRef.current=session.authenticated;setIsAuthenticated(session.authenticated);setSetupRequired(session.setupRequired); }
    catch(e){if(aliveRef.current)setSessionError(e instanceof Error?e.message:'Session verification failed.');}
    finally{if(aliveRef.current)setSessionLoading(false);}
  },[]);
  useEffect(()=>{
    aliveRef.current=true;
    // Remove the previous prototype's browser authentication, secrets and mock caches.
    try { for(const key of ['eightbit_auth','eightbit_settings','eightbit_campaigns','eightbit_contacts','eightbit_templates','eightbit_messages','eightbit_replies','eightbit_suppression'])localStorage.removeItem(key); }catch{}
    void checkSession();
    const expired=()=>{authRef.current=false;setIsAuthenticated(false);setSelectedCampaignId(null);setCampaigns([]);setContacts([]);setMessages([]);setReplies([]);setTemplates([]);setSuppressionList([]);setKpis(normalizeStats({}));setSettings({...defaults});setFetchError(null);setIsLoading(true);setIsRefreshing(false);void checkSession();};
    window.addEventListener('outreach-session-expired',expired);
    return ()=>{aliveRef.current=false;window.removeEventListener('outreach-session-expired',expired);};
  },[checkSession]);
  useEffect(()=>{const updated=async()=>{if(refreshRef.current)await refreshRef.current;await refreshAllData();};window.addEventListener('outreach-connection-updated',updated);return ()=>window.removeEventListener('outreach-connection-updated',updated);},[refreshAllData]);
  useEffect(() => {
    Logger.appMounted();
    const syncRoute = () => {
      const currentTab = getTabFromURL();
      setActiveTab(currentTab);
    };

    syncRoute();
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{if(cancelled)return;if(document.visibilityState==='visible')await refreshAllData();if(!cancelled)timer=setTimeout(poll,30000);};
    void poll();return ()=>{cancelled=true;clearTimeout(timer);};
  }, [isAuthenticated, refreshAllData]);

  useEffect(()=>{
    if(!isAuthenticated||activeTab!=='messages')return;
    let cancelled=false;let timer:ReturnType<typeof setTimeout>;
    const load=async()=>{if(cancelled)return;try{const groups=await Promise.all(campaigns.map(c=>ApiService.fetchMessages(c.id,100,0)));if(!cancelled)setMessages(groups.flat());}catch(e){if(!cancelled)setFetchError(e instanceof Error?e.message:'Message refresh failed.');}finally{if(!cancelled)timer=setTimeout(load,30000);}};
    void load();return ()=>{cancelled=true;clearTimeout(timer);};
  },[isAuthenticated,activeTab,campaigns]);

  const handleLoginSuccess = (_email: string) => {
    authRef.current=true;setIsAuthenticated(true);setIsLoading(true);
  };
  const handleLogout = async () => {
    try{await ApiService.logout();authRef.current=false;setIsAuthenticated(false);setCampaigns([]);setMessages([]);setReplies([]);setSelectedCampaignId(null);void checkSession();showSuccess('Signed Out','Your session has been closed.');}
    catch(e){showError('Sign Out Failed',e instanceof Error?e.message:'Please retry.');}
  };

  const handleCampaignCreated = async (newCmpData: any) => {
    const newCampaign = await ApiService.createCampaign(newCmpData);
    // Keep the real draft accessible if its import fails; never silently create another campaign.
    setCampaigns(prev=>[newCampaign,...prev.filter(c=>c.id!==newCampaign.id)]);
    setSelectedCampaignId(newCampaign.id);setActiveTab('campaigns');
    if(newCmpData.file){const result=await ApiService.importFile(newCampaign.id,newCmpData.file);showSuccess('Contacts Imported',`${Number(result.imported)||0} imported; ${Number(result.duplicates)||0} duplicates; ${Number(result.suppressed)||0} suppressed.`);}
    await refreshAllData();showSuccess('Campaign Created','Review the imported contacts and select Start when ready.');
  };
  const handleDeleteCampaign = async (id:string) => {
    await ApiService.deleteCampaign(id);
    // Drain an older refresh before removing the campaign so it cannot restore stale data.
    if(refreshRef.current)await refreshRef.current;
    setCampaigns(prev=>prev.filter(c=>c.id!==id));setMessages(prev=>prev.filter(m=>m.campaign_id!==id));setSelectedCampaignId(null);const cleanUrl=new URL(window.location.href);cleanUrl.searchParams.delete('campaignId');window.history.replaceState(null,'',cleanUrl);await refreshAllData();showSuccess('Campaign Deleted','The campaign has been removed.');
  };

  const handleUpdateCampaignStatus = async (id: string, status: Campaign['status']) => {
    try {
      await ApiService.updateCampaignStatus(id, status);
      await refreshAllData();
    } catch (err: any) {
      throw err;
    }
  };

  const handleAddContact = async (cData: Omit<Contact, 'id' | 'created_at' | 'status'>, campaignId?: string) => {
    await ApiService.addContacts([cData],campaignId);
    await refreshAllData();
  };

  const handleCreateTemplate = async (tpl: Omit<Template, 'id' | 'created_at'>) => {
    await ApiService.createTemplate(tpl);
    await refreshAllData();
  };

  const handleUpdateTemplate = async (id: string, tpl: Partial<Template>) => {
    await ApiService.updateTemplate(id, tpl);
    await refreshAllData();
  };

  const handleDeleteTemplate = async (id: string) => {
    await ApiService.deleteTemplate(id);
    await refreshAllData();
  };

  const handleSendReply = async (convId: string, text: string) => {
    await ApiService.sendReply(convId, text);
    await refreshAllData();
  };

  const handleAddSuppression = async (item: Omit<SuppressionNumber, 'id' | 'added_at'>) => {
    await ApiService.addSuppressionNumber(item);
    await refreshAllData();
  };

  const handleRemoveSuppression = async (id: string) => {
    await ApiService.removeSuppressionNumber(id);
    await refreshAllData();
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await ApiService.saveSettings(newSettings);
    setSettings(newSettings);
    await refreshAllData();
  };

  if(sessionLoading)return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]" role="status">Verifying your session…</div>;
  if(sessionError)return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-6"><div className="bg-white rounded-2xl border p-6 max-w-md"><h1 className="font-bold">Unable to connect</h1><p className="my-4 text-sm">{sessionError}</p><button onClick={checkSession} className="bg-[#FF5533] text-white rounded-lg px-4 py-2">Retry</button></div></div>;
  if (!isAuthenticated) return <LoginPage setupRequired={setupRequired} onSetupTaken={()=>void checkSession()} onLoginSuccess={handleLoginSuccess} />;

  const unreadRepliesCount = replies.reduce((acc, r) => acc + (r.unread_count || 0), 0);

  const activeCampaignDetail = selectedCampaignId
    ? campaigns.find(c => c.id === selectedCampaignId)
    : null;

  const handleTabChange = (tab: NavTab) => {
    setSelectedCampaignId(null);
    const cleanUrl=new URL(window.location.href);cleanUrl.searchParams.delete('campaignId');window.history.replaceState(null,'',cleanUrl);
    setActiveTab(tab);
    if (window.location.hash !== `#${tab}`) {
      window.history.pushState(null, '', `#${tab}`);
    }
  };

  const currentTabName = activeTab === 'not_found' ? 'dashboard' : activeTab;

  return (
    <div className="min-h-screen bg-[#F5F4F2] text-[#09090B] flex">
      <Sidebar
        activeTab={currentTabName}
        onTabChange={handleTabChange}
        unreadCount={unreadRepliesCount}
        settings={settings}
        onLogout={handleLogout}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
      />

      <div className="flex-1 min-w-0 md:pl-64 flex flex-col min-h-screen">
        <Header
          activeTab={currentTabName}
          onOpenMobile={() => setIsOpenMobile(true)}
          onNewCampaign={() => setIsWizardOpen(true)}
          settings={settings}
          onRefreshData={refreshAllData}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-8">
          {fetchError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{fetchError} <button className="font-bold underline" onClick={refreshAllData}>Retry</button></div>}
          {activeTab === 'not_found' && (
            <NotFoundPage onGoHome={() => handleTabChange('dashboard')} />
          )}

          {activeTab === 'dashboard' && (
            <DashboardPage
              kpis={kpis}
              recentCampaigns={campaigns.slice(0, 5)}
              onNavigateTab={handleTabChange}
              onSelectCampaign={id => {
                handleTabChange('campaigns');
                setSelectedCampaignId(id);const url=new URL(window.location.href);url.searchParams.set('campaignId',id);window.history.replaceState(null,'',url);
              }}
              isLoading={isLoading}
              error={fetchError}
              onRetry={refreshAllData}
            />
          )}

          {activeTab === 'campaigns' && (
            activeCampaignDetail ? (
              <CampaignDetailPage
                campaign={activeCampaignDetail}
                messages={messages}
                onBack={() => handleTabChange('campaigns')}
                onUpdateStatus={handleUpdateCampaignStatus}
                onDelete={handleDeleteCampaign}
              />
            ) : (
              <CampaignsPage
                campaigns={campaigns}
                onOpenWizard={() => setIsWizardOpen(true)}
                onSelectCampaign={id => {setSelectedCampaignId(id);const url=new URL(window.location.href);url.searchParams.set('campaignId',id);window.history.replaceState(null,'',url);}}
                isLoading={isLoading}
                error={fetchError}
                onRetry={refreshAllData}
              />
            )
          )}

          {activeTab === 'contacts' && (
            <ContactsPage contacts={contacts} campaigns={campaigns} onAddContact={handleAddContact} />
          )}

          {activeTab === 'templates' && (
            <TemplatesPage
              templates={templates}
              onCreateTemplate={handleCreateTemplate}
              onUpdateTemplate={handleUpdateTemplate}
              onDeleteTemplate={handleDeleteTemplate}
            />
          )}

          {activeTab === 'messages' && <MessagesPage messages={messages} />}

          {activeTab === 'replies' && (
            <RepliesPage
              replies={replies}
              onSendReply={handleSendReply}
              onAddToSuppression={async (phone, name) => {
                await handleAddSuppression({
                  phone,
                  contact_name: name,
                  reason: 'opt_out',
                  added_by: 'Inbox Operator',
                  notes: 'Suppressed via WhatsApp Inbox',
                });
              }}
            />
          )}

          {activeTab === 'suppression' && (
            <SuppressionPage
              suppressionList={suppressionList}
              onAddSuppression={handleAddSuppression}
              onRemoveSuppression={handleRemoveSuppression}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      <CampaignWizardModal
        key={isWizardOpen ? 'open' : 'closed'}
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        templates={templates}
        suppressionList={suppressionList}
        onCampaignCreated={handleCampaignCreated}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
