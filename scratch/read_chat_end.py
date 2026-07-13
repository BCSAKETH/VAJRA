import sys

# Force stdout to be utf-8
sys.stdout.reconfigure(encoding='utf-8')

with open("chat_transcript.md", "r", encoding="utf-8", errors="replace") as f:
    lines = f.readlines()

print(f"Total lines in chat_transcript.md: {len(lines)}")
print("".join(lines[-150:]))
