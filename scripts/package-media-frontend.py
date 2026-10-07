from pathlib import Path
import base64,hashlib,json,re,zipfile
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
release=root.parent/'WhatsApp-Automation-Workspace-Menu-Complete-2026-10-07-cPanel.zip'
files=[p for p in dist.rglob('*') if p.is_file() and (p.relative_to(dist).parts[0] in {'assets','third-party'} or p.relative_to(dist).as_posix() in {'index.html','.htaccess','favicon.svg','icons.svg','logo.jpg','lead-import-example.csv'})]
assert any(p.name=='.htaccess' for p in files)
required_services=['connect/wasender.php','connect/setup-core.php','webhooks/whatsapp.php']
for name in required_services:
 assert (dist/name).is_file(),f'Missing required server endpoint: {name}'
 files.append(dist/name)
index=(dist/'index.html').read_text(encoding='utf-8')
for asset in re.findall(r'(?:src|href)="\./(assets/[^\"]+)"',index):assert (dist/asset).is_file()
bundle='\n'.join(p.read_text(encoding='utf-8') for p in files if p.suffix=='.js')
for value in ['https://lreolnewuapcurpskqwr.supabase.co','https://wamarketing.eightbitsolutions.com','mediaSizeBytes','Asia/Riyadh','storage/v1/object/authenticated/outreach-media/']:assert value in bundle,value
assert not re.search(r'sb_secret_[A-Za-z0-9_-]{20,}',bundle)
for token in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',bundle):
 try: payload=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'==='))
 except ValueError: continue
 assert payload.get('role')!='service_role'
with zipfile.ZipFile(release,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files:z.write(p,p.relative_to(dist).as_posix())
with zipfile.ZipFile(release) as z:
 assert z.testzip() is None
 assert all(name in z.namelist() for name in required_services)
 assert all(not n.startswith('api/') for n in z.namelist())
manifest={'release':release.name,'sha256':hashlib.sha256(release.read_bytes()).hexdigest(),'files':[p.relative_to(dist).as_posix() for p in files],'supabase_media_compatibility_applied':True,'n8n_media_workflow_published':True,'supabase_template_media_applied':True,'supabase_template_delete_applied':True,'frontend_uploaded':False,'real_media_delivery_verified':False,'pricing_changes_deployed':False}
(root/'release-local/frontend-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(f'Verified complete ZIP: {release}\n{len(files)} public files including required connection and webhook endpoints. SHA256: {manifest["sha256"]}')
