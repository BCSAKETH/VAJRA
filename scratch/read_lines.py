import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("chat_transcript.md", "r", encoding="utf-8", errors="replace") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
# Write lines from 128500 to the end
with open("scratch/chat_end.txt", "w", encoding="utf-8") as out:
    out.writelines(lines[128500:])

print("Wrote end of chat_transcript.md to scratch/chat_end.txt")
