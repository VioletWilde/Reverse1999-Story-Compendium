"""Regression checks for data that used to disappear during text extraction."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parent))
from uttu_render import Renderer,parse_js_literal

class RendererTests(unittest.TestCase):
    def test_inactive_and_nested_choices(self):
        source='''<div class="dialog-block"><div class="choice-container">
        <div class="choice-option"><input value="one"><label>Question A</label></div>
        <div class="choice-option"><input value="two"><label>Question B</label></div></div>
        <div class="dialog-response" data-choice="one"><b>A:</b> Answer A<br>
        <div class="dialog-block"><div class="choice-option"><input value="inner"><label>Follow-up</label></div>
        <div class="dialog-response" data-choice="inner">Nested answer</div></div></div>
        <div class="dialog-response" data-choice="two" style="display:none">Hidden answer B</div></div>'''
        renderer=Renderer('en');out=renderer.render(source)
        for text in ['Question A','Question B','Answer A','Follow-up','Nested answer','Hidden answer B']:
            self.assertEqual(out.count(text),1)
        self.assertLess(out.index('Answer A'),out.index('Question B'))
        self.assertEqual(renderer.stats['choices'],3)
        self.assertEqual(renderer.stats['responses'],3)

    def test_screen_text_and_ruby_remain(self):
        out=Renderer('ja').render('<div class="music-cue">BGM name</div><div class="bg-text-overlay">Screen words</div><i>Narration <ruby>漢字<rt>かんじ</rt></ruby></i>')
        self.assertNotIn('BGM name',out)
        for text in ['Screen words','Narration','漢字','かんじ']:self.assertIn(text,out)

    def test_forum_and_note_expansion(self):
        forums={'1':{'1':{'username':['U','用户','用戶','利用者','사용자'],'time_sent':'12:00','message':['Text','正文','正文','本文','본문']}}}
        renderer=Renderer('zh-CN',forums,{'101':{'title':'注释','description':'隐藏词条正文'}})
        out=renderer.render('<div class="bbs-block" data-bbs-id="1#2"></div><span class="info-link" data-info="101">词条</span>')+renderer.extra_notes()
        for text in ['用户','12:00','正文','隐藏词条正文']:self.assertIn(text,out)
        self.assertEqual(renderer.stats['forum_posts'],1)

    def test_forum_reply_quotes_and_image_location(self):
        forums={'1':{'1':{'username':'First','message':'The quoted clue','message_img':'v3a4_fragmenticon_001'},
                     '2':{'username':'Second','message':'A response','in_reply_to':'1#1'}}}
        out=Renderer('en',forums).forum('1')
        self.assertIn('> The quoted clue',out)
        self.assertIn('https://assets.merui.net/dungeon/fragmenticon/v3a4_fragmenticon_001.webp',out)

    def test_literal_parser_does_not_execute_code(self):
        data,end=parse_js_literal('{10:{title:[`line 1\nline 2`,"中文"],flag:true}};evil()')
        self.assertEqual(data['10']['title'][0],'line 1\nline 2')
        self.assertEqual(data['10']['flag'],True)
        self.assertEqual(';evil()','{10:{title:[`line 1\nline 2`,"中文"],flag:true}};evil()'[end:])
        with self.assertRaises(ValueError):parse_js_literal('(()=>evil())()')
        with self.assertRaises(ValueError):parse_js_literal('`value ${evil()}`')

if __name__=='__main__':unittest.main()
