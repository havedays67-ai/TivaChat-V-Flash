import pathlib,re,sys
root=pathlib.Path('android/java/ir/tivachat/flash')
checks={
 'contact_permission': ('AndroidManifest.xml','android.permission.READ_CONTACTS'),
 'no_direct_call': ('ContactResolverActivity.java','ACTION_DIAL'),
 'no_call_action': ('MainActivity.java','ACTION_CALL'),
 'no_direct_delete': ('FloatingPanel.java','ACTION_DELETE'),
 'app_info': ('FloatingPanel.java','ACTION_APPLICATION_DETAILS_SETTINGS'),
 'media_picker': ('FloatingPanel.java','ACTION_OPEN_DOCUMENT'),
 'alarm_minutes': ('MainActivity.java','EXTRA_MINUTES'),
 'panel_no_fullscreen': ('FloatingPanel.java','FLAG_NOT_TOUCH_MODAL'),
}
fail=0
for name,(file,needle) in checks.items():
    path=pathlib.Path('android')/file if file=='AndroidManifest.xml' else root/file
    txt=path.read_text()
    ok=needle in txt
    if name=='no_call_action': ok=not ok
    if name=='no_direct_delete': ok=not ok
    print(('PASS' if ok else 'FAIL'),name,needle)
    fail += 0 if ok else 1
manifest=(pathlib.Path('android')/'AndroidManifest.xml').read_text()
for required in ['versionCode="4"','versionName="1.0.1"','targetSdkVersion="34"','minSdkVersion="28"']:
    ok=required in manifest
    print(('PASS' if ok else 'FAIL'),'manifest',required)
    fail += 0 if ok else 1
print('RESULT:', (str(fail)+' FAILED') if fail else 'ALL NATIVE CHECKS PASSED')
sys.exit(1 if fail else 0)
