import re

with open('src/pages/AdminConsole.jsx', encoding='utf-8') as f:
    c = f.read()

fixes = 0

# ── 1. Fix the syntax error ───────────────────────────────────────────────────
old_syntax = "const premCount   = allUsers.filter(u => u.tier ===).length"
if old_syntax in c:
    # Just remove this line entirely - we don't need premium count
    c = c.replace(old_syntax + '\n  ', '')
    fixes += 1
    print('Syntax error fixed: removed premCount')
else:
    # Try without exact spacing
    c = re.sub(r'const\s+premCount\s*=\s*allUsers\.filter\(u\s*=>\s*u\.tier\s*===\s*\)\.length\s*\n\s*', '', c)
    if 'premCount' not in c:
        fixes += 1
        print('Syntax error fixed (regex)')

# Also clean up any reference to premCount elsewhere in the file
c = re.sub(r'\{premCount\}', '0', c)
c = re.sub(r'premCount,?', '', c)

# ── 2. Look for where users are rendered to find the actual buttons section ──
# Look for the users.map or filtered.map JSX
idx = c.find('filtered.map')
if idx < 0: idx = c.find('users.map')
if idx < 0: idx = c.find('allUsers.map')
print(f'\nUser map found at char: {idx}')

# Show what the row looks like
if idx > 0:
    end = c.find('</tr>', idx)
    if end > 0:
        row = c[idx:end+5]
        print('Row length:', len(row))
        # Look for the tier display column
        if 'u.tier' in row:
            print('Has u.tier rendering')
        # Print the cells
        cells = re.findall(r'<td[^>]*>[\s\S]*?</td>', row)
        print(f'{len(cells)} cells in row')
        for i, cell in enumerate(cells):
            preview = cell[:120].replace('\n',' ')
            print(f'  Cell {i+1}: {preview}...')

with open('src/pages/AdminConsole.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print(f'\n{fixes} fixes applied (syntax error)')
print('NOW READY to add tier dropdown - need to see exact row structure first')
