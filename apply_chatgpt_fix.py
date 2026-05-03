import re

results = {}

# ══════════════════════════════════════════════════════════════════════════════
# MyTeam.jsx
# ══════════════════════════════════════════════════════════════════════════════
with open('src/pages/MyTeam.jsx', encoding='utf-8') as f:
    c = f.read()

mt_fixes = 0

# Fix 1a: h-screen overflow-hidden -> min-h-screen with natural scroll
old_wrapper = 'className="flex-1 flex flex-col h-screen overflow-hidden"'
new_wrapper = 'className="flex-1 flex flex-col min-h-screen"'
if old_wrapper in c:
    c = c.replace(old_wrapper, new_wrapper)
    mt_fixes += 1
    print('MyTeam: h-screen wrapper -> min-h-screen OK')

# Fix 1b: any other h-screen inside the page that's blocking content
# Replace remaining h-screen WITHIN this content area but not the outer wrapper
# (outer wrapper "min-h-screen bg-[#0F121D]..." is fine - that's correct)

# Fix 2: Remove maxWidth:110 from player tokens
old_token = 'style={{flex:1,maxWidth:110,minWidth:0,gap:3}}'
new_token = 'style={{flex:1,minWidth:0,gap:3}}'
if old_token in c:
    c = c.replace(old_token, new_token)
    mt_fixes += 1
    print('MyTeam: token maxWidth removed OK')

# Fix 3: Avatar width:62,height:62 -> responsive clamp
old_av = 'style={{width:62,height:62}}'
new_av = 'style={{width:"clamp(36px,9vw,62px)",height:"clamp(36px,9vw,62px)"}}'
if old_av in c:
    c = c.replace(old_av, new_av)
    mt_fixes += 1
    print('MyTeam: avatar clamp OK')

# Fix 4: pitch min-height 520 -> aspect-ratio (so it scales to width)
for old in ["minHeight:'520px',", 'minHeight:"520px",', "minHeight: '520px',"]:
    if old in c:
        c = c.replace(old, "aspectRatio:'400/580',minHeight:0,")
        mt_fixes += 1
        print(f'MyTeam: pitch aspectRatio OK ({old[:25]})')
        break

with open('src/pages/MyTeam.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

results['MyTeam'] = f'{mt_fixes} fixes applied'


# ══════════════════════════════════════════════════════════════════════════════
# Rivals.jsx
# ══════════════════════════════════════════════════════════════════════════════
with open('src/pages/Rivals.jsx', encoding='utf-8') as f:
    c2 = f.read()

rv_fixes = 0

# Fix 1: h-screen overflow-hidden -> min-h-screen
old_wrap_rv = 'className="flex-1 flex flex-col overflow-hidden"'
new_wrap_rv = 'className="flex-1 flex flex-col min-h-screen"'
if old_wrap_rv in c2:
    c2 = c2.replace(old_wrap_rv, new_wrap_rv)
    rv_fixes += 1
    print('Rivals: overflow-hidden wrapper -> min-h-screen OK')

# Fix 1b: alternate h-screen pattern
old_wrap_rv2 = 'className="flex-1 flex flex-col h-screen overflow-hidden"'
if old_wrap_rv2 in c2:
    c2 = c2.replace(old_wrap_rv2, 'className="flex-1 flex flex-col min-h-screen"')
    rv_fixes += 1
    print('Rivals: h-screen overflow wrapper OK')

# Fix 2: Add overflow-x:auto to table container so it can scroll horizontally if needed (for desktop wide tables on mobile)
# Find any class containing "overflow-hidden" on a table-wrapping div
# Make any GlassCard wrapping the table allow horizontal scroll on mobile
old_glass = 'className="glass-card rounded-2xl border border-gray-700/50 overflow-hidden"'
new_glass = 'className="glass-card rounded-2xl border border-gray-700/50" style={{overflowX:"auto"}}'
if old_glass in c2:
    c2 = c2.replace(old_glass, new_glass)
    rv_fixes += 1
    print('Rivals: table container scrollable OK')

with open('src/pages/Rivals.jsx', 'w', encoding='utf-8') as f:
    f.write(c2)

results['Rivals'] = f'{rv_fixes} fixes applied'


# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
print('\n=== Summary ===')
for k, v in results.items():
    print(f'  {k}: {v}')

total = mt_fixes + rv_fixes
print(f'\nTotal: {total} fixes')
print('\nKey changes:')
print('  - h-screen + overflow-hidden -> min-h-screen (lets content flow on mobile)')
print('  - Player token maxWidth removed (lets avatars shrink naturally on narrow screens)')
print('  - Pitch fixed minHeight -> aspectRatio (proper scaling on every viewport)')
print('  - Avatar size now uses clamp() (auto-shrinks on phones)')
