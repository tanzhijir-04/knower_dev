"""
MediaCrawler CLI entry point for knower_dev integration.
Runs crawler and outputs JSON to stdout for Node.js consumption.
"""

import sys
import os
import json
import asyncio
import argparse
from typing import Dict, List

# Force UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

# Add mediasrc to Python path
MEDIASRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mediasrc')
sys.path.insert(0, MEDIASRC_DIR)

import config
from base.base_crawler import AbstractStore


class MemoryStore(AbstractStore):
    """In-memory store that collects data instead of writing to files/DB."""

    def __init__(self):
        self.contents: List[Dict] = []
        self.comments: List[Dict] = []
        self.creators: List[Dict] = []
        self.contacts: List[Dict] = []
        self.dynamics: List[Dict] = []

    async def store_content(self, content_item: Dict):
        self.contents.append(content_item)

    async def store_comment(self, comment_item: Dict):
        self.comments.append(comment_item)

    async def store_creator(self, creator: Dict):
        self.creators.append(creator)

    async def store_contact(self, contact_item: Dict):
        self.contacts.append(contact_item)

    async def store_dynamic(self, dynamic_item: Dict):
        self.dynamics.append(dynamic_item)


# Global memory store instance
_memory_store = MemoryStore()


def _patch_store_factory(platform: str):
    """Monkey-patch the platform's StoreFactory to use MemoryStore."""
    if platform == "bili":
        from store.bilibili import BiliStoreFactory
        BiliStoreFactory.create_store = staticmethod(lambda: _memory_store)
    elif platform == "dy":
        from store.douyin import DouYinStoreFactory
        DouYinStoreFactory.create_store = staticmethod(lambda: _memory_store)
    elif platform == "xhs":
        from store.xhs import XhsStoreFactory
        XhsStoreFactory.create_store = staticmethod(lambda: _memory_store)
    elif platform == "wb":
        from store.weibo import WeibostoreFactory
        WeibostoreFactory.create_store = staticmethod(lambda: _memory_store)


def _get_crawler_class(platform: str):
    """Get crawler class for the specified platform."""
    if platform == "bili":
        from media_platform.bilibili import BilibiliCrawler
        return BilibiliCrawler
    elif platform == "dy":
        from media_platform.douyin import DouYinCrawler
        return DouYinCrawler
    elif platform == "xhs":
        from media_platform.xhs import XiaoHongShuCrawler
        return XiaoHongShuCrawler
    elif platform == "wb":
        from media_platform.weibo import WeiboCrawler
        return WeiboCrawler
    else:
        raise ValueError(f"Unsupported platform: {platform}")


async def run_crawler(args):
    """Run crawler with given arguments and return collected data."""
    global _memory_store
    _memory_store = MemoryStore()

    # Change cwd to mediasrc so relative paths like libs/stealth.min.js work
    original_cwd = os.getcwd()
    os.chdir(MEDIASRC_DIR)

    # Override config
    config.PLATFORM = args.platform
    config.KEYWORDS = args.keywords
    config.CRAWLER_TYPE = args.crawler_type
    config.SAVE_DATA_OPTION = "jsonl"
    config.HEADLESS = args.headless
    config.ENABLE_GET_COMMENTS = args.get_comment
    config.ENABLE_GET_SUB_COMMENTS = False
    config.ENABLE_IP_PROXY = False
    config.ENABLE_GET_MEIDAS = False
    config.CRAWLER_MAX_NOTES_COUNT = args.max_notes
    config.CRAWLER_MAX_COMMENTS_COUNT_SINGLENOTES = args.max_comments
    config.MAX_CONCURRENCY_NUM = 1
    config.SAVE_LOGIN_STATE = True
    config.ENABLE_CDP_MODE = False

    if args.specified_id:
        config.BILI_SPECIFIED_ID_LIST = [i.strip() for i in args.specified_id.split(",")]
    if args.creator_id:
        config.BILI_CREATOR_ID_LIST = [i.strip() for i in args.creator_id.split(",")]

    # Patch store factory
    _patch_store_factory(args.platform)

    # Get and run crawler
    crawler_class = _get_crawler_class(args.platform)
    crawler = crawler_class()
    print(f"[progress] 平台: {args.platform}, 关键词: {args.keywords}, 模式: {args.crawler_type}", file=sys.stderr, flush=True)
    try:
        await crawler.start()
    finally:
        os.chdir(original_cwd)

    # Collect results
    result = {
        "platform": args.platform,
        "keywords": args.keywords,
        "crawler_type": args.crawler_type,
        "contents": _memory_store.contents,
        "comments": _memory_store.comments,
        "creators": _memory_store.creators,
        "contacts": _memory_store.contacts,
        "dynamics": _memory_store.dynamics,
        "stats": {
            "total_contents": len(_memory_store.contents),
            "total_comments": len(_memory_store.comments),
            "total_creators": len(_memory_store.creators),
        }
    }

    return result


def parse_args():
    parser = argparse.ArgumentParser(description="MediaCrawler CLI for knower_dev")
    parser.add_argument("--platform", "-p", required=True,
                        choices=["bili", "dy", "xhs", "wb"],
                        help="Platform: bili, dy, xhs, wb")
    parser.add_argument("--keywords", "-k", default="",
                        help="Search keywords (comma-separated)")
    parser.add_argument("--crawler-type", "-t", default="search",
                        choices=["search", "detail", "creator"],
                        help="Crawler type")
    parser.add_argument("--headless", action="store_true", default=True,
                        help="Run in headless mode")
    parser.add_argument("--no-headless", dest="headless", action="store_false",
                        help="Run with browser visible")
    parser.add_argument("--get-comment", action="store_true", default=False,
                        help="Enable comment crawling")
    parser.add_argument("--max-notes", type=int, default=15,
                        help="Max notes/videos to crawl")
    parser.add_argument("--max-comments", type=int, default=10,
                        help="Max comments per note/video")
    parser.add_argument("--specified-id", default="",
                        help="Specific post IDs (comma-separated)")
    parser.add_argument("--creator-id", default="",
                        help="Creator IDs (comma-separated)")
    return parser.parse_args()


def main():
    args = parse_args()
    result = asyncio.run(run_crawler(args))
    # Output JSON to stdout
    print(json.dumps(result, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
