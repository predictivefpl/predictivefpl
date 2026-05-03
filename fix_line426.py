with open('src/pages/AdminConsole.jsx', encoding='utf-8') as f:
    c = f.read()

old = "t === 'pro' ? proCount : }"
new = "t === 'pro' ? proCount : 0}"

if old in c:
    c = c.replace(old, new)
    with open('src/pages/AdminConsole.jsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print('Fixed line 426')
else:
    print('NO MATCH - showing line 426:')
    print(c.split('\n')[425])
