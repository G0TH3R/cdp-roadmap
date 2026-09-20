"""Production package and host-page contracts; no live state or credentials."""
import hashlib
import json
from pathlib import Path
import re
import tarfile
import unittest
import xml.etree.ElementTree as ET

APP = Path(__file__).resolve().parents[1]


class ReactRelease(unittest.TestCase):
    def test_week_gridline_uses_theme_tokens_and_preserves_hierarchy(self):
        css = (APP/'src/web/style.css').read_text()
        self.assertIn('--week-gridline:#3c4650', css)
        self.assertIn('--month-gridline:#5b6975', css)
        self.assertIn('--week-gridline:#aab4bd', css)
        self.assertIn('--month-gridline:#7e8b97', css)
        self.assertIn('.week-gridline{border-left-color:var(--week-gridline);opacity:1}', css)
        self.assertRegex(css, r'\.month\{[^}]*border-left-color:var\(--month-gridline\)')

    def test_canonical_host_and_versioned_assets(self):
        view = ET.parse(APP/'default/data/ui/views/roadmap.xml').getroot()
        self.assertEqual(view.attrib['version'], '1.1')
        self.assertEqual(view.attrib['theme'], 'dark')
        self.assertEqual(view.findtext('label'), 'CDP Program Management')
        self.assertIsNotNone(view.find(".//div[@id='cdp-schedule-root']"))
        for attr in ['script','stylesheet']:
            self.assertIn(json.loads((APP/'package.json').read_text())['version'].replace('.', '-'),view.attrib[attr])
            self.assertTrue((APP/'appserver/static'/view.attrib[attr]).is_file())
        for tag in ['panel','row']:
            for el in view.findall('.//'+tag):
                if 'id' in el.attrib:
                    self.assertRegex(el.attrib['id'],r'^[A-Za-z_][A-Za-z0-9_]*$')

    def test_bounded_read_only_bootstrap(self):
        view = ET.parse(APP/'default/data/ui/views/roadmap.xml').getroot()
        text = (APP/'appserver/static'/view.attrib['script']).read_text()
        self.assertIn("require(['splunkjs/mvc/searchmanager'",text)
        self.assertNotIn('window.require',text)
        self.assertIn('inputlookup max=1001 cdp_roadmap.csv',text)
        self.assertIn("earliest_time: '-24h', latest_time: 'now'",text)
        self.assertIn('namespace=cdp_roadmap&lookup=cdp_roadmap.csv',text)
        self.assertNotIn('CDP-001',text)
        self.assertNotIn('index=*',text)
        self.assertNotIn('outputlookup',text)
        self.assertNotRegex(text,r'https?://[^\s"\']*(?:unpkg|jsdelivr|googleapis)')

    def test_archive_matches_current_sources_and_manifest(self):
        manifest=json.loads((APP/'build/manifest.json').read_text())
        package=APP/'build'/manifest['package']
        self.assertEqual(hashlib.sha256(package.read_bytes()).hexdigest(),manifest['package_sha256'])
        with tarfile.open(package,'r:gz') as archive:
            names=[]
            for member in archive.getmembers():
                self.assertTrue(member.isfile())
                self.assertEqual(member.mtime,1577836800)
                self.assertTrue(member.name.startswith('cdp_roadmap/'))
                rel=member.name.removeprefix('cdp_roadmap/')
                self.assertIn(rel.split('/')[0],['default','metadata','lookups','appserver'])
                self.assertFalse((APP/rel).is_symlink())
                extracted=archive.extractfile(member)
                assert extracted is not None
                blob=extracted.read()
                self.assertEqual(blob,(APP/rel).read_bytes())
                self.assertEqual(hashlib.sha256(blob).hexdigest(),manifest['runtime_files'][rel])
                names.append(rel)
            self.assertEqual(len(names),len(set(names)))
            self.assertEqual(set(names),set(manifest['runtime_files']))

    def test_lookup_has_exact_timeline_labels_and_normalized_release_project(self):
        import csv
        with (APP/'lookups/cdp_roadmap.csv').open(newline='') as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual([row['id'] for row in rows], [f'CDP-{i:03d}' for i in range(1, 9)])
        self.assertEqual([row['timeline_label'] for row in rows], [
            'Scope & Success', 'Data Ownership', 'Source Onboarding', 'Data Quality',
            'Support Handover', 'Go-Live Decision', 'Architecture Review', 'Pilot Readiness'])
        self.assertEqual(rows[0]['project'], 'Release 1.0')
        self.assertEqual({row['project'] for row in rows[:6]}, {'Release 1.0'})
        self.assertEqual({row['project'] for row in rows[6:]}, {'Release 1.1'})


if __name__ == '__main__':
    unittest.main()
