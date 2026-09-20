"""Structural/release contracts for the standalone roadmap app."""
import configparser
import csv
import json
from pathlib import Path
import re
import unittest
import xml.etree.ElementTree as ET

APP = Path(__file__).resolve().parents[1]


class AppContract(unittest.TestCase):
    def definition(self, name='studio_roadmap'):
        root = ET.parse(APP / 'default/data/ui/views' / (name + '.xml')).getroot()
        self.assertEqual(root.attrib['version'], '2')
        raw = root.findtext('definition')
        assert raw is not None
        return json.loads(raw)

    def test_app_identity_navigation_acl(self):
        conf = configparser.ConfigParser()
        conf.read(APP / 'default/app.conf')
        self.assertEqual(conf['package']['id'], 'cdp_roadmap')
        self.assertEqual(conf['ui']['label'], 'CDP Program Management')
        self.assertEqual(conf['launcher']['version'], json.loads((APP/'package.json').read_text())['version'])
        self.assertEqual(self.definition()['title'], 'CDP Program Management')
        self.assertEqual(conf['ui']['is_visible'], '1')
        self.assertEqual(conf['install']['state'], 'enabled')
        nav = ET.parse(APP / 'default/data/ui/nav/default.xml').getroot()
        default_view = nav.find("view[@default='true']")
        assert default_view is not None
        self.assertEqual(default_view.attrib['name'], 'roadmap')
        for view in nav.findall('view'):
            self.assertTrue((APP / 'default/data/ui/views' / (view.attrib['name'] + '.xml')).is_file())
        editor_link = nav.find('a')
        assert editor_link is not None
        self.assertIn('namespace=cdp_roadmap', editor_link.attrib['href'])
        meta = (APP / 'metadata/default.meta').read_text()
        self.assertIn('read : [ admin ], write : [ admin ]', meta)
        self.assertIn('export = none', meta)

    def test_native_timeline_and_parseable_start_times(self):
        d = self.definition()
        timeline = d['visualizations']['viz_timeline']
        self.assertEqual(timeline['type'], 'splunk.timeline')
        self.assertNotIn('timeline_app', json.dumps(d))
        self.assertIn('strftime(start_epoch,"%Y-%m-%dT%H:%M:%S")', d['dataSources']['ds_timeline']['options']['query'])
        self.assertEqual(timeline['options']['x'], "> primary | seriesByName('start_iso')")
        self.assertIn('duration', timeline['options'])

    def test_one_bounded_base_direct_chains(self):
        d = self.definition()
        roots = [key for key, value in d['dataSources'].items() if value['type'] == 'ds.search']
        self.assertEqual(roots, ['ds_roadmap'])
        base = d['dataSources']['ds_roadmap']['options']
        self.assertEqual(base['queryParameters'], {'earliest': '-24h', 'latest': 'now'})
        self.assertIn('inputlookup max=1001 cdp_roadmap.csv', base['query'])
        self.assertNotIn('$', base['query'])
        for key, ds in d['dataSources'].items():
            if ds['type'] == 'ds.chain':
                self.assertEqual(ds['options']['extend'], 'ds_roadmap', key)
                self.assertNotIn('queryParameters', ds['options'])
        self.assertNotIn('index=*', json.dumps(d))
        self.assertNotIn('outputlookup', json.dumps(d))

    def test_references_and_safe_default_filters(self):
        d = self.definition()
        for obj in list(d['visualizations'].values()) + list(d['inputs'].values()):
            for ref in obj.get('dataSources', {}).values():
                self.assertIn(ref, d['dataSources'])
        self.assertEqual(len(d['inputs']), 3)
        for obj in d['inputs'].values():
            self.assertEqual(obj['options']['defaultValue'], '__all__')
        for ds in d['dataSources'].values():
            for token in re.findall(r'\$([^$]+)\$', ds['options']['query']):
                self.assertIn(token, ['workstream|s', 'status|s', 'owner|s'])
        for layout in d['layout']['layoutDefinitions'].values():
            for block in layout['structure']:
                self.assertIn(block['item'], d['visualizations'])

    def test_seed_and_legacy_guide_alias(self):
        with (APP / 'lookups/cdp_roadmap.csv').open() as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 8)
        self.assertEqual(len({row['id'] for row in rows}), 8)
        views = APP / 'default/data/ui/views'
        self.assertEqual((views / 'guide.xml').read_bytes(), (views / 'roadmap.xml').read_bytes())
        nav = ET.parse(APP / 'default/data/ui/nav/default.xml').getroot()
        self.assertIsNone(nav.find("view[@name='guide']"))
        definition = self.definition()
        self.assertEqual(definition['visualizations']['viz_timeline']['title'], 'Projects Scheulde')
        self.assertNotIn('Editing guide', json.dumps(definition))
        self.assertNotIn('viz_note', definition['visualizations'])

    def test_roadmap_has_a_separate_tab(self):
        d = self.definition()
        self.assertEqual([tab['label'] for tab in d['layout']['tabs']['items']], ['Overview', 'Roadmap'])
        layouts = d['layout']['layoutDefinitions']
        self.assertNotIn('viz_timeline', [b['item'] for b in layouts['layout_overview']['structure']])
        self.assertIn('viz_timeline', [b['item'] for b in layouts['layout_roadmap']['structure']])


if __name__ == '__main__':
    unittest.main()
