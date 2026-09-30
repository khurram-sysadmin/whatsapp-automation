<?php
// Existing private configurations are reused; fresh installs initialize automatically.
$folder=dirname(__DIR__);
for($depth=0;$depth<10;$depth++){
 $path=$folder.'/eightbit-outreach-private/config.php';if(is_file($path))return $path;
 $parent=dirname($folder);if($parent===$folder)break;$folder=$parent;
}
return '';
