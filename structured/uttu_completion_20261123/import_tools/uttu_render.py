"""Render UTTU HTML without dropping inactive dialogue branches or screen text."""
from collections import Counter
import json
import re
from bs4 import BeautifulSoup, Comment, NavigableString, Tag

LANGS = {'zh-CN':'chs', 'en':'en', 'ja':'jp', 'ko':'kr', 'zh-TW':'cht'}
SLOTS = {'en':0,'zh-CN':1,'zh-TW':2,'ja':3,'ko':4}
LABELS = {
    'zh-CN': ('选项', '补充资料', '论坛', '来源未提供独立剧情正文。', '客户端原文', '小径', '元素', '说明', '操作'),
    'en': ('Choice', 'Notes', 'Forum', 'The source provides no separate story transcript.', 'Client transcript', 'Trail', 'Element', 'Description', 'Action'),
    'ja': ('選択肢', '補足資料', '掲示板', 'この項目には独立したストーリー本文がありません。', 'クライアント原文', '小径', '要素', '説明', '操作'),
    'ko': ('선택지', '보충 자료', '게시판', '출처에 별도의 스토리 본문이 없습니다.', '클라이언트 원문', '트레일', '요소', '설명', '동작'),
    'zh-TW': ('選項', '補充資料', '論壇', '來源未提供獨立劇情正文。', '客戶端原文', '小徑', '元素', '說明', '操作'),
}


def localize(value, locale):
    if isinstance(value, list):
        return value[SLOTS[locale]] if len(value)>SLOTS[locale] else ''
    return value


def escape(value):
    return re.sub(r'([\\`*\[\]<>_])', r'\\\1', str(value or ''))


def norm(value):
    import html, unicodedata
    value = re.sub(r'\\([\\`*\[\]<>_])', r'\1', value)
    return ''.join(c for c in unicodedata.normalize('NFKC',html.unescape(value)).casefold() if c.isalnum())


def plain(value):
    return BeautifulSoup(str(value or ''),'html.parser').get_text(' ',strip=True)


def parse_js_literal(source, start=0):
    """Parse only data literals; never evaluate downloaded JavaScript."""
    pos=start
    def space():
        nonlocal pos
        while pos<len(source) and source[pos].isspace():pos+=1
    def string():
        nonlocal pos
        quote=source[pos];pos+=1;out=[]
        while pos<len(source):
            ch=source[pos];pos+=1
            if ch==quote:return ''.join(out)
            if quote=='`' and ch=='$' and source[pos:pos+1]=='{':
                raise ValueError('Template interpolation is not a data literal')
            if ch!='\\':out.append(ch);continue
            ch=source[pos];pos+=1
            replacements={'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','v':'\v','0':'\0'}
            if ch in replacements:out.append(replacements[ch])
            elif ch in '\n\r':
                if ch=='\r' and source[pos:pos+1]=='\n':pos+=1
            elif ch in 'xu':
                width=2 if ch=='x' else 4
                out.append(chr(int(source[pos:pos+width],16)));pos+=width
            else:out.append(ch)
        raise ValueError('Unterminated literal string')
    def value():
        nonlocal pos
        space();ch=source[pos]
        if ch in '\"\'`':return string()
        if ch=='{':
            pos+=1;out={};space()
            while source[pos]!='}':
                space()
                if source[pos] in '\"\'`':key=string()
                else:
                    m=re.match(r'[\w$]+',source[pos:]);assert m,source[pos:pos+50]
                    key=m[0];pos+=len(key)
                space();assert source[pos]==':';pos+=1
                out[key]=value();space()
                if source[pos]!=',':break
                pos+=1;space()
            assert source[pos]=='}';pos+=1;return out
        if ch=='[':
            pos+=1;out=[];space()
            while source[pos]!=']':
                out.append(value());space()
                if source[pos]!=',':break
                pos+=1;space()
            assert source[pos]==']';pos+=1;return out
        for word,result in [('true',True),('false',False),('null',None)]:
            if source.startswith(word,pos):pos+=len(word);return result
        m=re.match(r'-?\d+(?:\.\d+)?',source[pos:])
        if m:pos+=len(m[0]);return json.loads(m[0])
        raise ValueError('Not a data literal: '+source[pos:pos+60])
    result=value()
    return result,pos


