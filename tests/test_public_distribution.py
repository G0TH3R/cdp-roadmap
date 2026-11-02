"""Public release guards: synthetic data, neutral authorship and no private exports."""
import configparser
import csv
import json
from pathlib import Path
import re
import subprocess
import tarfile
import unittest
import xml.etree.ElementTree as ET

APP = Path(__file__).resolve().parents[1]


class PublicDistribution(unittest.TestCase):
    def test_no_personal_app_author_and_legacy_category_compatibility(self):
        conf=configparser.ConfigParser()
        conf.read(APP/'default/app.conf')
        self.assertEqual(conf['launcher'].get('author','').strip(),'')
        root=ET.parse(APP/'default/data/ui/views/studio_roadmap.xml').getroot()
        raw=root.findtext('definition')
        assert raw is not None
        definition=json.loads(raw)
        self.assertNotIn('Author:',definition['visualizations']['viz_header']['options']['markdown'])
        self.assertIn('coalesce(project_category,"")',(APP/'src/base.spl').read_text())

    def test_archive_has_only_dummy_csv_and_neutral_ownership(self):
        manifest=json.loads((APP/'build/manifest.json').read_text())
        with tarfile.open(APP/'build'/manifest['package']) as archive:
            for member in archive.getmembers():
                self.assertEqual((member.uid,member.gid,member.uname,member.gname),(0,0,'',''))
            lookups=[m for m in archive.getmembers() if '/lookups/' in m.name]
            self.assertEqual([m.name for m in lookups],['cdp_roadmap/lookups/cdp_roadmap.csv'])
            handle=archive.extractfile(lookups[0])
            assert handle is not None
            self.assertEqual(handle.read(),(APP/'lookups/cdp_roadmap.csv').read_bytes())
        with (APP/'lookups/cdp_roadmap.csv').open(newline='') as source:
            rows=list(csv.DictReader(source))
        self.assertEqual(len(rows),8)
        self.assertTrue(all(r['id'].startswith('DEMO-') and r['project'].startswith('Example ') and r['owner'].startswith('Example Owner ') for r in rows))

    def test_required_library_notices_are_preserved(self):
        manifest=json.loads((APP/'build/manifest.json').read_text())
        with tarfile.open(APP/'build'/manifest['package']) as archive:
            javascript=[]
            for member in archive.getmembers():
                if member.name.endswith('.js'):
                    handle=archive.extractfile(member)
                    assert handle is not None
                    javascript.append(handle.read().lower())
        notices=b'\n'.join(javascript)
        self.assertIn(b'@license react',notices)
        self.assertIn(b'mit license',notices)

    def test_public_tree_has_no_operational_exports_or_obvious_secrets(self):
        paths=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=APP).decode().split('\0')
        forbidden={'planning','local','var','node_modules','public-repo'}
        patterns={
            'home path':rb'/(?:Users|home)/[A-Za-z0-9._-]+/',
            'private IPv4':rb'\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b',
            'GitHub token':rb'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})',
            'private key':rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
        }
        for relative in filter(None,paths):
            path=Path(relative)
            self.assertFalse(set(path.parts)&forbidden,relative)
            self.assertFalse('receipt' in path.name or path.name.startswith(('live-after-','live-baseline')),relative)
            self.assertNotIn(path.suffix,{'.tgz','.zip','.bak'},relative)
            full=APP/path
            if full.is_file() and path.suffix not in {'.png','.jpg','.jpeg'}:
                content=full.read_bytes()
                for label,pattern in patterns.items():
                    self.assertFalse(bool(re.search(pattern,content)),f'{label} in {relative}')


if __name__=='__main__':
    unittest.main()
