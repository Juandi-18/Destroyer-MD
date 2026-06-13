from pathlib import Path
import re

files = [
    Path('cmds/nsfw/danbooru.js'),
    Path('cmds/nsfw/gelbooru.js'),
    Path('cmds/nsfw/rule34.js'),
    Path('cmds/nsfw/xvideos.js'),
    Path('cmds/nsfw/xnxx.js'),
    Path('cmds/nsfw/reactions.js'),
]

import re

MODE_ENABLED = "const modoEnabled = chat.modosexo === 1 || chat.modosexo === true || chat.nsfw === 1 || chat.nsfw === true;"
MESSAGE = "if (!modoEnabled) return msg.reply(`ꕥ El contenido de *Modo Sexo* está desactivado en este grupo.\n\nUn *administrador* puede activarlo con el comando:\n» *${usedPrefix}modosexo modo sexo*`)"
PATTERN = re.compile(r'(?P<indent>^[ \t]*)if \(!chat\.nsfw\) return msg\.reply\(`[^`]*`\)(?P<semi>;?)', re.MULTILINE | re.DOTALL)

for p in files:
    text = p.read_text(encoding='utf-8')
    new = PATTERN.sub(lambda m: f"{m.group('indent')}{MODE_ENABLED}\n{m.group('indent')}{MESSAGE}{m.group('semi')}", text)
    if p.name == 'reactions.js':
        new = new.replace("category: 'nsfw'", "category: 'modosexo'")
        new = new.replace("description: 'Comandos de reacciones NSFW entre usuarios.'", "description: 'Comandos de reacciones de modo sexo entre usuarios.'")
    if new != text:
        p.write_text(new, encoding='utf-8')
        print(f'Patched {p.name}')
    else:
        print(f'No changes for {p.name}')
