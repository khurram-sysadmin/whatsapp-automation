<?php
require __DIR__.'/bootstrap.php';postOnly();$user=authenticated();$data=body();
if(time()-(int)($_SESSION['password_window']??0)>900){$_SESSION['password_window']=time();$_SESSION['password_attempts']=0;}
if((int)($_SESSION['password_attempts']??0)>=10)respond(['success'=>false,'error'=>'Too many attempts. Try again in 15 minutes.'],429);
$_SESSION['password_attempts']=(int)($_SESSION['password_attempts']??0)+1;$current=$data['currentPassword']??null;$new=$data['newPassword']??null;
if(!is_string($current)||!is_string($new)||strlen($current)>72||strlen($new)<12||strlen($new)>72||$current===$new)respond(['success'=>false,'error'=>'Use a different password of 12–72 bytes.'],400);
$db->exec('BEGIN IMMEDIATE');$q=$db->prepare('SELECT password_hash FROM users WHERE id=?');$q->execute([$user['id']]);$hash=$q->fetchColumn();if(!password_verify($current,$hash)){$db->exec('ROLLBACK');respond(['success'=>false,'error'=>'Current password is incorrect.'],400);}$q=$db->prepare('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?');$q->execute([password_hash($new,PASSWORD_DEFAULT,['cost'=>12]),$user['id']]);$db->exec('COMMIT');invalidate();respond(['success'=>true]);
