"""Keep optional project categories aligned across SPL, Studio and package sources."""
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

APP = Path(__file__).resolve().parents[1]
CATEGORIES = ['Observability', 'Security', 'Infrastructure', 'Automation & Analytics', 'OT/ICS']


class CategoryContract(unittest.TestCase):
    def test_studio_category_control_and_filtered_details(self):
        root = ET.parse(APP/'default/data/ui/views/studio_roadmap.xml').getroot()
        raw = root.findtext('definition')
        assert raw is not None
        doc = json.loads(raw)
        control = doc['inputs']['input_project_category']
        self.assertEqual(control['title'], 'Project Category')
        self.assertEqual(control['options']['defaultValue'], '__all__')
        self.assertEqual([item['value'] for item in control['options']['items'][1:-1]], CATEGORIES)
        self.assertEqual(control['options']['items'][-1], {'label': 'Uncategorized', 'value': ''})
        self.assertIn('$project_category|s$', doc['dataSources']['ds_details']['options']['query'])
        self.assertIn('table id project project_category workstream', doc['dataSources']['ds_details']['options']['query'])
        self.assertEqual(doc['inputs'], json.loads((APP/'src/inputs.json').read_text()))

    def test_bounded_spl_keeps_legacy_and_category_validation(self):
        spl = (APP/'src/base.spl').read_text()
        self.assertTrue(spl.startswith('| inputlookup max=1001 cdp_roadmap.csv'))
        self.assertIn('project_category=trim(coalesce(project_category,""))', spl)
        self.assertIn('category_value="category:".project_category', spl)
        self.assertIn('eventstats dc(category_value) AS project_category_count BY project', spl)
        for category in CATEGORIES:
            self.assertIn(json.dumps(category), spl)
        self.assertIn('"Unsupported project category"', spl)
        self.assertIn('len(project)>0 AND project_category_count>1', spl)
        self.assertIn('table id project project_category workstream', spl)
        self.assertNotIn('outputlookup', spl)


if __name__ == '__main__':
    unittest.main()
