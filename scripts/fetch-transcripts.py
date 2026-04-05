#!/usr/bin/env python3
"""
scripts/fetch-transcripts.py

Fetches YouTube transcripts for channel video stubs and saves them via API.
Uses youtube-transcript-api which handles YouTube's anti-bot measures reliably.

Usage:
  python scripts/fetch-transcripts.py [--channel UCxxxxxx] [--limit 200]

Required env vars:
  API_BASE      e.g. https://jolike.com
  BATCH_SECRET  must match Cloudflare Pages CHANNEL_SYNC_SECRET

Optional env vars:
  DELAY_MS      delay between videos in ms (default: 800)
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
import random

try:
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled, VideoUnavailable
except ImportError:
    print("❌ Missing dependency: pip install youtube-transcript-api")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument('--channel', default='')
parser.add_argument('--limit', type=int, default=500)
args = parser.parse_args()

API_BASE  = os.environ.get('API_BASE', 'https://jolike.com').rstrip('/')
SECRET    = os.environ.get('BATCH_SECRET') or os.environ.get('CHANNEL_SYNC_SECRET')
DELAY_MS  = int(os.environ.get('DELAY_MS', '800'))
LIMIT     = args.limit

if not SECRET:
    print("❌ BATCH_SECRET env var is required")
    sys.exit(1)

# ── API helpers ────────────────────────────────────────────────────────────────

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json',
}

def api_get(path):
    url = f"{API_BASE}{path}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read())

def api_post(path, data, auth=None):
    url = f"{API_BASE}{path}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers=HEADERS)
    req.add_header('Content-Type', 'application/json')
    if auth:
        req.add_header('Authorization', f'Bearer {auth}')
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.getcode(), json.loads(res.read())
    except urllib.error.HTTPError as e:
        return e.code, {}

def get_channels():
    data = api_get('/api/channels')
    return data.get('channels', [])

def get_stubs(channel_id, process_limit=500):
    PAGE_SIZE = 200
    stubs = []
    offset = 0
    while len(stubs) < process_limit:
        try:
            data = api_get(f'/api/channels/{channel_id}?limit={PAGE_SIZE}&offset={offset}')
        except Exception as e:
            print(f"   [api_err: {e}]")
            break
        all_videos = data.get('videos', [])
        batch = [v for v in all_videos if not v.get('hasTranscript')]
        stubs.extend(batch)
        if len(all_videos) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return stubs[:process_limit]

def save_transcript(video_id, title, duration_seconds, transcript):
    status, _ = api_post('/api/analyze', {
        'url': f'https://www.youtube.com/watch?v={video_id}',
        'title': title,
        'duration_seconds': duration_seconds,
        'transcript': transcript,
    }, auth=SECRET)
    return status in (200, 201)

# ── Transcript fetching ────────────────────────────────────────────────────────

def fetch_transcript(video_id):
    """
    Returns (segments, error_code) where segments is a list of {text, start, dur}
    or None on failure.
    """
    try:
        # Try English first (manual), then auto-generated, then any English variant
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Priority: manual en > asr en > manual en-* > asr en-*
        transcript = None
        for lang in ['en']:
            try:
                transcript = transcript_list.find_manually_created_transcript([lang])
                break
            except NoTranscriptFound:
                pass
        if transcript is None:
            for lang in ['en']:
                try:
                    transcript = transcript_list.find_generated_transcript([lang])
                    break
                except NoTranscriptFound:
                    pass
        if transcript is None:
            # Try any English variant
            for t in transcript_list:
                if t.language_code.startswith('en'):
                    transcript = t
                    break

        if transcript is None:
            langs = ', '.join(t.language_code for t in transcript_list)
            return None, f'no_en (available: {langs})'

        data = transcript.fetch()
        segments = []
        for entry in data:
            text = entry.get('text', '').replace('\n', ' ').strip()
            start = entry.get('start', 0)
            dur = entry.get('duration', 2.0)
            if text:
                segments.append({'text': text, 'start': round(start, 3), 'dur': round(dur, 3)})

        if not segments:
            return None, 'empty_transcript'

        return segments, None

    except TranscriptsDisabled:
        return None, 'disabled'
    except VideoUnavailable:
        return None, 'unavailable'
    except NoTranscriptFound:
        return None, 'no_captions'
    except Exception as e:
        return None, f'error: {str(e)[:60]}'

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print(f"API: {API_BASE}")

    channels = get_channels()
    if args.channel:
        targets = [c for c in channels if c['id'] == args.channel or c.get('handle') == args.channel]
    else:
        targets = channels

    if not targets:
        suffix = f' matching "{args.channel}"' if args.channel else ''
        print(f"No channels found{suffix}")
        sys.exit(1)

    for channel in targets:
        print(f"\n📺 {channel['name']} ({channel['id']})")
        stubs = get_stubs(channel['id'], LIMIT)
        print(f"   {len(stubs)} stubs to process")

        success = 0
        no_captions = 0
        errors = 0

        for i, v in enumerate(stubs, 1):
            vid = v['id']
            title = (v.get('title') or '')[:50]
            sys.stdout.write(f"   [{i}/{len(stubs)}] {vid} | {title} ... ")
            sys.stdout.flush()

            segments, err = fetch_transcript(vid)

            if segments is None:
                sys.stdout.write(f"{err}\n")
                sys.stdout.flush()
                if err and err.startswith('error:'):
                    errors += 1
                else:
                    no_captions += 1
            else:
                duration = max((s['start'] + s['dur'] for s in segments), default=0)
                saved = save_transcript(vid, v.get('title', ''), int(duration), segments)
                if saved:
                    sys.stdout.write(f"ok ({len(segments)} segments)\n")
                    success += 1
                else:
                    sys.stdout.write("save failed\n")
                    errors += 1

            sys.stdout.flush()
            time.sleep(DELAY_MS / 1000 + random.random() * 0.5)

        print(f"   ✓ done: {success} saved, {no_captions} no captions, {errors} errors")

if __name__ == '__main__':
    main()
