import re

# ── 1. Clean up duplicated maxWidth in MyTeam.jsx ────────────────────────
with open('src/pages/MyTeam.jsx', encoding='utf-8') as f:
    c = f.read()

# Remove the duplicated maxWidth/margin
c = c.replace(
    'style={{maxWidth: isMobile ? "100%" : 720, margin: "0 auto",maxWidth: isMobile ? "100%" : 720, margin: "0 auto",',
    'style={{maxWidth: isMobile ? "100%" : 720, margin: "0 auto",'
)
print('1. MyTeam dedupe:', 'OK' if 'margin: "0 auto",maxWidth' not in c else 'FAILED')

with open('src/pages/MyTeam.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

# ── 2. Dashboard: switch from ML engine to Oracle engine ────────────────
with open('src/pages/Dashboard.jsx', encoding='utf-8') as f:
    d = f.read()

# Replace the OLD ML engine URL with the Oracle engine URL
old_url1 = "ENGINE_URL = 'https://web-production-21545.up.railway.app'"
new_url1 = "ENGINE_URL = 'https://predictivefpl-production.up.railway.app'"
if old_url1 in d:
    d = d.replace(old_url1, new_url1)
    print('2. Dashboard ENGINE_URL: OK')
else:
    # Try another variant
    print('2. Dashboard ENGINE_URL: searching...')
    idx = d.find('web-production-21545')
    while idx >= 0:
        # Replace the surrounding URL
        line_start = d.rfind('\n', 0, idx)
        line_end   = d.find('\n', idx)
        line = d[line_start:line_end]
        print('  Found at:', repr(line))
        idx = d.find('web-production-21545', idx+1)
    d = d.replace('web-production-21545.up.railway.app', 'predictivefpl-production.up.railway.app')
    print('  Replaced all occurrences')

# Also check the /status endpoint - Oracle uses /oracle/status
d = d.replace('/status")', '/oracle/status")')
d = d.replace('/status\')', '/oracle/status\')')
print('3. Dashboard /status -> /oracle/status: applied')

with open('src/pages/Dashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(d)

print('\nDone.')
