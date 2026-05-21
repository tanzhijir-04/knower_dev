"""
B站用户空间视频数据抓取
用法: python bilibili.py [UID]
依赖: pip install playwright && python -m playwright install chromium
"""

import sys
import json
import time
from playwright.sync_api import sync_playwright

DEFAULT_UID = '440609243'


def fetch_bilibili_data(uid=None):
    """抓取用户空间数据（概览 + 视频列表）"""
    target_uid = uid or DEFAULT_UID
    result = {'overview': None, 'videos': []}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,  # headless 会被风控检测
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check',
            ],
        )
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        )
        page = context.new_page()

        # 去掉 webdriver 标记
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        # 拦截 API 响应
        intercepted = {'videos': [], 'overview': None}

        def on_response(response):
            url = response.url
            try:
                if '/x/space/wbi/arc/search' in url or '/x/space/arc/search' in url:
                    data = response.json()
                    if data.get('code') == 0 and data.get('data'):
                        _parse_arc_search(data['data'], intercepted)
                elif '/x/space/upstat' in url or '/x/relation/stat' in url:
                    data = response.json()
                    if data.get('code') == 0 and data.get('data'):
                        intercepted['overview'] = intercepted.get('overview') or {}
                        intercepted['overview'].update(data['data'])
            except Exception:
                pass

        page.on('response', on_response)

        # --- 1. 概览页 ---
        print(f'[bilibili] 抓取概览: space.bilibili.com/{target_uid}')
        try:
            page.goto(f'https://space.bilibili.com/{target_uid}', wait_until='networkidle', timeout=30000)
            time.sleep(3)
        except Exception as e:
            print(f'[bilibili] 概览页加载: {e}')

        # --- 2. 视频列表（分页） ---
        pn = 1
        while True:
            url = f'https://space.bilibili.com/{target_uid}/upload/video?pn={pn}&ps=30'
            print(f'[bilibili] 抓取第 {pn} 页...')

            intercepted['videos'] = []
            try:
                page.goto(url, wait_until='networkidle', timeout=30000)
                time.sleep(3)
            except Exception as e:
                print(f'[bilibili] 页面加载失败: {e}')
                break

            videos = intercepted['videos']
            if not videos:
                print(f'[bilibili] 第 {pn} 页无数据，抓取完成')
                break

            result['videos'].extend(videos)
            print(f'[bilibili] 第 {pn} 页: {len(videos)} 条')

            if len(videos) < 30:
                break
            pn += 1
            time.sleep(1)

        # 概览数据
        if intercepted['overview']:
            ov = intercepted['overview']
            result['overview'] = {
                'platform': 'bilibili',
                'follower_count': ov.get('follower', ov.get('follower_count', 0)),
                'total_play': ov.get('archive', {}).get('view', ov.get('total_play', 0)),
                'total_like': ov.get('archive', {}).get('like', ov.get('total_like', 0)),
            }

        context.close()
        browser.close()

    return result


def _parse_arc_search(data, intercepted):
    """解析 arc/search API 响应，提取视频"""
    vlist = data.get('list', {}).get('vlist', [])
    for v in vlist:
        intercepted['videos'].append({
            'platform': 'bilibili',
            'video_id': v.get('bvid', ''),
            'title': v.get('title', ''),
            'published_at': _ts_to_iso(v.get('created')),
            'duration': v.get('length', ''),
            'play_count': v.get('play', 0),
            'like_count': v.get('like', 0),
            'comment_count': v.get('comment', 0),
            'share': v.get('share', 0),
            'coin': v.get('coin', 0),
            'favorite': v.get('favorites', 0),
            'danmaku': v.get('video_review', 0),
        })


def _ts_to_iso(ts):
    if not ts:
        return None
    try:
        from datetime import datetime, timezone
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except Exception:
        return None


# ============================================================
#  CLI 入口
# ============================================================

if __name__ == '__main__':
    uid = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_UID
    print(f'[bilibili] UID: {uid}\n')

    result = fetch_bilibili_data(uid)

    if result['overview']:
        print(f'\n--- 概览 ---')
        print(json.dumps(result['overview'], indent=2, ensure_ascii=False))

    if result['videos']:
        print(f'\n--- 视频: {len(result["videos"])} 条 ---')
        for v in result['videos'][:5]:
            print(f'  [{v["video_id"]}] {v["title"]} — 播放:{v["play_count"]}')

    out_path = f'bilibili_{uid}.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f'\n数据已保存到 {out_path}')
