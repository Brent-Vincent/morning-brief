"""Offline parser tests. Run: python3 -m unittest discover -s tests -v"""
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from update_news import clean_text, parse_date, parse_rss_or_atom, safe_url

RSS_EXAMPLE = b'''<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><item><title><![CDATA[Science discovery - Original News]]></title>
<link>https://example.com/article-one</link><source>Original News</source>
<pubDate>Thu, 15 Oct 2026 03:30:00 GMT</pubDate></item>
<item><title>Item two &amp; three</title><link>https://example.com/article-two</link>
<pubDate>Thu, 15 Oct 2026 02:00:00 GMT</pubDate></item></channel></rss>'''
ATOM_EXAMPLE = b'''<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>First Atom item</title>
<link rel="alternate" href="https://example.com/atom"/>
<published>2026-10-15T03:00:00+00:00</published></entry></feed>'''

class FeedParsingTests(unittest.TestCase):
    def test_rss_source_title_and_url(self):
        articles = parse_rss_or_atom(RSS_EXAMPLE, feed_name='Google News: science', topic='Science')
        self.assertEqual(len(articles), 2)
        self.assertEqual(articles[0]['title'], 'Science discovery')
        self.assertEqual(articles[0]['source'], 'Original News')
        self.assertEqual(articles[1]['source'], 'Google News: science')
        self.assertEqual(articles[1]['title'], 'Item two & three')
        self.assertEqual(articles[0]['published'], '2026-10-15T03:30:00Z')

    def test_atom(self):
        articles = parse_rss_or_atom(ATOM_EXAMPLE, feed_name='Site Feed', topic='World')
        self.assertEqual(len(articles), 1)
        self.assertEqual(articles[0]['url'], 'https://example.com/atom')
        self.assertEqual(articles[0]['topic'], 'World')

    def test_safe_urls(self):
        self.assertIsNone(safe_url('javascript:alert(1)'))
        self.assertIsNone(safe_url('file:///etc/passwd'))
        self.assertEqual(safe_url('https://example.org/story'), 'https://example.org/story')

    def test_clean(self):
        self.assertEqual(clean_text('<b>Fast</b> &amp; good   story'), 'Fast & good story')

    def test_fallback_date(self):
        self.assertEqual(parse_date('2026-10-15T12:00:00+07:00'), '2026-10-15T05:00:00Z')

if __name__ == '__main__':
    unittest.main()
