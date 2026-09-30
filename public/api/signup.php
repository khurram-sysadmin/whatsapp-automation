<?php
require __DIR__.'/bootstrap.php';postOnly();$data=body();
$username=is_string($data['username']??null)?strtolower(trim($data['username'])):'';
$password=$data['password']??null;
if(!preg_match('/^[a-z0-9][a-z0-9_.-]{2,63}$/i',$username))respond(['success'=>false,'error'=>'Choose a username of 3–64 letters, numbers, dots, underscores or hyphens.'],400);
if(!is_string($password)||strlen($password)<12||strlen($password)>72)respond(['success'=>false,'error'=>'Choose a password of 12–72 bytes.'],400);
// Lock before checking: concurrent first visits cannot create a second administrator.
$db->exec('BEGIN IMMEDIATE');
if(!setupRequired()){$db->exec('ROLLBACK');respond(['success'=>false,'error'=>'The admin account already exists. Sign in instead.'],409);}
try{
 $q=$db->prepare('INSERT INTO users(email,password_hash) VALUES(?,?)');$q->execute([$username,password_hash($password,PASSWORD_DEFAULT,['cost'=>12])]);
 $id=(int)$db->lastInsertId();$db->exec('COMMIT');
}catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
session_regenerate_id(true);$now=time();$_SESSION=['user_id'=>$id,'session_version'=>1,'created_at'=>$now,'last_active'=>$now,'csrf'=>bin2hex(random_bytes(32))];
respond(['success'=>true,'email'=>$username,'csrfToken'=>$_SESSION['csrf']]);
