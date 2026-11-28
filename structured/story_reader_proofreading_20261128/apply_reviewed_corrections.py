"""Apply or verify the reviewed 2026-11-28 patch, using exact file hashes.

Usage: python apply_reviewed_corrections.py --apply   (or --check)
All inputs are local. All files are checked before any replacement is written.
"""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import tempfile
import os


def digest(data):
    return sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    repo = here.parents[1]
    manifest = json.loads((here / 'reviewed_patch.json').read_text(encoding='utf-8'))
    planned = []
    for record in manifest['files']:
        path = (repo / record['path']).resolve()
        if not path.is_relative_to(repo) or not path.is_file():
            raise ValueError('Invalid patch target: ' + str(path))
        raw = path.read_bytes()
        newline = b'\r\n' if b'\r\n' in raw else b'\n'
        data = raw.replace(b'\r\n', b'\n')
        if digest(data) == record['after_sha256']:
            continue
        if args.check or digest(data) != record['before_sha256']:
            raise ValueError('Unexpected file contents: ' + record['path'])
        # Edits are exact spans against the baseline UTF-8 bytes, not text search.
        for edit in sorted(record['edits'], key=lambda x: x['offset'], reverse=True):
            start = edit['offset']
            old = edit['before'].encode('utf-8')
            new = edit['after'].encode('utf-8')
            if data[start:start + len(old)] != old:
                raise ValueError('Patch context changed: ' + record['path'])
            data = data[:start] + new + data[start + len(old):]
        if digest(data) != record['after_sha256']:
            raise ValueError('Patch result differs: ' + record['path'])
        planned.append((path, data.replace(b'\n', newline)))
    for path, data in planned:
        handle, temporary = tempfile.mkstemp(prefix='.reviewed-', dir=path.parent)
        try:
            with os.fdopen(handle, 'wb') as stream:
                stream.write(data)
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    print('PASS: reviewed chapter files verified;', len(planned), 'files updated')


if __name__ == '__main__':
    main()