class Renderer:
    def __init__(self, locale, forums=None, notes=None):
        self.locale=locale;self.forums=forums or {};self.notes=notes or {}
        self.choice=LABELS[locale][0];self.stats=Counter();self.references=set()

    def forum(self, fid):
        fid=str(fid).split('#')[0]
        assert fid in self.forums,('Missing forum',fid)
        data=self.forums[fid];lines=[]
        title=localize(data.get('text1',''),self.locale)
        if title:lines.extend(['**'+escape(title)+'**',''])
        for key in sorted((k for k in data if k.isdigit()),key=int):
            post=data[key];name=localize(post.get('username',''),self.locale)
            lines.extend(['**'+escape(name)+' · '+escape(post.get('time_sent',''))+'**',''])
            if address:=localize(post.get('url',''),self.locale):lines.extend([escape(address),''])
            if reference:=post.get('in_reply_to'):
                parts=str(reference).split('#');reply_fid=parts[0] if len(parts)>1 else fid;reply_key=parts[-1]
                reply=self.forums.get(reply_fid,{}).get(reply_key)
                assert reply,('Missing forum reply target',reference)
                quote_name=localize(reply.get('username',''),self.locale)
                quote_body=localize(reply.get('message',''),self.locale)
                lines.extend(['> **'+escape(quote_name)+'**','>'])
                lines.extend('> '+escape(line) for line in str(quote_body).splitlines())
                lines.append('')
            for field in ('message','action_text'):
                if text:=localize(post.get(field,''),self.locale):lines.extend([escape(text),''])
            if image:=post.get('message_img'):
                lines.extend(['[Image](https://assets.merui.net/dungeon/fragmenticon/'+str(image)+'.webp)',''])
            if ip:=post.get('ip','').strip():lines.extend(['IP: '+escape(ip),''])
            self.stats['forum_posts']+=1
        self.stats['forum_threads']+=1
        return '\n'.join(line.rstrip() for line in '\n'.join(lines).splitlines()).strip()

    def render(self, raw):
        soup=BeautifulSoup(str(raw or ''),'html.parser')
        consumed=Counter()
        def skipped(node):
            return isinstance(node,Tag) and (node.name in ('script','style') or 'music-cue' in node.get('class',[]))
        expected=Counter(id(n) for n in soup.descendants if isinstance(n,NavigableString)
                         and not isinstance(n,Comment) and str(n).strip()
                         and not any(skipped(a) for a in n.parents))
        def render(node):
            if isinstance(node,Comment):return ''
            if isinstance(node,NavigableString):
                text=str(node)
                if not text.strip():return ''
                consumed[id(node)]+=1
                return escape(re.sub(r'\s+',' ',text))
            if not isinstance(node,Tag) or skipped(node):return ''
            classes=node.get('class',[])
            if node.name=='br':return '\n\n'
            if node.name=='hr':return '\n\n***\n\n'
            if node.name in ('input','img','source','wbr','meta','link'):
                return ''
            if 'bbs-block' in classes:
                return '\n\n'+self.forum(node['data-bbs-id'])+'\n\n'
            if 'dialog-block' in classes:
                options=[n for n in node.select('.choice-option') if n.find_parent(class_='dialog-block') is node]
                responses=[n for n in node.select('.dialog-response') if n.find_parent(class_='dialog-block') is node]
                if options:
                    output=[];handled=set()
                    for i,option in enumerate(options,1):
                        inp=option.find('input');key=inp.get('value') if inp else None
                        title=render(option).strip();handled.add(id(option))
                        output.extend(['\n\n> **'+self.choice+' '+str(i)+'：** '+title+'\n\n'])
                        self.stats['choices']+=1
                        for response in responses:
                            if response.get('data-choice')==key:
                                output.append(render(response));handled.add(id(response));self.stats['responses']+=1
                    # Retain any content outside the option container and responses.
                    def extras(n):
                        if id(n) in handled:return ''
                        if isinstance(n,Tag) and any(id(d) in handled for d in n.descendants):
                            return ''.join(extras(c) for c in n.children)
                        return render(n)
                    output.append(''.join(extras(c) for c in node.children))
                    return '\n\n'+''.join(output)+'\n\n'
            text=''.join(render(c) for c in node.children)
            if 'info-link' in classes and node.get('data-info'):self.references.add(node['data-info'])
            if node.name in ('b','strong') and text.strip():return '**'+text.strip()+'**'
            if node.name in ('rt','rp') and text.strip():return '（'+text.strip()+'）'
            if node.name in ('div','p','li','blockquote','h1','h2','h3','h4','h5','h6','tr'):
                return '\n\n'+text.strip()+'\n\n'
            return text
        result=''.join(render(c) for c in soup.children)
        assert expected==consumed,('Lost or duplicated source text',len(expected-consumed),len(consumed-expected))
        self.stats['text_nodes']+=sum(expected.values())
        result=re.sub(r'\n[ \t]+','\n',result)
        result='\n'.join(line.rstrip() for line in result.splitlines())
        return re.sub(r'\n{3,}','\n\n',result).strip()

    def extra_notes(self):
        out=[]
        for key in sorted(self.references):
            assert key in self.notes,('Missing popup note',key)
            record=self.notes[key]
            title=localize(record.get('title',''),self.locale)
            description=localize(record.get('description',''),self.locale)
            out.extend(['#### '+LABELS[self.locale][1]+' · '+escape(title),'',self.render(description),''])
            self.stats['popup_notes']+=1
        return '\n'.join(out)

    def trail(self, row, data):
        lines=[];labels=LABELS[self.locale]
        for key,label in [('description',labels[7]),('button',labels[8]),('investigateQuote',labels[1])]:
            if val:=localize(row.get(key,''),self.locale):lines.extend(['> **'+label+'：** '+self.render(val),''])
        after=row.get('after') or {}
        if val:=localize(after.get('description',''),self.locale):lines.extend([self.render(val),''])
        fragment=(data.get('data-trails') or {}).get(str(row.get('fragment_id')), {})
        for key in ('title','description'):
            if val:=localize(fragment.get(key,''),self.locale):lines.extend([self.render(val),''])
        if row.get('dialogContent'):lines.extend([self.render(row['dialogContent']),''])
        steps=row.get('dialogSteps') or {}
        if isinstance(steps,dict):steps=steps.get('steps',[])
        for step in steps:
            speaker=('**'+escape(step['speaker'])+'：** ') if step.get('speaker') else ''
            if step.get('dialog'):lines.extend([speaker+self.render(step['dialog']),''])
        option=row.get('optionData') or {}
        if option:
            for key in ('title','desc'):
                if val:=option.get(key):lines.extend([self.render(val),''])
            for i,choice in enumerate(option.get('options',[]),1):
                lines.extend(['> **'+labels[0]+' '+str(i)+'：** '+self.render(choice.get('text','')),'',
                              self.render(choice.get('feedback','')),''])
                self.stats['choices']+=1
        if row.get('trail_type')==3401:lines.extend([self.forum(row['state']),''])
        if row.get('answers'):
            answers=row['answers']
            lines.extend([self.render(answers if isinstance(answers,str) else json.dumps(answers,ensure_ascii=False)),''])
        return '\n'.join(line.rstrip() for line in '\n'.join(lines).splitlines()).strip()
