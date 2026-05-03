import re

print('═══ MyTeam.jsx ═══')
with open('src/pages/MyTeam.jsx', encoding='utf-8') as f:
    c = f.read()

# Show the main return structure
idx = c.rfind('return (')
print('Length:', len(c))
print('Return at line:', c[:idx].count('\n')+1)
print()
print('--- First 1500 chars of return JSX ---')
print(c[idx:idx+1500])
print()
print('--- Hooks section ---')
m = re.search(r'export default function MyTeam[^{]*\{([^{}]{0,500})', c)
if m: print(m.group(1))
print()
print('--- Pitch container (rgba(16,100,40)) ---')
idx2 = c.find('rgba(16,100,40')
if idx2 > 0:
    print(c[max(0,idx2-300):idx2+200])

print()
print('═══ Rivals.jsx ═══')
with open('src/pages/Rivals.jsx', encoding='utf-8') as f:
    c2 = f.read()

idx = c2.rfind('return (')
print('Length:', len(c2))
print()
print('--- First 1500 chars of return JSX ---')
print(c2[idx:idx+1500])
print()
print('--- Hooks section ---')
m = re.search(r'export default function Rivals[^{]*\{([^{}]{0,500})', c2)
if m: print(m.group(1))
