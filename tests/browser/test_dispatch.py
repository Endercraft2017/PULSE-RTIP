"""Playwright regressions for dispatch workflows.

Run with Node 22 on PATH and Python Playwright installed:
    python3 -m unittest discover -s tests/browser -v
CHROMIUM_EXECUTABLE may select a system browser; otherwise Playwright's Chromium
is used. Every run creates its own SQLite DB, users, server and synthetic region.
External browser requests are blocked; Bundled Leaflet runs in Chromium; external tile requests are stubbed.
"""
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import unittest
from urllib.parse import urlparse
from urllib.request import urlopen

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'test-results' / 'playwright'
PASSWORD = 'Browser-test-only-2026!'
MAP_INSTRUMENT = """() => {
    window.mapStats = { created: 0, updates: 0, markers: [] };
    const original = L.marker;
    L.marker = function(position, options) {
        const marker = original(position, options);
        marker.draggable = !!options?.draggable;
        marker.events = {};
        const on = marker.on;
        marker.on = function(event, callback, context) {
            if (event === 'dragstart') this.events.dragstart = () => marker.fire('dragstart');
            if (event === 'dragend') this.events.dragend = e => {
                marker.setLatLng({lat:e.latLng.lat(),lng:e.latLng.lng()});
                marker.fire('dragend');
            };
            return on.call(this, event, callback, context);
        };
        const move = marker.setLatLng;
        marker.setLatLng = function(p) { mapStats.updates++; return move.call(this,p); };
        Object.defineProperty(marker, 'position', {get:()=>marker.getLatLng()});
        mapStats.created++; mapStats.markers.push(marker);
        return marker;
    };
}"""


class DispatchBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        cls.results = []
        cls.temp = tempfile.TemporaryDirectory(prefix='pulse-playwright-')
        cls.folder = Path(cls.temp.name)
        cls.database = cls.folder / 'browser.db'
        cls.boundary = cls.folder / 'territory.json'
        polygon = lambda x1,y1,x2,y2: {'type':'Polygon','coordinates':[[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]]]}
        cls.policy = {'type':'FeatureCollection','properties':{'jurisdiction':'PH-RIZ-MORONG','source':'synthetic test fixture, not for deployment','approved_by':'TEST ONLY','approved_at':'2026-10-25','version':'test-1'},'features':[
            {'type':'Feature','properties':{'mode':'allow','name':'Morong synthetic browser territory'},'geometry':polygon(120,13,123,16)},
            {'type':'Feature','properties':{'mode':'deny','name':'Excluded synthetic area'},'geometry':polygon(121,14,122,15)}]}
        cls.boundary.write_text(json.dumps(cls.policy))
        cls.node = shutil.which('node')
        if not cls.node or not subprocess.check_output([cls.node,'--version'],text=True).startswith('v22.'):
            raise RuntimeError('Activate Node 22 before running the browser suite.')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0)); port = sock.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}'
        env = {**os.environ,'APP_MODE':'offline','SQLITE_PATH':str(cls.database),'PORT':str(port),
               'JWT_SECRET':'isolated-playwright-test-signing-key','TRUST_PROXY':'0',
               'TERRITORY_GEOJSON_PATH':str(cls.boundary),'GOOGLE_MAPS_BROWSER_KEY':'',
               'TEXTBEE_API_KEY':'','TEXTBEE_DEVICE_ID':'','FIREBASE_SERVICE_ACCOUNT_PATH':'','FIREBASE_SERVICE_ACCOUNT_JSON':''}
        subprocess.run([cls.node,'src/database/migrations/migrate.js'],cwd=ROOT,env=env,check=True,capture_output=True)
        seed = """
const db=require('./src/backend/config/database');
const bcrypt=require('./src/backend/node_modules/bcryptjs');
(async()=>{
 const hash=await bcrypt.hash(process.argv[1],4);
 for (const [id,name,role,department] of [[1,'admin','admin','MDRRMO'],[2,'citizen','citizen',null],[3,'other','citizen',null]]) {
   await db.query('INSERT INTO users (id,name,email,password_hash,role,department,phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
     [id,name,name+'@browser.test',hash,role,department,'0917000000'+id]);
 }
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
"""
        subprocess.run([cls.node,'-e',seed,PASSWORD],cwd=ROOT,env=env,check=True,capture_output=True)
        cls.log = open(ARTIFACTS/'server.log','w')
        boot = "require.cache[require.resolve('./src/backend/services/geocode/nominatim')]={exports:{reverseGeocode:async()=> 'Accepted test area'}};require('./src/backend/server');"
        cls.server = subprocess.Popen([cls.node,'-e',boot],cwd=ROOT,env=env,stdout=cls.log,stderr=subprocess.STDOUT)
        for _ in range(100):
            if cls.server.poll() is not None: raise RuntimeError('Test server failed; inspect test-results/playwright/server.log')
            try:
                with urlopen(cls.base+'/api/health',timeout=1) as response:
                    if response.status==200: break
            except OSError: time.sleep(.1)
        else: raise RuntimeError('Test server did not become ready.')
        cls.playwright = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        cls.browser = cls.playwright.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop()
        cls.server.terminate()
        try: cls.server.wait(timeout=10)
        except subprocess.TimeoutExpired: cls.server.kill(); cls.server.wait()
        cls.log.close(); cls.temp.cleanup()
        (ARTIFACTS/'results.json').write_text(json.dumps(cls.results,indent=2))

    def setUp(self):
        for suffix in ['.png','.zip']:
            (ARTIFACTS/(self._testMethodName+suffix)).unlink(missing_ok=True)
        self.boundary.write_text(json.dumps(self.policy))
        with sqlite3.connect(self.database) as db:
            db.execute("UPDATE users SET department='MDRRMO' WHERE id=1")
            db.execute("UPDATE users SET account_status='active',account_reason=NULL,auth_version=0")
            self.report_id = db.execute("INSERT INTO reports (title,type,status,location,latitude,longitude,submitted_by) VALUES (?, 'Flood','pending_confirmation','Accepted test area',14.5,120.5,2)",[self._testMethodName]).lastrowid
            self.hazard_id = db.execute("INSERT INTO hazard_alerts (title,severity,location,latitude,longitude,created_by) VALUES (?, 'low','Accepted test area',14.5,120.5,1)",[self._testMethodName]).lastrowid
        self.context = self.browser.new_context(viewport={'width':390,'height':844},timezone_id='America/New_York',geolocation={'latitude':14.5,'longitude':120.5},permissions=['geolocation'])
        self.context.tracing.start(screenshots=True,snapshots=True,sources=True)
        self.context.route('**/*', lambda route: route.continue_() if urlparse(route.request.url).netloc==urlparse(self.base).netloc else route.abort())
        self.context.route('https://tile.openstreetmap.org/**', lambda route: route.fulfill(
            body=bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082'),
            content_type='image/png'))
        self.page = self.context.new_page()
        self.page.set_default_timeout(5000)
        self.errors = []; self.dialogs = []
        self.page.on('pageerror',lambda error:self.errors.append(error.stack))
        self.page.on('dialog',lambda dialog:(self.dialogs.append(dialog.message),dialog.accept()))

    def tearDown(self):
        failed = bool(self.errors)
        result = self._outcome.result
        failed = failed or any(test is self for test,_ in result.failures+result.errors)
        if failed:
            self.page.screenshot(path=str(ARTIFACTS/(self._testMethodName+'.png')),full_page=True)
            self.context.tracing.stop(path=str(ARTIFACTS/(self._testMethodName+'.zip')))
        else: self.context.tracing.stop()
        self.context.close()
        self.results.append({'test':self._testMethodName,'passed':not failed,'browser_errors':self.errors})
        self.assertEqual(self.errors,[], 'Unhandled browser errors: '+repr(self.errors))

    def login(self,role='admin',desktop=False,via_ui=False):
        if desktop: self.page.set_viewport_size({'width':1440,'height':1000})
        if via_ui:
            self.page.goto(self.base+'/#/login')
            app=self.page.frame_locator('iframe') if desktop else self.page
            app.locator('#login-email').fill(role+'@browser.test')
            app.locator('#login-password').fill(PASSWORD)
            app.locator('#login-form button[type=submit]').click()
            app.locator('#login-form').wait_for(state='detached')
        else:
            response=self.context.request.post(self.base+'/api/auth/login',data={'email':role+'@browser.test','password':PASSWORD})
            self.assertEqual(response.status,200,response.text())
            token=response.json()['data']['token']
            self.context.add_init_script('if (!localStorage.getItem("pulse_token")) localStorage.setItem("pulse_token",'+json.dumps(token)+');')
            self.page.goto(self.base+'/#/'+('admin-dashboard' if role=='admin' else 'my-reports'))
        if desktop:
            self.page.wait_for_url(lambda url: '/desktop.html' in url)
            self.app=self.page.frame_locator('iframe')
            self.app.locator('#app-content').wait_for()
        else: self.app=self.page
        self.app.locator('#app-content').wait_for()
        if role=='admin' and not via_ui: self.app.locator('#dashboard-content').wait_for()

    def operations(self,resource):
        self.app.get_by_text('Directories, calls & road advisories',exact=True).click()
        self.app.locator('[data-operation='+resource+']').click()
        self.app.locator('#operations-list table').wait_for()

    def open_report(self):
        self.app.locator('#incident-'+str(self.report_id)).get_by_role('button',name='Details',exact=True).click()
        self.app.locator('#detail-modal-history-body').get_by_text('No status changes yet.',exact=True).wait_for()

    def test_login_and_session_restore(self):
        self.login(via_ui=True)
        expect(self.app.locator('#login-form')).to_have_count(0)
        self.page.reload()
        self.page.wait_for_function("() => Store.get('user')?.role === 'admin'")
        self.assertNotIn('Failed to load page',self.page.locator('#app-content').inner_text())

    def test_desktop_operations(self):
        self.login(desktop=True)
        self.operations('calls')
        self.app.locator('[name=caller_name]').fill('Desktop caller')
        self.app.locator('#operation-editor button[type=submit]').click()
        expect(self.app.locator('#operations-list')).to_contain_text('Desktop caller')

    def test_resolution_and_archive_restore(self):
        self.login()
        card=self.app.locator('#incident-'+str(self.report_id))
        card.get_by_role('button',name='Resolve',exact=True).click()
        self.app.locator('#status-note').fill('Fire crew: rescue complete at 14:30.')
        self.app.get_by_role('button',name='Confirm',exact=True).click()
        expect(card).to_contain_text('Resolved')
        card.get_by_role('button',name='Archive',exact=True).click()
        expect(card).to_have_count(0)
        self.app.locator('button[onclick*="setMainTab(\'bin\')"]').click()
        archived=self.app.locator('#bin-report-'+str(self.report_id))
        expect(archived).to_be_visible()
        expect(archived).not_to_contain_text('Permanently')
        archived.get_by_role('button',name='Restore',exact=True).click()
        expect(archived).to_have_count(0)
        self.app.locator('button[onclick*="setMainTab(\'incidents\')"]').click()
        expect(card).to_be_visible()

    def test_admin_notes_and_citizen_history(self):
        self.login(); self.open_report()
        self.app.locator('#detail-modal-history textarea').fill('Water level receding. <script>window.noteXss=true</script>')
        self.app.locator('#detail-modal-history button[type=submit]').click()
        expect(self.app.locator('#detail-modal-history-body')).to_contain_text('Water level receding.')
        expect(self.app.locator('#detail-modal-history-body')).to_contain_text('MDRRMO')
        self.assertFalse(self.page.evaluate('!!window.noteXss'))
        self.app.get_by_role('button',name='Close',exact=True).last.click()
        # New context avoids reusing the admin initialization script.
        response=self.context.request.post(self.base+'/api/auth/login',data={'email':'citizen@browser.test','password':PASSWORD}).json()
        self.page.evaluate('(token)=>localStorage.setItem("pulse_token",token)',response['data']['token'])
        self.page.goto(self.base+'/#/my-reports');self.page.reload()
        self.page.wait_for_function("() => Store.get('user')?.role === 'citizen'")
        self.page.locator('.incident-card').filter(has_text=self._testMethodName).get_by_role('button',name='Details',exact=True).click()
        expect(self.page.locator('#detail-modal-history-body')).to_contain_text('Water level receding.')
        expect(self.page.locator('#detail-modal-history textarea')).to_have_count(0)

    def test_responder_assignment_form(self):
        self.login(); self.operations('responders')
        row=self.app.locator('#operations-list tr').filter(has_text='admin')
        row.get_by_role('button',name='Edit',exact=True).click()
        self.app.locator('[name=department]').select_option('Health Unit')
        self.app.locator('#operation-editor button[type=submit]').click()
        expect(self.app.locator('#operations-list')).to_contain_text('Health Unit')

    def test_contacts_and_citizen_directory(self):
        self.login();self.operations('hotlines')
        self.app.locator('[name=label]').fill('Dispatch "A" <safe>')
        self.app.locator('[name=number]').fill('911')
        self.app.locator('#operation-editor button[type=submit]').click()
        row=self.app.locator('#operations-list tr').filter(has_text='Dispatch "A" <safe>')
        row.get_by_role('button',name='Edit',exact=True).click()
        self.app.locator('[name=number]').fill('09170000009')
        self.app.locator('#operation-editor button[type=submit]').click()
        expect(row).to_contain_text('09170000009')
        citizen=self.context.request.post(self.base+'/api/auth/login',data={'email':'citizen@browser.test','password':PASSWORD}).json()
        self.page.evaluate('(token)=>localStorage.setItem("pulse_token",token)',citizen['data']['token'])
        self.page.reload(); self.page.wait_for_function("() => Store.get('user')?.role === 'citizen'"); self.page.evaluate("Router.navigate('emergency')")
        expect(self.page.locator('#emergency-mdrrmo')).to_contain_text('Dispatch "A" <safe>')
        expect(self.page.locator('#emergency-tabs')).to_be_visible()
        expect(self.page.locator('.hotlines-section__title')).to_have_text('MDRRMO Hotlines')
        expect(self.page.locator('#slide-to-call')).to_have_attribute('data-tel','911')
        expect(self.page.locator('#emergency-mdrrmo a').filter(has_text='09170000009')).to_have_attribute('href','tel:09170000009')

    def test_call_missing_phone_edit_and_validation(self):
        self.login();self.operations('calls')
        self.app.locator('[name=caller_name]').fill(self._testMethodName)
        self.app.locator('#operation-editor button[type=submit]').click()
        row=self.app.locator('#operations-list tr').filter(has_text=self._testMethodName)
        row.get_by_role('button',name='Edit',exact=True).click()
        self.app.locator('[name=contact_number]').fill('invalid phone')
        self.app.locator('#operation-editor button[type=submit]').click()
        expect(self.app.locator('#operation-error')).not_to_be_empty()
        self.app.locator('[name=contact_number]').fill('09170000008')
        self.app.locator('#operation-editor button[type=submit]').click()
        expect(row).to_contain_text('09170000008')

    def test_road_advisory_and_broadcast_monitor(self):
        self.login(); self.operations('advisories')
        for field,value in {'label':'NOT PASSABLE - browser test','latitude':'14.5','longitude':'120.5','status':'not_passable'}.items(): self.app.locator('[name='+field+']').fill(value)
        self.app.locator('#operation-editor button[type=submit]').click()
        expect(self.app.locator('#operations-list')).to_contain_text('NOT PASSABLE - browser test')
        self.app.locator('[data-operation=broadcasts]').click()
        expect(self.app.locator('#operations-list')).to_contain_text('sms')
        expect(self.app.locator('#operations-list')).to_contain_text('blocked')
        expect(self.app.locator('#operations-list')).not_to_contain_text('09170000001')

    def test_blocked_territory_preserves_form_and_explains_error(self):
        self.login(); self.operations('advisories'); self.boundary.unlink()
        for field,value in {'label':'Unknown territory','latitude':'14.5','longitude':'120.5','status':'caution'}.items(): self.app.locator('[name='+field+']').fill(value)
        self.app.locator('#operation-editor button[type=submit]').click()
        expect(self.app.locator('#operation-error')).to_contain_text('configuration')
        expect(self.app.locator('[name=label]')).to_have_value('Unknown territory')
        expect(self.app.locator('#operation-editor button[type=submit]')).to_be_enabled()

    def test_barangay_xss_and_rename(self):
        self.login();self.operations('barangays')
        name='Browser <img src=x onerror="window.directoryXss=1">'
        self.app.locator('[name=name]').fill(name)
        self.app.locator('#operation-editor button[type=submit]').click()
        row=self.app.locator('#operations-list tr').filter(has_text=name)
        row.get_by_role('button',name='Edit',exact=True).click()
        self.app.locator('[name=name]').fill('Renamed browser district')
        self.app.locator('#operation-editor button[type=submit]').click()
        expect(self.app.locator('#operations-list')).to_contain_text('Renamed browser district')
        self.assertFalse(self.page.evaluate('!!window.directoryXss'))

    def test_signup_uses_current_public_directory(self):
        with sqlite3.connect(self.database) as db: db.execute("INSERT INTO barangays (name,active,updated_at) VALUES ('Signup district',1,'2026-10-18T00:00:00.000Z')")
        self.page.goto(self.base+'/#/signup')
        expect(self.page.locator('#signup-barangay option').filter(has_text='Signup district')).to_have_count(1)

    def test_map_polling_reuses_marker_and_drag_edits_survive(self):
        self.login();self.page.evaluate(MAP_INSTRUMENT);self.open_report()
        self.page.wait_for_function('() => IncidentMap.session?.marker')
        self.page.evaluate('window.firstMarker=IncidentMap.session.marker')
        self.page.wait_for_timeout(5200)
        self.assertTrue(self.page.evaluate('IncidentMap.session.marker===firstMarker && mapStats.created===1'))
        self.page.evaluate('firstMarker.events.dragstart();firstMarker.events.dragend({latLng:{lat:()=>14.6,lng:()=>120.6}})')
        self.page.wait_for_timeout(5200)
        expect(self.page.locator('#incident-lat')).to_have_value('14.6')
        self.page.locator('#incident-gps-note').fill('GPS field correction')
        self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        expect(self.page.locator('#incident-map-status')).to_contain_text('saved and audited')
        self.assertTrue(self.page.evaluate('IncidentMap.session.marker===firstMarker'))

    def test_map_close_during_slow_load_has_no_async_errors(self):
        self.login()
        self.page.evaluate('() => { IncidentMap.loadLeaflet = () => new Promise(resolve => window.finishMapLoad=resolve); }')
        self.open_report()
        self.app.get_by_role('button',name='Close',exact=True).last.click()
        self.page.evaluate('finishMapLoad()')
        self.page.wait_for_timeout(200)

    def test_map_new_coordinate_marker_is_draggable(self):
        with sqlite3.connect(self.database) as db: db.execute('UPDATE reports SET latitude=NULL,longitude=NULL WHERE id=?',[self.report_id])
        self.login();self.page.evaluate(MAP_INSTRUMENT);self.open_report()
        with sqlite3.connect(self.database) as db: db.execute('UPDATE reports SET latitude=14.5,longitude=120.5 WHERE id=?',[self.report_id])
        self.page.wait_for_function('() => IncidentMap.session?.marker',timeout=10000)
        self.assertTrue(self.page.evaluate('IncidentMap.session.marker.draggable'), 'Admin marker must remain draggable when GPS first arrives during polling')

    def test_report_review_does_not_execute_markup(self):
        self.login(role='citizen')
        self.page.goto(self.base+'/#/report-incident')
        self.page.locator('.category-chip').filter(has_text='Flood').click()
        self.page.locator('#report-title').fill('<img src=x onerror="window.reviewXss=1">')
        self.page.locator('#report-description').fill('Review should show literal text')
        self.page.get_by_role('button',name='Next: Location & Media',exact=True).click()
        self.page.locator('#report-location').fill('Accepted test area')
        self.page.get_by_role('button',name='Next: Review',exact=True).click()
        expect(self.page.locator('#ri-review-card')).to_contain_text('<img src=x onerror="window.reviewXss=1">')
        self.assertFalse(self.page.evaluate('!!window.reviewXss'))

    def test_operations_navigation_during_save_has_no_async_errors(self):
        self.login();self.operations('calls')
        pending = []
        self.page.route('**/api/operations/calls', lambda route: pending.append(route) if route.request.method=='POST' else route.continue_())
        self.app.locator('[name=caller_name]').fill('Slow save caller')
        self.app.locator('[name=contact_number]').fill('invalid')
        self.app.locator('#operation-editor button[type=submit]').click()
        self.assertTrue(pending)
        self.page.evaluate("Router.navigate('admin-profile')")
        self.page.locator('#operation-editor').wait_for(state='detached')
        pending[0].continue_()
        self.page.wait_for_timeout(300)


    def test_leaflet_loads_without_key_and_is_allowed_by_csp(self):
        self.login()
        self.open_report()
        self.page.wait_for_function('() => !!IncidentMap.session?.map')
        self.assertTrue(self.page.evaluate('IncidentMap.session.map instanceof L.Map'))
        expect(self.page.locator('.leaflet-control-attribution')).to_contain_text('OpenStreetMap')

    def test_stored_report_text_does_not_execute_on_admin_dashboard(self):
        payload='<img src=x onerror="window.storedXss=1">'
        with sqlite3.connect(self.database) as db: db.execute('UPDATE reports SET title=?,description=? WHERE id=?',[payload,payload,self.report_id])
        self.login()
        card=self.page.locator('#incident-'+str(self.report_id))
        expect(card.locator('.incident-card__title')).to_have_text(payload)
        expect(card.locator('img')).to_have_count(0)
        self.assertFalse(self.page.evaluate('!!window.storedXss'))
        card.get_by_role('button',name='Resolve',exact=True).click()
        expect(self.page.locator('#rejection-modal .modal__desc')).to_contain_text(payload)
        expect(self.page.locator('#rejection-modal img')).to_have_count(0)
        self.page.locator('#rejection-modal').get_by_role('button',name='Cancel',exact=True).click()
        self.page.locator('button[onclick*="setMainTab(\'reports\')"]').click()
        expect(self.page.locator('#dashboard-content')).to_contain_text(payload)
        self.assertFalse(self.page.evaluate('!!window.storedXss'))

    def test_mobile_page_does_not_overflow_for_long_incident_titles(self):
        with sqlite3.connect(self.database) as db: db.execute('UPDATE reports SET title=? WHERE id=?',['VeryLongIncidentTitle'*20,self.report_id])
        self.login()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Long incident title must wrap within the mobile page')

    def test_signup_directory_refresh_updates_visible_options(self):
        self.page.goto(self.base+'/#/signup')
        pending=[]
        self.page.route('**/api/barangays', lambda route: pending.append(route))
        self.page.evaluate('void refreshBarangays()')
        self.assertTrue(pending)
        pending[0].fulfill(json={'success':True,'data':[{'id':999,'name':'Late directory entry','active':1}]})
        expect(self.page.locator('#signup-barangay option').filter(has_text='Late directory entry')).to_have_count(1)


    def report_form(self, title):
        self.login(role='citizen')
        self.page.goto(self.base+'/#/report-incident')
        self.page.locator('.category-chip').filter(has_text='Flood').click()
        self.page.locator('#report-title').fill(title)
        self.page.get_by_role('button',name='Next: Location & Media',exact=True).click()
        self.page.locator('#ri-use-location-btn').click()
        expect(self.page.locator('#report-location')).to_have_value('Accepted test area')
        self.page.get_by_role('button',name='Next: Review',exact=True).click()
        self.page.locator('#ri-terms').check()

    def test_citizen_report_submission_with_browser_gps(self):
        self.report_form(self._testMethodName)
        with self.page.expect_response(lambda response: response.url.endswith('/api/reports') and response.request.method=='POST') as submitted:
            self.page.locator('#ri-submit-btn').click()
        self.assertEqual(submitted.value.status,201,submitted.value.text())
        expect(self.page.locator('#form-step-success')).to_be_visible()

    def test_outside_morong_gps_rejected_without_losing_form(self):
        self.context.set_geolocation({'latitude':14.5,'longitude':121.5})
        self.report_form(self._testMethodName)
        with self.page.expect_response(lambda response: response.url.endswith('/api/reports') and response.request.method=='POST') as submitted:
            self.page.locator('#ri-submit-btn').click()
        self.assertEqual(submitted.value.status,422,submitted.value.text())
        self.assertTrue(any('Morong' in message for message in self.dialogs))
        expect(self.page.locator('#ri-submit-btn')).to_be_enabled()
        expect(self.page.locator('#form-step-success')).not_to_be_visible()

    def test_hazard_note_and_archive_restore(self):
        self.login()
        self.page.locator('button[onclick*="setMainTab(\'hazards\')"]').click()
        card=self.page.locator('#dashboard-content .incident-card').filter(has_text=self._testMethodName)
        card.get_by_role('button',name='Details',exact=True).click()
        self.page.locator('#detail-modal-history textarea').fill('Road inspection complete.')
        self.page.locator('#detail-modal-history button[type=submit]').click()
        expect(self.page.locator('#detail-modal-history-body')).to_contain_text('Road inspection complete.')
        self.page.get_by_role('button',name='Close',exact=True).last.click()
        card.get_by_role('button',name='Archive',exact=True).click()
        expect(card).to_have_count(0)
        self.page.locator('button[onclick*="setMainTab(\'bin\')"]').click()
        archived=self.page.locator('#bin-hazard-'+str(self.hazard_id))
        expect(archived).to_be_visible()
        archived.get_by_role('button',name='Restore',exact=True).click()
        expect(archived).to_have_count(0)

    def test_mobile_operations_table_scroll_is_contained(self):
        self.login();self.operations('calls')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Wide operations table should scroll inside its own container')


    def test_philippine_timeline_is_independent_of_browser_timezone(self):
        with sqlite3.connect(self.database) as db:
            db.execute("INSERT INTO report_events (report_id,actor_user_id,actor_department,action,note,created_at) VALUES (?,1,'MDRRMO','note','Known-time fixture','2026-10-18 00:30:00.123')",[self.report_id])
        self.login()
        self.page.locator('#incident-'+str(self.report_id)).get_by_role('button',name='Details',exact=True).click()
        expect(self.page.locator('#detail-modal-history-body')).to_contain_text('08:30:00.123')
        self.assertEqual(self.page.evaluate('Intl.DateTimeFormat().resolvedOptions().timeZone'),'America/New_York')


    def main_hazard_map(self, role='admin'):
        self.login(role=role)
        self.page.evaluate(MAP_INSTRUMENT)
        self.page.evaluate("Router.navigate('hazards')")
        self.page.locator('.hazards-toggle').click()
        self.page.wait_for_function('() => !!HazardMap.session?.timer')

    def test_main_hazard_map_admin_drag_save_and_polling(self):
        self.main_hazard_map()
        self.page.evaluate('(id)=>{window.hazardPin=HazardMap.session.markers.get(id).marker;hazardPin.events.dragstart();hazardPin.events.dragend({latLng:{lat:()=>14.6,lng:()=>120.6}});}',self.hazard_id)
        expect(self.page.locator('.hazard-pin-form [name=latitude]')).to_have_value('14.6')
        self.page.wait_for_timeout(5200)
        self.assertTrue(self.page.evaluate('(id)=>HazardMap.session.markers.get(id).marker===hazardPin',self.hazard_id))
        expect(self.page.locator('.hazard-pin-form [name=latitude]')).to_have_value('14.6')
        self.page.locator('.hazard-pin-form [name=note]').fill('Reposition main hazard map pin')
        self.page.get_by_role('button',name='Save pin location',exact=True).click()
        expect(self.page.locator('.hazard-map-status')).to_contain_text('saved and audited')
        with sqlite3.connect(self.database) as db:
            location=db.execute('SELECT latitude,longitude FROM hazard_alerts WHERE id=?',[self.hazard_id]).fetchone()
            event=db.execute('SELECT note,actor_department FROM hazard_events WHERE hazard_id=? ORDER BY id DESC LIMIT 1',[self.hazard_id]).fetchone()
        self.assertEqual(location,(14.6,120.6))
        self.assertEqual(event,('Reposition main hazard map pin','MDRRMO'))

    def test_main_hazard_map_citizen_is_read_only_and_disposes(self):
        self.main_hazard_map(role='citizen')
        self.assertTrue(self.page.evaluate('Array.from(HazardMap.session.markers.values()).every(e=>!e.marker.draggable && !e.marker.events.dragend)'))
        expect(self.page.locator('.hazard-pin-form')).to_have_count(0)
        self.page.evaluate("Router.navigate('my-reports')")
        self.assertTrue(self.page.evaluate('HazardMap.session===null'))

    def test_main_hazard_map_blocked_save_keeps_pin_editor(self):
        self.main_hazard_map()
        self.boundary.unlink()
        self.page.evaluate('(id)=>HazardMap.session.markers.get(id).marker.events.dragend({latLng:{lat:()=>14.6,lng:()=>120.6}})',self.hazard_id)
        self.page.locator('.hazard-pin-form [name=note]').fill('Blocked correction')
        self.page.get_by_role('button',name='Save pin location',exact=True).click()
        expect(self.page.locator('.hazard-pin-error')).to_contain_text('configuration')
        expect(self.page.locator('.hazard-pin-form')).to_be_visible()
        self.page.get_by_role('button',name='Cancel repositioning',exact=True).click()
        self.assertEqual(self.page.evaluate('(id)=>HazardMap.session.markers.get(id).marker.position.lat',self.hazard_id),14.5)

    def test_hazard_details_marker_can_be_repositioned(self):
        self.login();self.page.evaluate(MAP_INSTRUMENT)
        self.page.locator('button[onclick*="setMainTab(\'hazards\')"]').click()
        self.page.locator('#dashboard-content .incident-card').filter(has_text=self._testMethodName).get_by_role('button',name='Details',exact=True).click()
        self.page.wait_for_function('() => !!IncidentMap.session?.marker')
        self.page.evaluate('IncidentMap.session.marker.events.dragend({latLng:{lat:()=>14.7,lng:()=>120.7}})')
        self.page.locator('#incident-gps-note').fill('Hazard detail pin correction')
        self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        expect(self.page.locator('#incident-map-status')).to_contain_text('saved and audited')
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT latitude FROM hazard_alerts WHERE id=?',[self.hazard_id]).fetchone()[0],14.7)

    def test_emergency_preserves_category_cards_for_managed_numbers(self):
        with sqlite3.connect(self.database) as db:
            db.execute("INSERT INTO emergency_hotlines(category,label,number) VALUES ('Police','Updated police contact','09981234567')")
        self.login(role='citizen');self.page.evaluate("Router.navigate('emergency')")
        expect(self.page.locator('#emergency-tabs')).to_be_visible()
        expect(self.page.locator('#emergency-mdrrmo .hotline-item')).not_to_have_count(0)
        expect(self.page.locator('#emergency-details')).to_contain_text('Updated police contact')
        expect(self.page.locator('#emergency-details .contact-number')).to_have_attribute('href','tel:09981234567')
        expect(self.page.locator('#emergency-details .carrier-badge')).to_have_count(1)
        self.page.screenshot(path=str(ARTIFACTS/'emergency-restored.png'),full_page=True)
        self.page.locator('.emergency-tab').filter(has_text='Hospitals').click()
        expect(self.page.locator('#emergency-details')).to_contain_text('Hospital')


    def test_main_hazard_map_without_key_supports_real_pointer_drag(self):
        self.login()
        self.page.evaluate("Router.navigate('hazards')")
        self.page.locator('.hazards-toggle').click()
        self.page.wait_for_function('() => !!HazardMap.session?.map')
        self.page.evaluate('(id)=>{window.realPin=HazardMap.session.markers.get(id).marker;realPin.getElement().dataset.testPin="target";}',self.hazard_id)
        pin = self.page.locator('[data-test-pin=target]')
        box = pin.bounding_box()
        self.page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2)
        self.page.mouse.down()
        self.page.mouse.move(box['x']+box['width']/2+45, box['y']+box['height']/2-35, steps=12)
        self.page.mouse.up()
        expect(self.page.locator('.hazard-pin-form')).to_be_visible()
        self.assertNotEqual(float(self.page.locator('.hazard-pin-form [name=latitude]').input_value()),14.5)
        self.assertTrue(self.page.evaluate('HazardMap.session.map instanceof L.Map'))
        expect(self.page.locator('.leaflet-control-attribution')).to_contain_text('OpenStreetMap')

    def test_tile_failure_preserves_coordinate_editor(self):
        self.context.route('https://tile.openstreetmap.org/**', lambda route: route.abort())
        self.login()
        self.open_report()
        expect(self.page.locator('#incident-map-status')).to_contain_text('Map tiles unavailable')
        expect(self.page.locator('#incident-coordinate-form')).to_be_visible()
        self.assertTrue(self.page.evaluate('!!IncidentMap.session.marker'))

    def test_advisory_labels_are_safe_and_markers_are_reused(self):
        self.main_hazard_map()
        self.page.evaluate("""() => {
            const s=HazardMap.session;
            const advisory={id:99999,active:1,latitude:14.51,longitude:120.51,
                label:'<img src=x onerror="window.mapXss=1">',status:'not_passable'};
            HazardMap.reconcileAdvisories(s,[advisory]);
            window.advisoryPin=s.advisories.get(99999);
            advisory.label='NOT PASSABLE - BINABAHA NA YUNG LUGAR';
            advisory.latitude=14.52;
            HazardMap.reconcileAdvisories(s,[advisory]);
            advisoryPin.fire('click');
        }""")
        expect(self.page.locator('.leaflet-popup-content')).to_contain_text('NOT PASSABLE')
        self.assertTrue(self.page.evaluate('HazardMap.session.advisories.get(99999)===advisoryPin'))
        self.assertFalse(self.page.evaluate('!!window.mapXss'))
        self.page.evaluate('HazardMap.reconcileAdvisories(HazardMap.session,[])')
        self.assertTrue(self.page.evaluate('!HazardMap.session.map.hasLayer(advisoryPin)'))

    def test_emergency_offline_retains_original_cards(self):
        self.login(role='citizen')
        self.page.route('**/api/hotlines',lambda route: route.abort())
        self.page.evaluate("Router.navigate('emergency')")
        expect(self.page.locator('#emergency-mdrrmo')).to_contain_text('MDRRMO Hotlines')
        expect(self.page.locator('#emergency-tabs .emergency-tab')).to_have_count(4)
        expect(self.page.locator('#emergency-details .contact-card')).not_to_have_count(0)
        expect(self.page.locator('#slide-to-call')).to_have_attribute('data-tel','911')


    def test_required_cancellation_reason_and_persistent_history(self):
        with sqlite3.connect(self.database) as db: db.execute("UPDATE reports SET status='submitted' WHERE id=?",[self.report_id])
        self.login(role='citizen')
        card=self.page.locator('.incident-card').filter(has_text=self._testMethodName)
        card.get_by_role('button',name='Cancel Report',exact=True).click()
        self.page.locator('#cancel-report-reason').fill('   ')
        self.page.get_by_role('button',name='Confirm cancellation',exact=True).click()
        expect(self.page.locator('#cancel-report-modal [role=alert]')).to_contain_text('Enter a cancellation reason')
        with sqlite3.connect(self.database) as db:self.assertEqual(db.execute('SELECT status FROM reports WHERE id=?',[self.report_id]).fetchone()[0],'submitted')
        self.page.locator('#cancel-report-reason').fill('Already reported by my household')
        self.page.get_by_role('button',name='Confirm cancellation',exact=True).click()
        expect(self.page.locator('#cancel-report-modal')).to_have_count(0)
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT status FROM reports WHERE id=?',[self.report_id]).fetchone()[0],'cancelled')
            self.assertEqual(db.execute('SELECT note FROM report_events WHERE report_id=? ORDER BY id DESC LIMIT 1',[self.report_id]).fetchone()[0],'Already reported by my household')

    def test_admin_priority_highlight_status_box_and_archive_bar(self):
        self.login()
        form=self.page.locator('[data-report-priority="'+str(self.report_id)+'"]')
        form.locator('[name=priority]').select_option('critical')
        form.locator('[name=note]').fill('Rescue boat needed immediately')
        form.get_by_role('button',name='Save priority',exact=True).click()
        card=self.page.locator('#incident-'+str(self.report_id))
        expect(card).to_have_class(__import__('re').compile('incident-card--critical'))
        expect(card.locator('.incident-status-box')).to_contain_text('Current status:')
        expect(card.locator('.incident-status-box')).to_contain_text('critical')
        expect(card.locator('.archive-bar')).to_have_text('Archive')
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT priority FROM reports WHERE id=?',[self.report_id]).fetchone()[0],'critical')
            self.assertIn('Rescue boat',db.execute('SELECT note FROM report_events WHERE report_id=? ORDER BY id DESC LIMIT 1',[self.report_id]).fetchone()[0])
        self.page.screenshot(path=str(ARTIFACTS/'critical-priority-and-archive.png'),full_page=True)

    def test_account_suspension_controls_existing_token_and_login(self):
        response=self.context.request.post(self.base+'/api/auth/login',data={'email':'other@browser.test','password':PASSWORD})
        other_token=response.json()['data']['token']
        self.login();self.operations('users')
        row=self.page.locator('#operations-list tr').filter(has_text='other@browser.test')
        row.get_by_role('button',name='Edit',exact=True).click()
        form=self.page.locator('#operation-editor')
        form.locator('[name=account_status]').select_option('suspended')
        form.locator('[name=account_reason]').fill('Repeated misleading reports under review')
        form.get_by_role('button',name='Save',exact=True).click()
        expect(self.page.locator('#operations-list tr').filter(has_text='other@browser.test')).to_contain_text('suspended')
        self.assertEqual(self.context.request.get(self.base+'/api/users/me',headers={'Authorization':'Bearer '+other_token}).status,403)
        self.assertEqual(self.context.request.post(self.base+'/api/auth/login',data={'email':'other@browser.test','password':PASSWORD}).status,403)
        with sqlite3.connect(self.database) as db:self.assertIsNotNone(db.execute('SELECT id FROM users WHERE id=3').fetchone())

    def test_morong_map_pans_freely_without_boundary_or_focus_button(self):
        self.main_hazard_map()
        self.assertFalse(self.page.evaluate('!!HazardMap.session.map.options.maxBounds'))
        self.page.evaluate('(id)=>{window.focusMap=HazardMap.session.map;window.focusPin=HazardMap.session.markers.get(id).marker;focusMap.setView([0,0],3,{animate:false})}',self.hazard_id)
        self.assertLess(abs(self.page.evaluate('focusMap.getCenter().lat')),1)
        self.assertEqual(self.page.evaluate('focusMap.getZoom()'),3)
        expect(self.page.get_by_role('button',name='Focus on Morong',exact=True)).to_have_count(0)
        self.assertTrue(self.page.evaluate('(id)=>HazardMap.session.map===focusMap && HazardMap.session.markers.get(id).marker===focusPin',self.hazard_id))
        self.assertTrue(self.page.evaluate('Object.values(focusMap._layers).every(layer=>!(layer instanceof L.Path))'))
        self.page.evaluate("Router.navigate('my-reports')")
        self.boundary.unlink()
        self.page.evaluate("Router.navigate('hazards')")
        if self.page.locator('.hazards-toggle').inner_text()=='Map': self.page.locator('.hazards-toggle').click()
        expect(self.page.locator('.hazard-live-map')).to_be_visible()
        self.page.wait_for_function('()=>!!HazardMap.session?.map')
        expect(self.page.locator('.map-boundary-warning')).to_contain_text('boundary')
        self.assertTrue(self.page.evaluate('HazardMap.session.markers.size > 0'))
        expect(self.page.get_by_role('button',name='Focus on Morong',exact=True)).to_have_count(0)
        self.assertAlmostEqual(self.page.evaluate('HazardMap.session.map.getCenter().lat'),14.515,places=2)

    def test_published_morong_map_has_no_border_and_preserves_surrounding_pins(self):
        self.install_published_morong_boundary()
        with sqlite3.connect(self.database) as db:
            outside=db.execute("INSERT INTO hazard_alerts(title,severity,latitude,longitude,created_by) VALUES ('Historical outside pin','low',14.465,121.191,1)").lastrowid
        self.main_hazard_map(role='citizen')
        self.assertTrue(self.page.evaluate('(id)=>HazardMap.session.markers.has(id)',outside))
        self.assertTrue(self.page.evaluate('HazardMap.session.map.getBounds().contains(HazardMap.session.map.pulseMorongBounds)'))
        expect(self.page.get_by_role('button',name='Focus on Morong',exact=True)).to_have_count(0)
        self.assertTrue(self.page.evaluate('Object.values(HazardMap.session.map._layers).every(layer=>!(layer instanceof L.Path))'))
        self.page.screenshot(path=str(ARTIFACTS/'map-without-morong-border.png'),full_page=True)

    def test_report_map_without_focus_control_preserves_unsaved_coordinates(self):
        self.install_published_morong_boundary();self.login();self.open_report()
        self.page.wait_for_function('()=>!!IncidentMap.session?.marker')
        self.page.locator('#incident-lat').fill('14.516');self.page.locator('#incident-lng').fill('121.24')
        self.page.evaluate('window.unsavedFocusPin=IncidentMap.session.marker;IncidentMap.session.map.setView([0,0],3,{animate:false})')
        expect(self.page.get_by_role('button',name='Focus on Morong',exact=True)).to_have_count(0)
        expect(self.page.locator('#incident-leaflet-map .leaflet-overlay-pane path')).to_have_count(0)
        expect(self.page.locator('#incident-lat')).to_have_value('14.516')
        expect(self.page.locator('#incident-map-status')).to_contain_text('Unsaved')
        self.assertTrue(self.page.evaluate('IncidentMap.session.marker===unsavedFocusPin && unsavedFocusPin.getLatLng().lat===14.516 && IncidentMap.session.dirty'))
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT latitude,longitude FROM reports WHERE id=?',[self.report_id]).fetchone(),(14.515,121.239))

    def test_report_coordinates_manual_save_and_actual_pointer_drag(self):
        self.login();self.open_report()
        self.page.wait_for_function('()=>!!IncidentMap.session?.marker')
        self.page.locator('#incident-lat').fill('14.6')
        self.page.locator('#incident-lng').fill('120.6')
        self.page.locator('#incident-gps-note').fill('Verified GPS correction')
        self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        expect(self.page.locator('#incident-map-status')).to_contain_text('saved and audited')
        self.page.locator('#incident-leaflet-map').scroll_into_view_if_needed()
        self.page.evaluate("IncidentMap.session.map.setView(IncidentMap.session.marker.getLatLng(),16,{animate:false});IncidentMap.session.marker.getElement().dataset.reportDrag='target'")
        pin=self.page.locator('[data-report-drag=target]');box=pin.bounding_box()
        self.page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
        self.page.mouse.down();self.page.mouse.move(box['x']+box['width']/2+30,box['y']+box['height']/2-20,steps=10);self.page.mouse.up()
        self.assertNotEqual(float(self.page.locator('#incident-lat').input_value()),14.6)
        self.page.locator('#incident-gps-note').fill('Dragged to verified incident entrance')
        self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        expect(self.page.locator('#incident-map-status')).to_contain_text('saved and audited')
        with sqlite3.connect(self.database) as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM report_events WHERE report_id=?',[self.report_id]).fetchone()[0],2)

    def test_hotline_updates_while_screen_open_and_cached_numbers_survive_offline(self):
        with sqlite3.connect(self.database) as db:
            contact=db.execute("INSERT INTO emergency_hotlines(category,label,number) VALUES ('Police','Live police fixture','09981230001')").lastrowid
        self.login(role='citizen');self.page.evaluate("Router.navigate('emergency')")
        expect(self.page.locator('#emergency-details')).to_contain_text('09981230001')
        with sqlite3.connect(self.database) as db:db.execute("UPDATE emergency_hotlines SET number='09981230002' WHERE id=?",[contact])
        expect(self.page.locator('#emergency-details')).to_contain_text('09981230002',timeout=10000)
        self.page.route('**/api/hotlines',lambda route:route.abort())
        self.page.evaluate("Router.navigate('my-reports')")
        self.page.evaluate("Router.navigate('emergency')")
        expect(self.page.locator('#emergency-details')).to_contain_text('09981230002')
        expect(self.page.locator('#emergency-contact-status')).to_contain_text('may be outdated')
        expect(self.page.locator('#emergency-tabs .emergency-tab')).to_have_count(4)

    def test_critical_hazard_severity_is_selectable_and_never_labelled_medium(self):
        self.login()
        self.page.evaluate('AdminHomePage.openCreateHazardModal()')
        self.page.locator('#ch-severity-chips').get_by_role('button',name='Critical',exact=True).click()
        self.assertEqual(self.page.evaluate('AdminHomePage._selectedSeverity'),'critical')
        self.page.evaluate("AdminHomePage.closeCreateHazardModal()")
        self.page.evaluate('(id)=>DetailModal.showHazard({id,title:"Critical fixture",severity:"critical",latitude:14.5,longitude:120.5})',self.hazard_id)
        expect(self.page.locator('#detail-modal-container')).to_contain_text('Critical Severity')

    def test_report_map_without_boundary_allows_drag_preview_but_blocks_saves(self):
        self.login();self.boundary.unlink();self.page.evaluate(MAP_INSTRUMENT);self.open_report()
        self.page.wait_for_function('()=>!!IncidentMap.session?.marker')
        expect(self.page.locator('#incident-leaflet-map')).to_be_visible()
        expect(self.page.locator('.map-boundary-warning')).to_contain_text('server')
        self.page.evaluate('IncidentMap.session.marker.events.dragend({latLng:{lat:()=>14.6,lng:()=>120.6}})')
        expect(self.page.locator('#incident-lat')).to_have_value('14.6')
        self.page.locator('#incident-gps-note').fill('Preview only; validation unavailable')
        self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        expect(self.page.locator('#incident-map-status')).to_contain_text('boundary')
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT latitude,longitude FROM reports WHERE id=?',[self.report_id]).fetchone(),(14.5,120.5))
            self.assertEqual(db.execute('SELECT COUNT(*) FROM report_events WHERE report_id=?',[self.report_id]).fetchone()[0],0)

    def test_hazard_map_without_boundary_keeps_pins_and_blocks_preview_save(self):
        self.boundary.unlink();self.main_hazard_map()
        self.page.evaluate('(id)=>HazardMap.session.markers.get(id).marker.events.dragend({latLng:{lat:()=>14.6,lng:()=>120.6}})',self.hazard_id)
        self.page.locator('.hazard-pin-form [name=note]').fill('Preview pin correction')
        self.page.get_by_role('button',name='Save pin location',exact=True).click()
        expect(self.page.locator('.hazard-pin-error')).to_contain_text('boundary')
        expect(self.page.locator('.hazard-live-map')).to_be_visible()
        self.page.get_by_role('button',name='Cancel repositioning',exact=True).click()
        self.assertEqual(self.page.evaluate('(id)=>HazardMap.session.markers.get(id).marker.getLatLng().lat',self.hazard_id),14.5)
        with sqlite3.connect(self.database) as db:self.assertEqual(db.execute('SELECT latitude FROM hazard_alerts WHERE id=?',[self.hazard_id]).fetchone()[0],14.5)
        self.page.screenshot(path=str(ARTIFACTS/'map-visible-without-boundary.png'),full_page=True)

    def test_map_config_network_failure_still_shows_citizen_map_and_read_only_pin(self):
        self.login(role='citizen')
        self.page.route('**/api/operations/map-config',lambda route:route.abort())
        self.page.evaluate("Router.navigate('hazards')")
        if self.page.locator('.hazards-toggle').inner_text()=='Map':self.page.locator('.hazards-toggle').click()
        self.page.wait_for_function('()=>!!HazardMap.session?.map')
        expect(self.page.locator('.hazard-live-map')).to_be_visible()
        expect(self.page.locator('.map-boundary-warning')).to_contain_text('shown for reference')
        self.assertTrue(self.page.evaluate('Array.from(HazardMap.session.markers.values()).every(e=>!e.marker.options.draggable)'))

    def test_report_save_recovers_when_boundary_becomes_available_without_reopening(self):
        self.login();self.boundary.unlink();self.open_report()
        self.page.wait_for_function('()=>!!IncidentMap.session?.marker')
        self.boundary.write_text(json.dumps(self.policy))
        self.page.locator('#incident-lat').fill('14.6')
        self.page.locator('#incident-lng').fill('120.6')
        self.page.locator('#incident-gps-note').fill('Boundary restored; verified entrance')
        self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        expect(self.page.locator('#incident-map-status')).to_contain_text('saved and audited')
        with sqlite3.connect(self.database) as db:self.assertEqual(db.execute('SELECT latitude,longitude FROM reports WHERE id=?',[self.report_id]).fetchone(),(14.6,120.6))

    def test_hazard_save_recovers_without_reopening_or_replacing_map_marker(self):
        self.boundary.unlink();self.main_hazard_map()
        self.page.evaluate('(id)=>{window.recoveryMap=HazardMap.session.map;window.recoveryPin=HazardMap.session.markers.get(id).marker;recoveryPin.events.dragend({latLng:{lat:()=>14.6,lng:()=>120.6}});}',self.hazard_id)
        self.boundary.write_text(json.dumps(self.policy))
        self.page.locator('.hazard-pin-form [name=note]').fill('Boundary restored; save on the same map')
        self.page.get_by_role('button',name='Save pin location',exact=True).click()
        expect(self.page.locator('.hazard-map-status')).to_contain_text('saved and audited')
        expect(self.page.locator('.map-boundary-warning')).not_to_be_visible()
        self.assertTrue(self.page.evaluate('(id)=>HazardMap.session.map===recoveryMap && HazardMap.session.markers.get(id).marker===recoveryPin',self.hazard_id))
        with sqlite3.connect(self.database) as db:self.assertEqual(db.execute('SELECT latitude,longitude FROM hazard_alerts WHERE id=?',[self.hazard_id]).fetchone(),(14.6,120.6))

    def test_manual_report_coordinates_create_pin_immediately_after_save(self):
        with sqlite3.connect(self.database) as db:db.execute('UPDATE reports SET latitude=NULL,longitude=NULL WHERE id=?',[self.report_id])
        self.login();self.open_report()
        self.page.wait_for_function('()=>!!IncidentMap.session?.map')
        self.page.locator('#incident-lat').fill('14.6');self.page.locator('#incident-lng').fill('120.6')
        self.page.locator('#incident-gps-note').fill('First verified incident GPS')
        self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        expect(self.page.locator('#incident-map-status')).to_contain_text('saved and audited')
        self.assertTrue(self.page.evaluate('!!IncidentMap.session.marker && IncidentMap.session.marker.getLatLng().lat===14.6'))

    def test_manual_coordinate_preview_is_unsaved_until_admin_confirms(self):
        self.login();self.open_report()
        self.page.wait_for_function('()=>!!IncidentMap.session?.marker')
        self.page.evaluate('window.previewPin=IncidentMap.session.marker')
        self.page.locator('#incident-lat').fill('14.6');self.page.locator('#incident-lng').fill('120.6')
        self.assertTrue(self.page.evaluate('IncidentMap.session.marker===previewPin && previewPin.getLatLng().lat===14.6 && previewPin.getLatLng().lng===120.6'))
        expect(self.page.locator('#incident-map-status')).to_contain_text('Unsaved')
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT latitude,longitude FROM reports WHERE id=?',[self.report_id]).fetchone(),(14.5,120.5))
        self.page.locator('#incident-lat').fill('')
        self.assertEqual(self.page.evaluate('previewPin.getLatLng().lat'),14.6)
        self.page.locator('#incident-lat').fill('14.6')
        self.page.locator('#incident-gps-note').fill('Confirmed manual coordinate preview')
        self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        expect(self.page.locator('#incident-map-status')).to_contain_text('saved and audited')
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT latitude,longitude FROM reports WHERE id=?',[self.report_id]).fetchone(),(14.6,120.6))

    def test_citizen_cannot_use_admin_report_pin_override(self):
        self.login(role='citizen')
        self.page.evaluate('(id)=>DetailModal.showIncident({id,title:"Citizen report",status:"pending_confirmation",latitude:14.5,longitude:120.5})',self.report_id)
        self.page.wait_for_function('()=>!!IncidentMap.session?.marker')
        expect(self.page.locator('#incident-coordinate-form')).to_have_count(0)
        self.assertFalse(self.page.evaluate('IncidentMap.session.marker.options.draggable'))
        auth=self.context.request.post(self.base+'/api/auth/login',data={'email':'other@browser.test','password':PASSWORD}).json()
        response=self.context.request.put(self.base+'/api/reports/'+str(self.report_id),headers={'Authorization':'Bearer '+auth['data']['token']},data={'latitude':14.6,'longitude':120.6,'note':'Unauthorized override'})
        self.assertEqual(response.status,403,response.text())
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT latitude,longitude FROM reports WHERE id=?',[self.report_id]).fetchone(),(14.5,120.5))

    def test_hazard_manual_preview_can_be_cancelled_without_saving(self):
        self.main_hazard_map()
        self.page.evaluate('(id)=>HazardMap.session.markers.get(id).marker.events.dragend({latLng:{lat:()=>14.6,lng:()=>120.6}})',self.hazard_id)
        self.page.locator('.hazard-pin-form [name=latitude]').fill('14.7')
        self.page.locator('.hazard-pin-form [name=longitude]').fill('120.7')
        self.assertEqual(self.page.evaluate('(id)=>HazardMap.session.markers.get(id).marker.getLatLng().lat',self.hazard_id),14.7)
        self.page.get_by_role('button',name='Cancel repositioning',exact=True).click()
        self.assertEqual(self.page.evaluate('(id)=>HazardMap.session.markers.get(id).marker.getLatLng().lat',self.hazard_id),14.5)
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT latitude,longitude FROM hazard_alerts WHERE id=?',[self.hazard_id]).fetchone(),(14.5,120.5))

    def install_published_morong_boundary(self):
        self.boundary.write_text((ROOT/'src/backend/data/morong-rizal.geojson').read_text())
        with sqlite3.connect(self.database) as db:
            db.execute('UPDATE reports SET latitude=14.515,longitude=121.239 WHERE id=?',[self.report_id])
            db.execute('UPDATE hazard_alerts SET latitude=14.515,longitude=121.239 WHERE id=?',[self.hazard_id])

    def test_published_morong_boundary_report_drag_save_reload_and_outside_rejection(self):
        self.install_published_morong_boundary();self.login();self.open_report()
        self.page.wait_for_function('()=>!!IncidentMap.session?.marker')
        expect(self.page.locator('.map-boundary-warning')).to_contain_text('not LGU-certified')
        self.page.locator('#incident-leaflet-map').scroll_into_view_if_needed()
        self.page.evaluate("IncidentMap.session.marker.getElement().dataset.actualMorongPin='target';window.actualMorongPin=IncidentMap.session.marker")
        box=self.page.locator('[data-actual-morong-pin=target]').bounding_box()
        self.page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
        self.page.mouse.down();self.page.mouse.move(box['x']+box['width']/2+24,box['y']+box['height']/2-16,steps=12);self.page.mouse.up()
        self.page.locator('#incident-gps-note').fill('Morong published-boundary entrance correction')
        with self.page.expect_response(lambda r:r.url.endswith('/api/reports/'+str(self.report_id)) and r.request.method=='PUT') as saved_response:
            self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        self.assertEqual(saved_response.value.status,200,saved_response.value.text())
        expect(self.page.locator('#incident-map-status')).to_contain_text('saved and audited')
        with sqlite3.connect(self.database) as db:
            saved=db.execute('SELECT latitude,longitude FROM reports WHERE id=?',[self.report_id]).fetchone()
            note=db.execute('SELECT note,actor_department FROM report_events WHERE report_id=? ORDER BY id DESC LIMIT 1',[self.report_id]).fetchone()
        self.assertNotEqual(saved,(14.515,121.239));self.assertEqual(note,('Morong published-boundary entrance correction','MDRRMO'))
        self.assertTrue(self.page.evaluate('IncidentMap.session.marker===actualMorongPin'))
        self.page.reload()
        self.page.locator('#incident-'+str(self.report_id)).get_by_role('button',name='Details',exact=True).click()
        self.page.wait_for_function('()=>!!IncidentMap.session?.marker')
        self.assertAlmostEqual(self.page.evaluate('IncidentMap.session.marker.getLatLng().lat'),saved[0],places=7)
        expect(self.page.locator('#detail-modal-history-body')).to_contain_text('Morong published-boundary entrance correction')
        self.page.locator('#incident-lat').fill('14.465');self.page.locator('#incident-lng').fill('121.191')
        self.page.locator('#incident-gps-note').fill('Outside-town negative test')
        with self.page.expect_response(lambda r:r.url.endswith('/api/reports/'+str(self.report_id)) and r.request.method=='PUT') as rejected:
            self.page.get_by_role('button',name='Save coordinates',exact=True).click()
        self.assertEqual(rejected.value.status,422)
        expect(self.page.locator('#incident-map-status')).to_contain_text('Morong')
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute('SELECT latitude,longitude FROM reports WHERE id=?',[self.report_id]).fetchone(),saved)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM report_events WHERE report_id=?',[self.report_id]).fetchone()[0],1)
        self.page.screenshot(path=str(ARTIFACTS/'published-morong-save-and-rejection.png'),full_page=True)

    def test_published_morong_boundary_hazard_drag_saves_and_citizen_submissions_are_bounded(self):
        self.install_published_morong_boundary();self.main_hazard_map()
        self.page.evaluate('(id)=>HazardMap.session.markers.get(id).marker.events.dragend({latLng:{lat:()=>14.516,lng:()=>121.24}})',self.hazard_id)
        self.page.locator('.hazard-pin-form [name=note]').fill('Morong responder hazard correction')
        self.page.get_by_role('button',name='Save pin location',exact=True).click()
        expect(self.page.locator('.hazard-map-status')).to_contain_text('saved and audited')
        with sqlite3.connect(self.database) as db:self.assertEqual(db.execute('SELECT latitude,longitude FROM hazard_alerts WHERE id=?',[self.hazard_id]).fetchone(),(14.516,121.24))
        auth=self.context.request.post(self.base+'/api/auth/login',data={'email':'citizen@browser.test','password':PASSWORD}).json()
        headers={'Authorization':'Bearer '+auth['data']['token']}
        payload={'title':'Published-boundary controlled incident','type':'Flood','location':'Morong, Rizal','latitude':14.515,'longitude':121.239}
        self.assertEqual(self.context.request.post(self.base+'/api/reports',headers=headers,data=payload).status,201)
        for lat,lng in [(14.465,121.191),(14.561,121.208),(14.70204547,120.32067693)]:
            response=self.context.request.post(self.base+'/api/reports',headers=headers,data={**payload,'latitude':lat,'longitude':lng})
            self.assertEqual(response.status,422,response.text())
        self.assertEqual(self.context.request.put(self.base+'/api/hazards/'+str(self.hazard_id)+'/location',headers=headers,data={'latitude':14.516,'longitude':121.24,'note':'Unauthorized'}).status,403)


if __name__=='__main__': unittest.main(verbosity=2)
