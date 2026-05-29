import urllib.request, urllib.error

def check(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'cnspk-audit'})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return f"ERR {e}"

repos = ["become-a-member", "becoming-a-member", "cloudnativesecurity.pk-website", "events"]
for r in repos:
    print(check(f"https://api.github.com/repos/Cloud-Native-Security-Pakistan/{r}"), f"repo: {r}")
print(check("https://api.github.com/orgs/cloudnativesecurity-pk"), "org: cloudnativesecurity-pk (slug used in events link)")
print(check("https://api.github.com/orgs/Cloud-Native-Security-Pakistan"), "org: Cloud-Native-Security-Pakistan (correct)")
