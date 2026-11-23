"""Build a complete UTTU-referenced reader while preserving client-only text.

All writes go to --output. This script never edits its input repository.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import gzip
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import quote, unquote

from uttu_render import Renderer, LABELS, LANGS, escape, norm, plain

CATEGORIES={'main':'mainline','event':'activity','character':'character','anecdote':'anecdote','other':'other','trails':'trails'}
NAMES={'zh-CN':'简体中文','en':'English','ja':'日本語','ko':'한국어','zh-TW':'繁體中文'}
UI={
 'zh-CN':('《重返未来：1999》简体中文剧情阅读版','返回多语言目录','剧情单元','目录','返回目录','上一章','下一章','主线','活动剧情','角色剧情','轶事','其他剧情','独立小径'),
 'en':('Reverse: 1999 Story and Trail Reader','Back to all languages','Story units','Contents','Story index','Previous chapter','Next chapter','Main Story','Event Story','Character Story','Anecdotes','Other Stories','Standalone Trails'),
 'ja':('『リバース：1999』ストーリー・小径アーカイブ','言語一覧へ戻る','ストーリーユニット','目次','目次へ','前の章','次の章','メインストーリー','イベントストーリー','キャラクターストーリー','エピソード','その他のストーリー','独立した小径'),
 'ko':('리버스: 1999 스토리·트레일 아카이브','언어 목록으로 돌아가기','스토리 유닛','목차','목차로','이전 챕터','다음 챕터','메인 스토리','이벤트 스토리','캐릭터 스토리','일화','기타 스토리','독립 트레일'),
 'zh-TW':('《重返未來：1999》繁體中文劇情閱讀版','返回多語言目錄','劇情單元','目錄','返回目錄','上一章','下一章','主線','活動劇情','角色劇情','軼事','其他劇情','獨立小徑'),
}
REPORT=Path('structured/uttu_completion_20261123')
READER=Path('readable/story_reader_linked')


def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def safe_filename(value):
    return re.sub(r'\s+',' ',re.sub(r'[<>:"/\\|?*\x00-\x1f]','_',value)).strip().rstrip('.')[:100]


def originals(repo,locale):
    pages={}
    for path in (repo/READER/locale).glob('*/*.md'):
        text=path.read_text(encoding='utf-8');title=re.match(r'# (\d+) · ([^\n]*)',text)
        assert title,path
        cid=int(title[1]);episodes=[]
        blocks=list(re.finditer(r'^((?:<a id="episode-\d+"></a>\n)+)## (\d+) · ([^\n]*)\n',text,re.M))
        for i,match in enumerate(blocks):
            block=text[match.end():blocks[i+1].start() if i+1<len(blocks) else len(text)]
            block=re.split(r'^<!-- reading-navigation:start -->',block,flags=re.M)[0].strip()
            block=re.sub(r'\n---\s*$','',block).strip()
            trails=[]
            pattern=r'^### '+LABELS[locale][5]+r' · ([^\n]*)\n'
            trail_starts=list(re.finditer(pattern,block,re.M))
            body=block[:trail_starts[0].start()].strip() if trail_starts else block
            for j,start in enumerate(trail_starts):
                trail=block[start.start():trail_starts[j+1].start() if j+1<len(trail_starts) else len(block)].strip()
                eid=re.search(r'^- [^\n：]+：`(\d+)`',trail,re.M)
                assert eid,(path,trail[:100])
                trails.append({'element_id':int(eid[1]),'title':start[1],'original':trail})
            aliases=[int(x) for x in re.findall(r'episode-(\d+)',match[1]) if int(x)!=int(match[2])]
            episodes.append({'episode_id':int(match[2]),'title':match[3],'body':body,'trails':trails,'aliases':aliases})
        pages[cid]={'chapter_id':cid,'title':title[2],'path':path.relative_to(repo).as_posix(),
                    'category':path.parent.name,'episodes':episodes}
    return pages


def original_needed(body,remote):
    """Keep the complete client passage if any substantive line is absent."""
    cleaned=norm(plain(remote))
    for line in body.splitlines():
        if not line.strip() or line.startswith(('#','<!--','<a ','> **副标题','> **Subtitle','> **サブタイトル','> **부제','> **副標題')):continue
        if re.match(r'^- (?:元素|Element|要素|요소|说明|Description|説明|설명|說明|操作|Action|동작|动作|動作)[：:]',line):continue
        if re.match(r'^>\s*(?:The client has no|このエピソードには|클라이언트에|客戶端未提供|本关卡没有)',line):continue
        line=re.sub(r'^[- >]*\*\*(?:标题卡|Title card|タイトルカード|타이틀 카드|標題卡|选项|Choice|選択肢|선택지|選項)[：:]?\*\*[：:]?\s*','',line)
        key=norm(plain(line))
        if len(key)>=4 and key not in cleaned:return True
    return False


def client_supplement(body,locale):
    if not body.strip():return ''
    return ('\n\n<details>\n<summary>'+LABELS[locale][4]+'</summary>\n\n'
            '<!-- client-body:start -->\n'+body.strip()+'\n<!-- client-body:end -->\n\n</details>')


def build(args):
    repo,cache,out=args.repo,args.cache,args.output
    assert repo.resolve()!=out.resolve(),'The output must be a staging directory'
    assert not (repo/REPORT).exists(),'Use the client baseline at commit 7820ec20 as --repo; see the import documentation.'
    assert not out.exists(),'Choose a new output directory'
    out.mkdir(parents=True)
    catalog={}
    for entry in read(cache/'catalog.json'):
        route=unquote(entry['route'])
        if route not in catalog:catalog[route]={**entry,'route':route}
    excluded={route:'网站开发模板或临时颜色测试页面，非剧情篇目。' for route in catalog
              if route.endswith('/dummy') or route.endswith('/colour-check')}
    entries={r:e for r,e in catalog.items() if r not in excluded}
    audit=read(repo/'structured/story_reader_audit_20261122/audit.json')
    chapter_map={r:cid for r,cid in audit['chapter_map'].items() if cid is not None}
    if (cache/'chapter_map.json').exists():chapter_map.update(read(cache/'chapter_map.json')['chapter_map'])
    all_old={loc:originals(repo,loc) for loc in LANGS}
    used_ids={cid for pages in all_old.values() for cid in pages}
    used_ids.update(chapter_map.values())
    for route in entries:
        if route in chapter_map:continue
        payload=None
        for locale in LANGS:
            f=cache/route/(locale+'.json')
            if f.exists() and (payload:=read(f).get('payload')):break
        assert payload,('Missing chapter source',route)
        cid=payload['frontmatter'].get('partsID')
        if not isinstance(cid,int) or cid in used_ids:
            cid=900001
            while cid in used_ids:cid+=1
        chapter_map[route]=cid;used_ids.add(cid)
    write(out/REPORT/'chapter_map.json',{'chapter_map':chapter_map,'synthetic_id_range':'900000–999999',
           'note':'既有文件及锚点沿用；无可用游戏章节号的 UTTU 篇目使用阅读版专用编号。'})
    notes=read(cache/'notes.json');forums=read(cache/'bbs-data.json')
    manifest={'source':'https://uttu.merui.net/','date':'2026-11-23','routes':len(entries),'excluded_routes':excluded,
              'editions':{},'unavailable_sources':[],'source_preservation':'UTTU 正文作为对照正文；客户端独有内容另附于同节。'}
    outputs={};new_chapters=0;new_episodes=0
    for locale in LANGS:
        print('Building',locale,flush=True)
        pages=all_old[locale];ui=UI[locale];chapters=[];source_pack=[];stats=Counter();unit_manifest=[]
        matched_old=set();source_order={r:i for i,r in enumerate(entries)}
        prior={r['route']:r for r in audit['editions'][locale]['matched_chapters']}
        for route,entry in entries.items():
            source=cache/route/(locale+'.json')
            if not source.exists():continue  # The site's catalog marks this chapter CN-only.
            raw=read(source)
            if not raw.get('success') or not raw.get('payload'):
                manifest['unavailable_sources'].append({'route':route,'locale':locale,'url':raw['url'],'error':raw.get('error')})
                continue
            payload=raw['payload'];fm=payload['frontmatter'];cid=chapter_map[route];old=pages.get(cid)
            if old:matched_old.add(cid)
            else:new_chapters+=1;stats['new_chapters']+=1
            title=plain(fm.get('localeTitle') or fm.get('title') or entry['text']).strip()
            assert title,(route,locale,'Empty chapter title')
            category=old['category'] if old else CATEGORIES[route.split('/')[1]]
            path=Path(old['path']) if old else READER/locale/category/(str(cid)+'-'+safe_filename(title)+'.md')
            detail=read(cache/route/'details.json');assert detail.get('success'),route
            modal=read(cache/route/'modal_parts.json') if (cache/route/'modal_parts.json').exists() else {}
            trail_rows=detail['rows'].get(locale,{})
            data=detail['data'];rendered_trails={};old_trails={}
            if old:
                old_trails={t['element_id']:(e['episode_id'],t) for e in old['episodes'] for t in e['trails']}
            # Every localized popup row is rendered once, even if its branch is inactive.
            for key,row in trail_rows.items():
                renderer=Renderer(locale,forums,notes);content=renderer.trail(row,data);extra=renderer.extra_notes()
                if extra:content+='\n\n'+extra
                block='### '+LABELS[locale][5]+' · '+escape(row.get('title') or key)+'\n\n- '+LABELS[locale][6]+'：`'+key+'`\n\n'+content
                if int(key) in old_trails:
                    original=old_trails[int(key)][1]['original']
                    oldbody=re.split(r'^- [^\n：]+：`\d+`\n',original,maxsplit=1,flags=re.M)[-1]
                    metadata=re.findall(r'^- (?:说明|Description|説明|설명|說明|操作|Action|동작|动作|動作)[：:][^\n]*',oldbody,re.M)
                    if metadata:block+='\n\n'+'\n'.join(metadata)
                    if original_needed(oldbody,content):block+=client_supplement(oldbody,locale);stats['preserved_client_trails']+=1
                rendered_trails[int(key)]={'title':row.get('title') or key,'content':block,'source':row}
                stats.update(renderer.stats);stats['source_trails']+=1
            unused={e['episode_id']:e for e in old['episodes']} if old else {}
            episodes=[];remote_numbers=set();old_lookup={str(p['number']):p.get('local_episode_id') for p in prior.get(route,{}).get('parts',[])}
            for row in payload['chapters']:
                number=str(row['number']);assert number not in remote_numbers,(route,locale,number);remote_numbers.add(number)
                eid=old_lookup.get(number)
                if eid not in unused:
                    title_matches=[e['episode_id'] for e in unused.values() if norm(e['title'])==norm(plain(row['title']))]
                    numeric=[e['episode_id'] for e in unused.values() if str(e['episode_id']%100)==number]
                    eid=title_matches[0] if len(title_matches)==1 else numeric[0] if len(numeric)==1 else None
                previous=unused.pop(eid,None) if eid is not None else None
                if previous is None:
                    candidate=cid*100+int(number)
                    used_eids={e['episode_id'] for e in episodes}|set(unused)
                    while candidate in used_eids:candidate+=1
                    eid=candidate;new_episodes+=1;stats['new_episodes']+=1
                renderer=Renderer(locale,forums,notes);content=renderer.render(row.get('content',''))
                modal_row=modal.get(number,{})
                if modal_row.get('fragment'):
                    content=renderer.trail(modal_row['fragment'],data);stats['modal_fragments']+=1
                if modal_row.get('dialogs'):
                    dialogs=modal_row['dialogs'].get(LANGS[locale])
                    assert dialogs,(route,number,locale)
                    content=renderer.trail({'dialogSteps':dialogs},data);stats['modal_dialogues']+=1
                if modal_row.get('group_header'):
                    content='> 本节为分组标题，后续各节收录本组剧情。';stats['group_headers']+=1
                extra=renderer.extra_notes()
                if extra:content+='\n\n'+extra
                stats.update(renderer.stats)
                if not norm(content):stats['source_empty_units']+=1
                body='<!-- uttu-body:start -->\n'+(content or '> '+LABELS[locale][3])+'\n<!-- uttu-body:end -->'
                preserved=False
                if previous and original_needed(previous['body'],content):
                    body+=client_supplement(previous['body'],locale);stats['preserved_client_units']+=1;preserved=True
                subtitle=plain(row.get('description') or '')
                if subtitle:body='> '+escape(subtitle)+'\n\n'+body
                episode={'episode_id':eid,'title':plain(row['title']).strip() or number,'body':body,
                         'trails':[],'source_number':number,'aliases':previous.get('aliases',[]) if previous else []}
                episodes.append(episode)
                unit_manifest.append({'route':route,'number':number,'episode_id':eid,'title':episode['title'],
                     'path':path.as_posix(),'source_body_sha256':sha256(row.get('content','').encode()).hexdigest(),
                     'rendered_body_sha256':sha256(content.encode()).hexdigest(),'source_text_nodes':renderer.stats['text_nodes'],
                     'choices':renderer.stats['choices'],'responses':renderer.stats['responses'],
                     'gameplay_only':bool(row.get('gameplayOnly')),'source_body_empty':not bool(norm(content)),
                     'modal_fragment':bool(modal_row.get('fragment')),'modal_dialogue':bool(modal_row.get('dialogs')),
                     'group_header':bool(modal_row.get('group_header')),
                     'client_text_preserved':preserved})
                stats['source_units']+=1
            episodes.extend(unused.values())
            stats['client_only_units']+=len(unused)
            # Preserve old trail positions; add new trails near their unlock stage.
            episode_by_id={e['episode_id']:e for e in episodes}
            for key,(old_eid,trail) in old_trails.items():
                target=episode_by_id[old_eid]
                target['trails'].append({'element_id':key,'content':rendered_trails.pop(key)['content'] if key in rendered_trails else trail['original']})
            for key,trail in rendered_trails.items():
                reference=trail['source'].get('reference','')
                ids=re.findall(r'EpisodeFinish=(\d+)',reference)
                target=episode_by_id.get(int(ids[-1])) if ids else None
                if target is None:target=episodes[-1]
                target['trails'].append({'element_id':key,'content':trail['content']});stats['new_trails']+=1
            assert len({e['episode_id'] for e in episodes})==len(episodes)
            chapters.append({'chapter_id':cid,'title':title,'category':category,'path':path.as_posix(),
                             'episodes':episodes,'route':route,'url':raw['url'],
                             'description':plain(fm.get('description') or ''),'order':source_order[route]})
            source_pack.append({'route':route,'url':raw['url'],'resolved_url':raw.get('resolved_url'),
                                'fetched_at':raw.get('fetched_at'),'html_sha256':raw.get('html_sha256'),
                                'payload':payload,'details':{'url':detail['url'],'html_sha256':detail['html_sha256'],
                                  'rows':trail_rows,'data':data,'modal_parts':modal}})
        for cid,page in pages.items():
            if cid in matched_old:continue
            for episode in page['episodes']:
                for trail in episode['trails']:trail['content']=trail['original']
            chapters.append({**page,'route':None,'order':10000+cid,'url':None,'description':''})
            stats['client_only_chapters']+=1
        order={category:i for i,category in enumerate(CATEGORIES.values())}
        chapters.sort(key=lambda c:(order[c['category']],c['order']))
        by_category={category:[c for c in chapters if c['category']==category] for category in CATEGORIES.values()}
        for category,group in by_category.items():
            for i,chapter in enumerate(group):
                nav=[]
                for label,other in [(ui[5],group[i-1] if i else None),(ui[6],group[i+1] if i+1<len(group) else None)]:
                    if other:nav.append('['+label+'：'+escape(other['title'])+']('+quote(Path(other['path']).name)+')')
                nav.insert(1 if nav else 0,'['+ui[4]+'](../README.md)')
                navtext=' · '.join(nav)
                navigation='<!-- reading-navigation:start -->\n'+navtext+'\n<!-- reading-navigation:end -->'
                episodes=chapter['episodes'];trail_count=sum(len(e['trails']) for e in episodes)
                lines=['# '+str(chapter['chapter_id'])+' · '+escape(chapter['title']),'',navigation,'',
                       '- '+ui[2]+'：`'+str(len(episodes))+'`','- '+LABELS[locale][5]+'：`'+str(trail_count)+'`','']
                if chapter['url']:lines.extend(['[UTTU]('+chapter['url']+')','',escape(chapter['description']),''])
                lines.extend(['## '+ui[3],''])
                for e in episodes:lines.append('- ['+str(e['episode_id'])+' · '+escape(e['title'])+'](#episode-'+str(e['episode_id'])+')')
                for e in episodes:
                    lines.extend(['','---',''])
                    lines.extend('<a id="episode-'+str(alias)+'"></a>' for alias in e.get('aliases',[]))
                    lines.extend(['<a id="episode-'+str(e['episode_id'])+'"></a>',
                                  '## '+str(e['episode_id'])+' · '+escape(e['title']),'',e['body'],''])
                    for trail in e['trails']:lines.extend([trail['content'],''])
                lines.extend(['','---','',navigation,''])
                target=out/chapter['path'];target.parent.mkdir(parents=True,exist_ok=True)
                target.write_text('\n'.join(lines),encoding='utf-8')
        stats['chapters']=len(chapters);stats['episodes']=sum(len(c['episodes']) for c in chapters)
        stats['trails']=sum(len(e['trails']) for c in chapters for e in c['episodes'])
        stats['source_chapters']=len(source_pack)
        manifest['editions'][locale]={'counts':dict(stats),'units':unit_manifest,
                                   'chapters':[{'chapter_id':c['chapter_id'],'title':c['title'],'path':c['path'],
                                                'route':c['route'],'episodes':len(c['episodes'])} for c in chapters]}
        index=['# '+ui[0],'','['+ui[1]+'](../README.md)','',
               f"{stats['chapters']} chapters · {stats['episodes']:,} story units · {stats['trails']:,} trails",'',
               '[UTTU · 2026-11-23](../../../'+REPORT.as_posix()+'/README.md)','']
        for category,group in by_category.items():
            if not group:continue
            index.extend(['## '+ui[7+order[category]]+' ('+str(len(group))+')',''])
            for c in group:
                relative=Path(c['path']).relative_to(READER/locale).as_posix()
                index.append('- ['+str(c['chapter_id'])+' · '+escape(c['title'])+']('+quote(relative)+') — '+str(len(c['episodes']))+' · '+str(sum(len(e['trails']) for e in c['episodes'])))
            index.append('')
        (out/READER/locale/'README.md').write_text('\n'.join(index),encoding='utf-8')
        packpath=out/REPORT/'sources'/(locale+'.json.gz');packpath.parent.mkdir(parents=True,exist_ok=True)
        with packpath.open('wb') as f:
            with gzip.GzipFile(filename='',fileobj=f,mode='wb',mtime=0) as z:
                z.write(json.dumps(source_pack,ensure_ascii=False,separators=(',',':')).encode())
        print(locale,dict(stats),flush=True)
    write(out/REPORT/'coverage.json',manifest)
    for name,value in [('forums.json.gz',forums),('notes.json.gz',notes)]:
        with (out/REPORT/'sources'/name).open('wb') as f:
            with gzip.GzipFile(filename='',fileobj=f,mode='wb',mtime=0) as z:z.write(json.dumps(value,ensure_ascii=False).encode())
    print('Complete:',new_chapters,'new chapter files;',new_episodes,'new story units',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('repo','cache','output'):parser.add_argument('--'+name,type=Path,required=True)
    build(parser.parse_args())
