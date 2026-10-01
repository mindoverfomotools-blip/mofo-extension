#!/usr/bin/env python3
"""Check that the MOFO you get from the Chrome Web Store is exactly the code in this repo.

  python3 verify.py              downloads the current store version from Google and compares it
  python3 verify.py file.crx     checks a .crx you downloaded yourself

Only the Python standard library is used. Nothing is installed or sent anywhere except the download from Google.
"""
import hashlib, io, json, os, struct, sys, urllib.request, zipfile

EXTENSION_ID = 'ahljpbjjmfkdepihfgnpfkkehhbimdag'
STORE_URL = ('https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0'
             '&acceptformat=crx3&x=id%3D' + EXTENSION_ID + '%26uc')
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'extension')


def digest(name, data):
    # The store adds one line to the manifest ("update_url"); everything else must be byte for byte the same.
    if name == 'manifest.json':
        m = json.loads(data)
        m.pop('update_url', None)
        data = json.dumps(m, sort_keys=True).encode()
    return hashlib.sha256(data).hexdigest()


def fingerprint(files):
    return hashlib.sha256(''.join(f'{p}:{files[p]}\n' for p in sorted(files)).encode()).hexdigest()


def store_files(raw):
    if raw[:4] != b'Cr24':
        sys.exit('That is not a Chrome extension package (.crx).')
    header = struct.unpack('<I', raw[8:12])[0]
    z = zipfile.ZipFile(io.BytesIO(raw[12 + header:]))
    # _metadata/ is Google's own signature data, added by the store.
    names = [n for n in z.namelist() if not n.endswith('/') and not n.startswith('_metadata/')]
    return {n: digest(n, z.read(n)) for n in names}, json.loads(z.read('manifest.json'))['version']


def repo_files():
    out = {}
    for d, _, fs in os.walk(SRC):
        for f in fs:
            if f == '.DS_Store':
                continue
            p = os.path.relpath(os.path.join(d, f), SRC).replace(os.sep, '/')
            out[p] = digest(p, open(os.path.join(d, f), 'rb').read())
    return out, json.load(open(os.path.join(SRC, 'manifest.json')))['version']


def main():
    if len(sys.argv) > 1:
        raw = open(sys.argv[1], 'rb').read()
    else:
        print('Downloading MOFO from the Chrome Web Store...')
        raw = urllib.request.urlopen(urllib.request.Request(STORE_URL, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
    store, sv = store_files(raw)
    repo, rv = repo_files()
    print(f'Chrome Web Store version: {sv} ({len(store)} files, fingerprint {fingerprint(store)[:16]})')
    print(f'This repo:                {rv} ({len(repo)} files, fingerprint {fingerprint(repo)[:16]})')
    if sv != rv:
        print(f'\nDifferent versions. Run "git checkout v{sv}" and try again.')
        sys.exit(2)
    diff = sorted(p for p in set(store) | set(repo) if store.get(p) != repo.get(p))
    if diff:
        print('\nMISMATCH in:', ', '.join(diff))
        sys.exit(1)
    print(f'\nMATCH: the Chrome Web Store version {sv} is exactly the code in this repo.')


if __name__ == '__main__':
    main()
