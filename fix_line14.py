with open('src/pages/AdminConsole.jsx', encoding='utf-8') as f:
    c = f.read()

old = "pro:     { label: 'Pro',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' }, color: '#a855f7', bg: 'rgba(168,85,247,0.12)' }}"
new = "pro:     { label: 'Pro',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' }}"

if old in c:
    c = c.replace(old, new)
    with open('src/pages/AdminConsole.jsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print('Fixed line 14')
else:
    print('NO MATCH')
    print('Line 14 currently:', c.split('\n')[13])
