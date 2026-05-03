with open('src/pages/MyTeam.jsx', encoding='utf-8') as f:
    c = f.read()

fixes = 0

# Fix 1: Add useIsMobile import
if 'useIsMobile' not in c:
    lines = c.split('\n')
    last_import = max((i for i,ln in enumerate(lines) if ln.startswith('import ')), default=0)
    lines.insert(last_import + 1, "import { useIsMobile } from '../hooks/useIsMobile'")
    c = '\n'.join(lines)
    fixes += 1
    print('Import: OK')

# Fix 2: Add isMobile hook call
import re
m = re.search(r'(export default function MyTeam\(\)[^{]*\{)', c)
if m and 'const isMobile' not in c[m.end():m.end()+500]:
    c = c[:m.end()] + '\n  const isMobile = useIsMobile()' + c[m.end():]
    fixes += 1
    print('Hook call: OK')

# Fix 3: Pitch container minHeight 520 -> aspectRatio
old1 = "minHeight:'520px',"
new1 = "aspectRatio:'400/580',minHeight:0,"
if old1 in c:
    c = c.replace(old1, new1)
    fixes += 1
    print('Pitch aspectRatio: OK')
else:
    # Try alternate quote style
    old1b = 'minHeight:"520px",'
    new1b = 'aspectRatio:"400/580",minHeight:0,'
    if old1b in c:
        c = c.replace(old1b, new1b)
        fixes += 1
        print('Pitch aspectRatio (alt): OK')

# Fix 4: Player avatar 62x62 -> clamp
old_avatar = 'style={{width:62,height:62}}'
new_avatar = 'style={{width:"clamp(38px,10vw,62px)",height:"clamp(38px,10vw,62px)"}}'
if old_avatar in c:
    c = c.replace(old_avatar, new_avatar)
    fixes += 1
    print('Avatar clamp: OK')

# Fix 5: Add max-width to pitch on desktop
# Find the pitch outer container - flex-1 relative rounded-2xl
old_pitch_wrap = 'className="flex-1 relative rounded-2xl overflow-hidden" style={{'
new_pitch_wrap = 'className="flex-1 relative rounded-2xl overflow-hidden" style={{maxWidth: isMobile ? "100%" : 720, margin: "0 auto",'
if old_pitch_wrap in c:
    c = c.replace(old_pitch_wrap, new_pitch_wrap)
    fixes += 1
    print('Pitch max-width: OK')

# Fix 6: Add bottom padding for mobile bottom nav
old_wrap = 'className="min-h-screen bg-[#0F121D] bg-grid flex text-white"'
if old_wrap in c and 'paddingBottom: isMobile' not in c:
    new_wrap = 'className="min-h-screen bg-[#0F121D] bg-grid flex text-white" style={{paddingBottom: isMobile ? 60 : 0}}'
    c = c.replace(old_wrap, new_wrap)
    fixes += 1
    print('Bottom padding: OK')

with open('src/pages/MyTeam.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print(f'\n{fixes} fixes applied')
