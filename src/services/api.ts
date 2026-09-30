import type { Campaign, Contact, Template, OutboundMessage, ConversationReply, SuppressionNumber, AppSettings, DashboardKPIs, ImportValidationResult } from '../types';
import { defaults, text, lower, object, array, validUUID, normalizeCampaign, normalizeStats, normalizeContact, normalizeMessage, normalizeReplies, normalizeTemplate, normalizeSuppression } from './normalize';
export const isValidUUID = validUUID;
export class ApiError extends Error { status:number;requestId?:string;constructor(message:string,status=0,requestId?:string){super(message);this.name='ApiError';this.status=status;this.requestId=requestId;} }
const base = new URL('../', import.meta.url);
const endpoint = (file: string) => new URL('api/'+file,base).href;
let csrf='';
const inflight=new Map<string,Promise<any>>();
const writeActions=new Set(['create','start','pause','resume','stop','delete','saveTemplate','deleteTemplate','suppress','import']);
const requestId=()=>crypto.randomUUID();
export class ApiService {
 static async request(file: string, payload?: unknown, method='POST'): Promise<any> {
  const headers: Record<string,string>={}; if(payload!==undefined)headers['Content-Type']='application/json';if(method!=='GET')headers['X-CSRF-Token']=csrf;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),35000);
  try { const response=await fetch(endpoint(file),{method,headers,credentials:'same-origin',cache:'no-store',body:payload===undefined?undefined:JSON.stringify(payload),signal:controller.signal});
   let data: any;try{data=await response.json();}catch{throw new ApiError('The server returned an invalid response. Please retry.',response.status);}
   if(response.status===401 && file!=='session.php')window.dispatchEvent(new Event('outreach-session-expired'));
   if(!response.ok || object(data).success!==true)throw new ApiError(text(object(data).error)||'The request failed. Please retry.',response.status,text(object(payload).requestId));
   if(typeof data.csrfToken==='string')csrf=data.csrfToken;
   return data;
  }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(e instanceof Error && e.name==='AbortError'?'Request timed out. Refresh before retrying a write.':'Unable to reach the server. Please retry.',0,text(object(payload).requestId));}
  finally{clearTimeout(timer);}
 }
 static async session(){let data;try{data=await this.request('session.php',undefined,'GET');}catch(e){if(!(e instanceof ApiError)||e.status!==401)throw e;data=await this.request('session.php',undefined,'GET');}return {authenticated:data.authenticated===true,setupRequired:data.setupRequired===true,email:text(data.email)};}
 static async signup(username:string,password:string){return this.request('signup.php',{username,password});}
 static async login(email:string,password:string){return this.request('login.php',{email,password});}
 static async logout(){try{await this.request('logout.php',{});}finally{csrf='';}}
 static async connection(){return this.request('connection.php',undefined,'GET');}
 static async saveConnection(key:string,apiUrl?:string){return this.request('connection.php',{key,apiUrl});}
 static async testConnection(){const result=await this.request('connection.php',{mode:'test'});return object(result.data);}
 static async changePassword(currentPassword:string,newPassword:string){return this.request('password.php',{currentPassword,newPassword});}
 static async postAction(action:string,payload:Record<string,unknown>={}):Promise<any>{
  if(['detail','messages','start','pause','resume','stop','delete','import'].includes(action)&&!validUUID(payload.campaignId))throw new ApiError('A valid backend campaign ID is required.');
  const body={...payload,action,...(writeActions.has(action)?{requestId:payload.requestId || requestId()}: {})};
  const key=JSON.stringify(body);if(inflight.has(key))return inflight.get(key);
  const pending=this.request('proxy.php',body);inflight.set(key,pending);try{return await pending;}finally{inflight.delete(key);}
 }
 static async checkHealth(){try{await this.postAction('health');return {success:true,message:'Backend is reachable.'};}catch(e){return {success:false,message:e instanceof Error?e.message:'Backend unavailable.'};}}
 static async fetchSettings():Promise<AppSettings>{const data=await this.request('settings.php',undefined,'GET');return {...defaults,...object(data.data),n8n_api_key:'',n8n_webhook_url:'',api_base_url:''};}
 static async saveSettings(settings:AppSettings):Promise<AppSettings>{const data=await this.request('settings.php',{default_sending_interval:settings.default_sending_interval,default_timezone:settings.default_timezone,default_start_time:settings.default_start_time,default_end_time:settings.default_end_time});return {...defaults,...object(data.data)};}
 static async pages(action:string,extra:Record<string,unknown>={}):Promise<any[]> {const all:any[]=[];for(let offset=0;offset<100000;offset+=200){const result=await this.postAction(action,{...extra,limit:200,offset});if(!Array.isArray(result.data))throw new ApiError('Invalid '+action+' response. Previous data has been retained.');const rows=array(result.data);all.push(...rows);if(result.data.length<200)return all;}throw new ApiError('Too many records to load.');}
 static async fetchDashboardKPIs():Promise<DashboardKPIs>{const r=await this.postAction('stats');const data=r.data ?? r.stats;if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError('Invalid statistics response. Previous data has been retained.');const stats=normalizeStats(data);if(object(data).total_campaigns===undefined||object(data).active_campaigns===undefined){const campaigns=await this.pages('list');stats.total_campaigns=campaigns.length;stats.active_campaigns=campaigns.filter(c=>lower(c.status)==='running').length;}return stats;}
 static async fetchCampaigns():Promise<Campaign[]>{return (await this.pages('list')).map(v=>normalizeCampaign(v)).filter(c=>validUUID(c.id));}
 static async fetchCampaignById(id:string):Promise<Campaign>{const r=await this.postAction('detail',{campaignId:id});const value=r.data ?? r.campaign;if(!validUUID(object(value).id ?? object(value).campaignId))throw new ApiError('Invalid campaign detail response.');return normalizeCampaign(value,r.statistics);}
 static async fetchCampaignStats(id:string){const r=await this.postAction('stats',{campaignId:id});return object(r.data ?? r.stats);}
 static validateCampaign(data:Record<string,any>):void{
  if(!text(data.name).trim() || text(data.name).trim().length>200)throw new ApiError('Enter a campaign name of 1–200 characters.');
  const template=text(data.custom_template_content ?? data.template);if(!template.trim() || template.length>4096)throw new ApiError('Enter a message template of 1–4096 characters.');
  const allowed=['name','first_name','company','phone','email','city','industry'];const remaining=template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g,(_,key)=>{if(!allowed.includes(key))throw new ApiError('Unsupported template variable: '+key);return '';});if(/\{\{|\}\}/.test(remaining))throw new ApiError('Malformed template variable.');
  try{new Intl.DateTimeFormat('en',{timeZone:text(data.timezone)}).format();}catch{throw new ApiError('Select a valid IANA timezone.');}if(!text(data.timezone))throw new ApiError('Timezone is required.');
  for(const k of ['start_time','end_time'])if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(text(data[k])))throw new ApiError('Use HH:mm for the sending window.');
  if(data.start_time===data.end_time)throw new ApiError('Sending start and end times must be different.');
  if(!Number.isInteger(Number(data.sending_interval)) || Number(data.sending_interval)<15 || Number(data.sending_interval)>86400)throw new ApiError('Send interval must be 15–86400 seconds.');
 }
 static async createCampaign(data:Record<string,any>):Promise<Campaign>{this.validateCampaign(data);const r=await this.postAction('create',{name:text(data.name).trim(),template:text(data.custom_template_content ?? data.template),timezone:data.timezone,sendingStartTime:data.start_time,sendingEndTime:data.end_time,sendIntervalSeconds:Number(data.sending_interval)});if(!validUUID(r.campaignId))throw new ApiError('The backend did not return a valid campaign ID.');return this.fetchCampaignById(r.campaignId);}
 static async importFile(campaignId:string,file:File){if(!validUUID(campaignId))throw new ApiError('A valid campaign ID is required.');if(!/\.(csv|xlsx)$/i.test(file.name)||file.size>5*1024*1024)throw new ApiError('Upload a CSV or XLSX file of up to 5 MB.');const form=new FormData();form.append('file',file);const url=new URL(endpoint('import.php'));url.searchParams.set('campaignId',campaignId);url.searchParams.set('requestId',requestId());url.searchParams.set('phoneFormat','international');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);try{const response=await fetch(url,{method:'POST',headers:{'X-CSRF-Token':csrf},credentials:'same-origin',body:form,signal:controller.signal});const data=await response.json();if(response.status===401)window.dispatchEvent(new Event('outreach-session-expired'));if(!response.ok||object(data).success!==true)throw new ApiError(text(object(data).error)||'Import failed.',response.status);return data;}catch(e){if(e instanceof ApiError)throw e;throw new ApiError('Import could not be confirmed. Refresh the campaign before retrying.');}finally{clearTimeout(timer);}}
 static async updateCampaignStatus(id:string,action:string){await this.postAction(action,{campaignId:id});return this.fetchCampaignById(id);}
 static async deleteCampaign(id:string){
  try{return await this.postAction('delete',{campaignId:id});}
  catch(e){
   if(e instanceof ApiError && e.status===404)return {success:true,deleted:true,campaignId:id};
   if(e instanceof ApiError && [0,502,503,504].includes(e.status)){
    try{await this.fetchCampaignById(id);}catch(check){if(check instanceof ApiError && check.status===404)return {success:true,deleted:true,campaignId:id};}
   }
   throw e;
  }
 }
 static async fetchContacts():Promise<Contact[]>{return (await this.pages('contacts')).map(normalizeContact);}
 static async addContacts(contacts:unknown[],campaignId?:string){if(!validUUID(campaignId))throw new ApiError('Select a draft campaign before adding a contact.');return this.postAction('import',{campaignId,contacts});}
  static validatePhone(phoneRaw: string): boolean {
    if (!phoneRaw) return false;
    const cleaned = text(phoneRaw).replace(/[\s\-\(\)\+]/g, '');
    return /^[1-9]\d{7,14}$/.test(cleaned);
  }

  static validateImportData(rows: Record<string, any>[], suppressionList: SuppressionNumber[]): ImportValidationResult {
    const valid_contacts: Omit<Contact, 'id' | 'created_at' | 'status'>[] = [];
    const invalid_rows: ImportValidationResult['invalid_rows'] = [];
    const duplicate_rows: ImportValidationResult['duplicate_rows'] = [];
    const phoneSeen = new Set<string>();

    const suppressedSet = new Set(array(suppressionList).map(s => text(s.phone).replace(/[\s\-\(\)\+]/g, '')));

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const normalizedRow: Record<string, any> = {};
      Object.keys(object(row)).forEach(k => {
        normalizedRow[lower(k).replace(/^\uFEFF/,'').trim().replace(/\s+/g,'_')] = object(row)[k];
      });

      const name = text(normalizedRow['name']);
      const company = text(normalizedRow['company']);
      const phoneRaw = text(normalizedRow['phone']).trim();
      const email = normalizedRow['email'] || '';
      const city = normalizedRow['city'] || normalizedRow['location'] || '';
      const industry = normalizedRow['industry'] || normalizedRow['sector'] || '';

      if (typeof normalizedRow['phone']!=='string') {invalid_rows.push({row_number:rowNum,raw_data:object(row),reason:'Format phone cells as Text with an international country code.'});return;}
      if (!phoneRaw) {
        invalid_rows.push({
          row_number: rowNum,
          raw_data: row,
          reason: 'Missing phone number field',
        });
        return;
      }

      if (!this.validatePhone(phoneRaw)) {
        invalid_rows.push({
          row_number: rowNum,
          raw_data: row,
          reason: `Invalid phone format: "${phoneRaw}". Must contain 10-15 digits.`,
        });
        return;
      }

      const cleanPhone = phoneRaw.replace(/[\s\-\(\)\+]/g, '');
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

      if (suppressedSet.has(cleanPhone)) {
        invalid_rows.push({
          row_number: rowNum,
          raw_data: row,
          reason: `Phone number ${phoneRaw} is on the Suppression/Opt-Out list.`,
        });
        return;
      }

      if (phoneSeen.has(cleanPhone)) {
        duplicate_rows.push({
          row_number: rowNum,
          phone: phoneRaw,
          reason: 'Duplicate phone number found in uploaded sheet.',
        });
        return;
      }

      phoneSeen.add(cleanPhone);

      const nameParts = text(name).trim().split(/\s+/);
      const firstName = nameParts[0] || 'There';

      valid_contacts.push({
        name: name || firstName,
        first_name: firstName,
        company: company || 'your company',
        phone: formattedPhone,
        email,
        city,
        industry,
      });
    });

    return {
      valid_contacts,
      invalid_rows,
      duplicate_rows,
      total_rows: rows.length,
    };
  }


 static async fetchTemplates():Promise<Template[]>{return (await this.pages('templates')).map(normalizeTemplate);}
 static async createTemplate(tpl:Omit<Template,'id'|'created_at'>):Promise<Template>{const result=await this.postAction('saveTemplate',{name:tpl.name,template:tpl.content});if(!validUUID(result.templateId))throw new ApiError('Invalid template ID returned by backend.');return normalizeTemplate({...tpl,id:result.templateId});}
 static async updateTemplate(id:string,tpl:Partial<Template>):Promise<Template>{const list=await this.fetchTemplates();const old=list.find(t=>t.id===id);if(!old)throw new ApiError('Template not found.');const value={...old,...tpl};return this.createTemplate(value);}
 static async deleteTemplate(id:string){if(!validUUID(id))throw new ApiError('Invalid template ID.');return this.postAction('deleteTemplate',{templateId:id});}
 static async fetchMessages(id?:string,limit=100,offset=0):Promise<OutboundMessage[]>{if(!validUUID(id))throw new ApiError('Select a valid campaign to load messages.');const r=await this.postAction('messages',{campaignId:id,limit,offset});if(!Array.isArray(r.data))throw new ApiError('Invalid messages response.');return array(r.data).map(v=>normalizeMessage(v,id));}
 static async fetchReplies():Promise<ConversationReply[]>{return normalizeReplies(await this.pages('replies'));}
 static async sendReply(_id:string,_message:string):Promise<ConversationReply>{throw new ApiError('Sending inbox replies is not available. Incoming replies remain visible.');}
 static async fetchSuppressionList():Promise<SuppressionNumber[]>{return (await this.pages('suppressions')).map(normalizeSuppression);}
 static async addSuppressionNumber(item:Omit<SuppressionNumber,'id'|'added_at'>){await this.postAction('suppress',{phone:item.phone,reason:item.reason});return normalizeSuppression(item);}
 static async removeSuppressionNumber(_id:string){throw new ApiError('Opt-out removal requires an authorized backend operation.');}
 static interpolateTemplate(content:string,variables:Record<string,string>):string{return text(content).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi,(_,key)=>text(variables[key]));}
}
