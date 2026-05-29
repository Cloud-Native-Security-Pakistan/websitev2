"""Audit every href across the v2 site: dedupe, categorize, flag internal routes
that don't resolve to a file, and list externals to verify."""
import os, re, glob

ROOT = "."
href_re = re.compile(r'href=["\']([^"\']+)["\']')
# also catch JS-defined links in components
js_href_re = re.compile(r"href:\s*['\"]([^'\"]+)['\"]")

internal, external, mailto, anchors, placeholders = set(), set(), set(), set(), set()
sources = {}

def note(link, src):
    sources.setdefault(link, set()).add(src)

files = glob.glob("**/*.html", recursive=True) + glob.glob("js/*.js", recursive=True)
for fp in files:
    if "node_modules" in fp:
        continue
    with open(fp, encoding="utf-8") as f:
        txt = f.read()
    for m in list(href_re.finditer(txt)) + list(js_href_re.finditer(txt)):
        link = m.group(1).strip()
        note(link, fp)
        if link in ("#", ""):
            placeholders.add(link)
        elif link.startswith("#"):
            anchors.add(link)
        elif link.startswith("mailto:"):
            mailto.add(link)
        elif link.startswith("http"):
            external.add(link)
        elif link.startswith("/"):
            internal.add(link)
        else:
            internal.add(link)  # relative

def resolves(route):
    # Strip query/hash
    r = route.split("?")[0].split("#")[0]
    if r.endswith("/"):
        cand = [os.path.join(ROOT, r.strip("/"), "index.html")]
    elif "." in os.path.basename(r):
        cand = [os.path.join(ROOT, r.lstrip("/"))]
    else:
        cand = [os.path.join(ROOT, r.lstrip("/"), "index.html"),
                os.path.join(ROOT, r.lstrip("/") + ".html"),
                os.path.join(ROOT, r.lstrip("/"))]
    return any(os.path.exists(c) for c in cand)

print("=" * 60)
print("INTERNAL ROUTES / ASSETS")
print("=" * 60)
for link in sorted(internal):
    ok = "OK  " if resolves(link) else "MISS"
    print(f"  [{ok}] {link}")

print("\n" + "=" * 60)
print("EXTERNAL LINKS (verify these resolve / are correct)")
print("=" * 60)
for link in sorted(external):
    print(f"  {link}")

print("\n" + "=" * 60)
print("MAILTO")
print("=" * 60)
for link in sorted(mailto):
    print(f"  {link.split('?')[0]}")

print("\n" + "=" * 60)
print("PLACEHOLDER / EMPTY href (# or blank) — these go nowhere")
print("=" * 60)
for link in sorted(placeholders):
    print(f"  '{link}'  in: {', '.join(sorted(sources[link]))}")

print("\n" + "=" * 60)
print(f"TOTALS: {len(internal)} internal, {len(external)} external, "
      f"{len(mailto)} mailto, {len(anchors)} anchors, {len(placeholders)} placeholder")
