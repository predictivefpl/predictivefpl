import re

with open('src/pages/AdminConsole.jsx', encoding='utf-8') as f:
    c = f.read()

orig = c

# Fix 1: Line 567 - delete the broken object entirely
# Pattern: { tier:, icon: '...', msg: '...' }
c = re.sub(r"\{\s*tier:\s*,\s*icon:[^}]+\}\s*\]\.map", "].map", c)
c = re.sub(r",\s*\{\s*tier:\s*,\s*icon:[^}]+\}", "", c)

# Fix 2: Any remaining ", premium" or "premium," fragments
c = re.sub(r",\s*premium\b", "", c)
c = re.sub(r"\bpremium\s*,", "", c)

# Fix 3: Any leftover "premium:" in objects without value
c = re.sub(r"premium:\s*[,}]", "", c)

# Fix 4: Empty value in JSX expressions: { || null}
c = re.sub(r"\{\s*\|\|\s*null\s*\}", "{0}", c)
c = re.sub(r"value=\{\s*\|\|\s*null\s*\}", "value={0}", c)

# Fix 5: Standalone empty tier values in ternaries
c = re.sub(r":\s*\}", ": 0}", c)
# But careful - don't break valid JSX like "color: }". Only fix if it's clearly a value
c = re.sub(r"(\w+\s*\?\s*\w+\s*):\s*0\}", r"\1: 0}", c)  # noop but safe

# Show what changed
if c != orig:
    with open('src/pages/AdminConsole.jsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print('Cleaned premium fragments')

# Final scan for any remaining issues
issues = []
for i, line in enumerate(c.split('\n'), 1):
    # Empty value patterns that break syntax
    if re.search(r":\s*\}", line) and 'style' not in line:
        issues.append((i, line.strip()[:100]))
    if re.search(r"=\s*\{\s*\|\|", line):
        issues.append((i, line.strip()[:100]))
    if re.search(r"const\s+\w*\s*=\s*allUsers", line) and '=' in line:
        # Check for empty const name
        m = re.match(r"\s*const\s+(\w*)\s*=", line)
        if m and not m.group(1):
            issues.append((i, line.strip()[:100]))
    if 'tier:,' in line.replace(' ',''):
        issues.append((i, line.strip()[:100]))
    if 'tier ===)' in line.replace(' ',''):
        issues.append((i, line.strip()[:100]))

if issues:
    print('\n⚠️ Possible remaining issues:')
    for line_no, txt in issues[:10]:
        print(f'  Line {line_no}: {txt}')
else:
    print('\n✓ No obvious issues found - try npm run build')
