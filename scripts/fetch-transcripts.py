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

import subprocess
import tempfile
import glob

try:
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled, VideoUnavailable
    HAS_YT_TRANSCRIPT = True
except ImportError:
    HAS_YT_TRANSCRIPT = False

# Check yt-dlp availability
try:
    subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
    HAS_YTDLP = True
except (subprocess.CalledProcessError, FileNotFoundError):
    HAS_YTDLP = False

if not HAS_YT_TRANSCRIPT and not HAS_YTDLP:
    print("❌ Missing dependency: pip install yt-dlp")
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

def fetch_via_ytdlp(video_id):
    """
    Use yt-dlp to download subtitle/transcript files.
    yt-dlp has maintained YouTube bot-detection evasion and works from datacenter IPs.
    Returns (segments, error_code).
    """
    if not HAS_YTDLP:
        return None, 'no_ytdlp'

    with tempfile.TemporaryDirectory() as tmpdir:
        url = f'https://www.youtube.com/watch?v={video_id}'
        cmd = [
            'yt-dlp',
            '--skip-download',
            '--write-auto-sub',
            '--write-sub',
            '--sub-lang', 'en',
            '--sub-format', 'json3',
            '--output', f'{tmpdir}/%(id)s',
            '--no-playlist',
            '--extractor-args', 'youtube:player_client=android,ios,web',
            url,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            # Log ALL yt-dlp output for diagnostics (returncode + stderr + stdout snippet)
            sys.stdout.write(f'[rc={result.returncode}] ')
            for line in (result.stderr or '').strip().split('\n'):
                if line.strip():
                    sys.stdout.write(f'[err: {line.strip()[:80]}] ')
            for line in (result.stdout or '').strip().split('\n')[:3]:
                if line.strip():
                    sys.stdout.write(f'[out: {line.strip()[:60]}] ')
            sys.stdout.flush()
        except subprocess.TimeoutExpired:
            return None, 'ytdlp_timeout'
        except Exception as e:
            return None, f'ytdlp_err: {str(e)[:40]}'

        # List all files in tmpdir for diagnostics
        all_tmpdir = glob.glob(f'{tmpdir}/*')
        if all_tmpdir:
            sys.stdout.write(f'[files: {[os.path.basename(f) for f in all_tmpdir]}] ')
            sys.stdout.flush()

        # Find any generated subtitle file
        sub_files = glob.glob(f'{tmpdir}/{video_id}*.json3')
        if not sub_files:
            # Also check for .vtt or other formats
            all_files = glob.glob(f'{tmpdir}/{video_id}*')
            if not all_files:
                return None, 'no_captions'
            return None, f'no_json3 ({[os.path.basename(f) for f in all_files]})'

        sub_file = sub_files[0]
        try:
            with open(sub_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            segments = []
            for ev in data.get('events', []):
                if not ev.get('segs'):
                    continue
                start = (ev.get('tStartMs', 0)) / 1000
                dur = (ev.get('dDurationMs', 2000)) / 1000
                text = ''.join(s.get('utf8', '') for s in ev['segs']).replace('\n', ' ').strip()
                if text:
                    segments.append({'text': text, 'start': round(start, 3), 'dur': round(dur, 3)})

            if not segments:
                return None, 'empty_transcript'

            return segments, None
        except Exception as e:
            return None, f'parse_err: {str(e)[:40]}'


def fetch_via_transcript_api(video_id):
    """
    Use youtube-transcript-api as fallback.
    Works from residential IPs; may fail from datacenter IPs.
    Returns (segments, error_code).
    """
    if not HAS_YT_TRANSCRIPT:
        return None, 'no_yt_api'

    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

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
            for t in transcript_list:
                if t.language_code.startswith('en'):
                    transcript = t
                    break

        if transcript is None:
            langs = ', '.join(t.language_code for t in transcript_list)
            return None, f'no_en ({langs})'

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


def fetch_transcript(video_id):
    """
    Try yt-dlp first (more reliable from datacenter IPs), fall back to youtube-transcript-api.
    Returns (segments, error_code).
    """
    segments, err = fetch_via_ytdlp(video_id)
    if segments:
        return segments, None

    # Fall back to youtube-transcript-api
    segments2, err2 = fetch_via_transcript_api(video_id)
    if segments2:
        return segments2, None

    # Both failed; return the more informative error
    return None, err or err2

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
