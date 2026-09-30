<?php
require __DIR__.'/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='GET')respond(['success'=>false,'error'=>'GET required.'],405);
if(empty($_SESSION['user_id']))respond(['success'=>true,'authenticated'=>false,'setupRequired'=>setupRequired(),'csrfToken'=>$_SESSION['csrf']]);
$user=authenticated();respond(['success'=>true,'authenticated'=>true,'email'=>$user['email'],'csrfToken'=>$_SESSION['csrf']]);
