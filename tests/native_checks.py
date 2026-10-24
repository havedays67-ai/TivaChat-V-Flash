import os
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
for required in ['versionCode="5"','versionName="1.0.2"','targetSdkVersion="34"','minSdkVersion="28"']:
    ok=required in manifest
    print(('PASS' if ok else 'FAIL'),'manifest',required)
    fail += 0 if ok else 1
main_java=(root/'MainActivity.java').read_text()
assistant=(pathlib.Path('android/assets/assistant.html')).read_text()
extra=[]
extra.append(('open_camera_bridge', 'openCamera' in main_java, ''))
extra.append(('system_delete_dialog', 'MediaStore.createDeleteRequest' in main_java, ''))
extra.append(('uninstall_system_dialog', 'Intent.ACTION_DELETE' in main_java, ''))
extra.append(('no_silent_delete', 'createDeleteRequest' in main_java and 'contentResolver.delete(' not in main_java, ''))
extra.append(('aliases_file', pathlib.Path('android/assets/tiva_app_aliases.js').exists(), ''))
extra.append(('aliases_loaded', 'tiva_app_aliases.js' in assistant, ''))
extra.append(('confidence_gate', 'V102_GATED_TYPES' in assistant, ''))
extra.append(('noon_window', 'isNoon' in assistant, ''))
for name, ok, detail in extra:
    print(('PASS' if ok else 'FAIL'), name, detail)
    fail += 0 if ok else 1
print('RESULT:', (str(fail)+' FAILED') if fail else 'ALL NATIVE CHECKS PASSED')
sys.exit(1 if fail else 0)
