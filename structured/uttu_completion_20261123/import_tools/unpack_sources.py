"""Unpack archived UTTU data for the reader compiler; no network access needed."""
import argparse
import gzip
import json
from pathlib import Path
import shutil

def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sources',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();assert not args.output.exists(),'Use a new output folder'
    entries={};details={}
    for file in args.sources.glob('*.json.gz'):
        with gzip.open(file,'rt',encoding='utf-8') as f:data=json.load(f)
        name=file.name.removesuffix('.json.gz')
        if name in ['forums','notes']:
            write(args.output/('bbs-data.json' if name=='forums' else 'notes.json'),data);continue
        for chapter in data:
            route=chapter['route'];entries.setdefault(route,{'route':route,'attributes':{},'text':chapter['payload']['frontmatter']['title']})
            write(args.output/route/(name+'.json'),{**chapter,'success':True})
            detail=chapter['details'];record=details.setdefault(route,{'success':True,**detail,'rows':{}})
            record['rows'][name]=detail['rows']
            if modal:=detail.get('modal_parts'):write(args.output/route/'modal_parts.json',modal)
    for route,detail in details.items():write(args.output/route/'details.json',detail)
    write(args.output/'catalog.json',list(entries.values()))
    mapping=args.sources.parent/'chapter_map.json'
    if mapping.exists():shutil.copyfile(mapping,args.output/'chapter_map.json')
    print('Unpacked',len(entries),'UTTU routes')

if __name__=='__main__':main()
