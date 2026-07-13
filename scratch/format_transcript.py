import json
import os

transcript_path = r"C:\Users\B.C SAKETH\.gemini\antigravity-ide\brain\eb23949a-f361-44a7-b808-622e51567a02\.system_generated\logs\transcript.jsonl"
output_path = r"c:\Users\B.C SAKETH\Downloads\VAJRA-main\chat_transcript.md"

if not os.path.exists(transcript_path):
    print(f"Transcript path not found: {transcript_path}")
    exit(1)

print(f"Reading transcript from: {transcript_path}")
messages = []

with open(transcript_path, "r", encoding="utf-8") as f:
    for line in f:
        if not line.strip():
            continue
        try:
            step = json.loads(line)
            source = step.get("source")
            stype = step.get("type")
            content = step.get("content", "")
            
            if stype == "USER_INPUT":
                messages.append(f"### **USER**\n\n{content}\n")
            elif source == "MODEL" and content:
                # Filter out pure tool execution responses if any, keep text responses
                messages.append(f"### **ANTIGRAVITY**\n\n{content}\n")
        except Exception as e:
            print(f"Error parsing line: {e}")

print(f"Writing {len(messages)} messages to {output_path}...")
with open(output_path, "w", encoding="utf-8") as f:
    f.write("# VAJRA — Full Chat Transcript\n\n")
    for msg in messages:
        f.write(msg)
        f.write("\n---\n\n")

print("Transcript formatting complete!")
