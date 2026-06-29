#!/usr/bin/env python3
import re

with open('/opt/p2p-file-share/src/App.tsx', 'r') as f:
    content = f.read()

idx = content.find('pendingReceive && incomingFileInfo')
print(f"Found at idx={idx}")
if idx != -1:
    # Find enclosing { ... }
    start = content.rfind('\n', 0, idx)
    end = content.find(')}', idx)
    print(repr(content[start:start+60]))
    print("...")
    print(repr(content[end-5:end+5]))
