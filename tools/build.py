#!/usr/bin/env python3
"""Generate the Studio fallback. Package with build_release.py."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
from xml.sax.saxutils import escape

APP = Path(__file__).resolve().parents[1]
FILTER = 'where ($workstream|s$="__all__" OR workstream=$workstream|s$) AND ($status|s$="__all__" OR status=$status|s$) AND ($owner|s$="__all__" OR owner=$owner|s$)'
EDITOR = '/en-US/app/lookup_editor/lookup_edit?namespace=cdp_roadmap&lookup=cdp_roadmap.csv&type=csv&owner=nobody'


def chain(query):
    return {'type': 'ds.chain', 'options': {'extend': 'ds_roadmap', 'query': query}}


def block(item, x, y, w, h):
    return {'item': item, 'type': 'block', 'position': {'x': x, 'y': y, 'w': w, 'h': h}}


def layout(blocks, height, inputs=None):
    return {'globalInputs': inputs or [], 'layoutDefinitions': {'layout_main': {
        'type': 'absolute', 'options': {'display': 'auto-scale', 'width': 1440, 'height': height},
        'structure': blocks}}, 'tabs': {'items': [{'label': 'Overview', 'layoutId': 'layout_main'}]}}


def write_view(name, doc, view_name=None):
    serialized = json.dumps(doc, indent=2, ensure_ascii=False) + '\n'
    assert ']]>' not in serialized
    (APP / 'src' / (name + '.json')).write_text(serialized)
    target = APP / 'default/data/ui/views' / ((view_name or name) + '.xml')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('<dashboard version="2" theme="light">\n  <label>' + escape(doc['title']) + '</label>\n  <description>' + escape(doc['description']) + '</description>\n  <definition><![CDATA[\n' + serialized + ']]></definition>\n</dashboard>\n')


def main():
    sources = {
        'ds_roadmap': {'type': 'ds.search', 'name': 'Roadmap lookup — capped and validated', 'options': {
            'query': (APP / 'src/base.spl').read_text().strip(),
            'queryParameters': {'earliest': '-24h', 'latest': 'now'}}},
        'ds_timeline': chain(FILTER + '\n| where validation="OK"\n| sort 0 start_epoch id\n| head 1000\n| eval start_iso=strftime(start_epoch,"%Y-%m-%dT%H:%M:%S")\n| table start_iso item duration status owner workstream acceptance_criteria'),
        'ds_details': chain(FILTER + '\n| sort 0 start_date id\n| head 1000\n| table id project workstream milestone timeline_label owner status start_date end_date dependency_ids acceptance_criteria validation'),
        'ds_summary': chain(FILTER + '\n| stats count AS entries count(eval(status="In progress")) AS in_progress count(eval(status="At risk" OR status="Blocked")) AS attention count(eval(duration=0 AND validation="OK")) AS milestones'),
        'ds_health': chain('stats count AS rows_read count(eval(validation!="OK")) AS invalid_entries\n| eval health=if(invalid_entries>0,"Invalid entries","No validation errors"), coverage=if(rows_read>1000,"LIMIT EXCEEDED: only first 1,001 rows checked","Within 1,000-entry limit")\n| table rows_read invalid_entries health coverage'),
        'ds_workstreams': chain('stats count BY workstream | where workstream!="__all__" | sort 0 workstream | fields workstream'),
        'ds_owners': chain('stats count BY owner | where owner!="__all__" | sort 0 owner | fields owner'),
    }
    visualizations = {
        'viz_header': {'type': 'splunk.markdown', 'options': {'markdown': '## CDP Program Management\nAuthor: G0TH3R · [Edit entries](' + EDITOR + ')'}},
        'viz_timeline': {'type': 'splunk.timeline', 'title': 'Projects Scheulde', 'dataSources': {'primary': 'ds_timeline'}, 'options': json.loads((APP / 'src/timeline_options.json').read_text())},
        'viz_details': {'type': 'splunk.table', 'title': 'Entry register', 'dataSources': {'primary': 'ds_details'}, 'options': {'count': 10, 'wrap': True, 'rowNumbers': False, 'dataOverlayMode': 'none'}},
        'viz_health': {'type': 'splunk.table', 'title': 'Lookup health · all entries before filters', 'dataSources': {'primary': 'ds_health'}, 'options': {'count': 1, 'wrap': True, 'rowNumbers': False, 'dataOverlayMode': 'none'}},

    }
    visualizations['viz_timeline']['context'] = {'statusColors': [
        {'match': status, 'value': color} for status, color in [
            ('Planned', '#64748B'), ('In progress', '#0284C7'), ('At risk', '#D97706'),
            ('Blocked', '#DC2626'), ('Complete', '#16A34A')]]}
    for name, field, title in [('entries', 'entries', 'Entries'), ('progress', 'in_progress', 'In progress'), ('attention', 'attention', 'At risk / blocked'), ('milestones', 'milestones', 'Milestone points')]:
        visualizations['viz_' + name] = {'type': 'splunk.singlevalue', 'title': title, 'dataSources': {'primary': 'ds_summary'}, 'options': {'majorValue': "> primary | seriesByName('" + field + "')"}}
    inputs = json.loads((APP / 'src/inputs.json').read_text())
    positions = [block('viz_header', 16, 8, 1408, 90)]
    for i, name in enumerate(['entries', 'progress', 'attention', 'milestones']):
        positions.append(block('viz_' + name, 16 + i * 356, 104, 340, 104))
    positions += [block('viz_details', 16, 222, 1408, 420), block('viz_health', 16, 656, 1408, 115)]
    tabs = layout(positions, 785, list(inputs))
    tabs['layoutDefinitions']['layout_overview'] = tabs['layoutDefinitions'].pop('layout_main')
    tabs['layoutDefinitions']['layout_roadmap'] = {
        'type': 'absolute', 'options': {'display': 'auto-scale', 'width': 1440, 'height': 600},
        'structure': [block('viz_header', 16, 8, 1408, 90), block('viz_timeline', 16, 104, 1408, 480)]}
    tabs['tabs']['items'] = [{'label': 'Overview', 'layoutId': 'layout_overview'}, {'label': 'Roadmap', 'layoutId': 'layout_roadmap'}]
    roadmap = {'title': 'CDP Program Management', 'description': 'Projects, activities, ownership, and delivery status.', 'inputs': inputs, 'defaults': {'visualizations': {'global': {'showProgressBar': True, 'showLastUpdated': False}}}, 'visualizations': visualizations, 'dataSources': sources, 'layout': tabs}
    write_view('roadmap', roadmap, view_name='studio_roadmap')
    print('Generated native Studio fallback.')


if __name__ == '__main__':
    main()
