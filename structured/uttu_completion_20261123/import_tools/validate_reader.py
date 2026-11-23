"""Re-read compressed sources and verify the published reader independently."""
from collections import Counter
import gzip
from hashlib import sha256
import json
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[1]
sys.path.insert(0,str(ROOT/'import_tools'))
from uttu_render import Renderer,LABELS,norm

def read(path):return json.loads(path.read_text(encoding='utf-8'))
def packed(name):
    with gzip.open(ROOT/'sources'/name,'rt',encoding='utf-8') as f:return json.load(f)

coverage=read(ROOT/'coverage.json');forums=packed('forums.json.gz');notes=packed('notes.json.gz')
total=Counter()
for locale,edition in coverage['editions'].items():
    sources=packed(locale+'.json.gz');manifest={(u['route'],u['number']):u for u in edition['units']}
    chapters={c['route']:c for c in edition['chapters'] if c['route']};stats=Counter()
    for source in sources:
        route=source['route'];chapter=chapters[route];text=(REPO/chapter['path']).read_text(encoding='utf-8')
        blocks={int(m[1]):m[2] for m in re.finditer(r'^<a id="episode-(\d+)"></a>\n(.*?)(?=^<a id="episode-|\Z)',text,re.M|re.S)}
        detail=source['details'];modal=detail.get('modal_parts',{})
        for row in source['payload']['chapters']:
            unit=manifest[route,str(row['number'])];renderer=Renderer(locale,forums,notes)
            expected=renderer.render(row.get('content',''));extra=modal.get(str(row['number']),{})
            if extra.get('fragment'):expected=renderer.trail(extra['fragment'],detail['data'])
            if extra.get('dialogs'):expected=renderer.trail({'dialogSteps':extra['dialogs'][{'zh-CN':'chs','en':'en','ja':'jp','ko':'kr','zh-TW':'cht'}[locale]]},detail['data'])
            if extra.get('group_header'):expected='> 本节为分组标题，后续各节收录本组剧情。'
            if additional:=renderer.extra_notes():expected+='\n\n'+additional
            actual=re.search(r'<!-- uttu-body:start -->\n(.*?)\n<!-- uttu-body:end -->',blocks[unit['episode_id']],re.S)[1]
            if not norm(expected):actual=''
            assert expected==actual,(locale,route,row['number'],'Source-to-reader mismatch',repr(expected[:80]),repr(actual[:80]))
            assert sha256(actual.encode()).hexdigest()==unit['rendered_body_sha256']
            stats.update(renderer.stats);stats['source_units']+=1
        for key,row in detail['rows'].items():
            renderer=Renderer(locale,forums,notes);expected=renderer.trail(row,detail['data'])
            if extra:=renderer.extra_notes():expected+='\n\n'+extra
            pattern=r'^### '+LABELS[locale][5]+r' · [^\n]+\n\n- [^\n：]+：`'+key+r'`\n(.*?)(?=^### |^---\s*$|\Z)'
            found=re.search(pattern,text,re.M|re.S);assert found,(locale,route,key,'Missing Trail')
            assert norm(expected) in norm(found[1]),(locale,route,key,'Incomplete Trail text')
            stats.update(renderer.stats);stats['source_trails']+=1
    for key in ['source_units','source_trails','text_nodes','forum_posts','choices','responses']:
        assert stats[key]==edition['counts'][key],(locale,key,stats[key],edition['counts'][key])
    total.update(stats)
    print('Replayed source text:',locale,stats['source_units'],'parts;',stats['source_trails'],'Trails; all matched.',flush=True)
print('Verified compressed-source replay:',dict(total),flush=True)
