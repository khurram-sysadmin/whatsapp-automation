"""Recover only the browser-safe public key from the existing release."""
import base64,json,re,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
archive=root/'releases/WhatsApp-Automation-Automatic-Only-cPanel-ready.zip'
keys=set()
with zipfile.ZipFile(archive) as z:
 for name in z.namelist():
  if name.startswith('assets/') and name.endswith('.js'):
   text=z.read(name).decode('utf-8')
   assert 'https://lreolnewuapcurpskqwr.supabase.co' in text
   for key in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',text):
    try:
     payload=json.loads(base64.urlsafe_b64decode(key.split('.')[1]+'==='))
     if payload.get('role')=='anon' and payload.get('ref')=='lreolnewuapcurpskqwr':keys.add(key)
    except (ValueError,KeyError):pass
   keys.update(re.findall(r'sb_publishable_[A-Za-z0-9_-]+',text))
if len(keys)!=1:raise SystemExit('No unique browser-safe public key found. Production build stopped.')
example=(root/'.env.example').read_text(encoding='utf-8')
assert 'VITE_APP_URL=https://wamarketing.eightbitsolutions.com' in example
(root/'.env.production.local').write_text(example.replace('VITE_SUPABASE_PUBLISHABLE_KEY=','VITE_SUPABASE_PUBLISHABLE_KEY='+next(iter(keys)),1),encoding='utf-8')
print('Production build settings restored from existing release; verified public browser key only. No private key copied.')
