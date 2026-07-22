import os
import time
import json
from dotenv import load_dotenv
load_dotenv('../.env')

from catalyst_llm import CatalystLLM

llm = CatalystLLM()

prompts = [
    {
        "name": "Strategy 1: max_tokens=800, brief reasoning",
        "messages": [
            {"role": "system", "content": "You are a Karnataka Police assistant. Keep reasoning brief. Respond with JSON: {\"text_response\": \"...\"}"},
            {"role": "user", "content": "Case FIR-2026-0814: Accused Ramesh, Section 302 IPC. Summarize and suggest next step."}
        ],
        "max_tokens": 800
    },
    {
        "name": "Strategy 2: max_tokens=1000, direct synthesis",
        "messages": [
            {"role": "system", "content": "You are a Karnataka Police assistant. Summarize the case in 2 bullet points. Respond with JSON: {\"text_response\": \"...\"}"},
            {"role": "user", "content": "Case FIR-2026-0814: Accused Ramesh, Section 302 IPC. Summarize and suggest next step."}
        ],
        "max_tokens": 1000
    }
]

for p in prompts:
    print(f"=== Running {p['name']} ===")
    t0 = time.time()
    res = llm.chat(p['messages'], tools=None, use_agent_system_prompt=False, max_tokens=p['max_tokens'])
    elapsed = time.time() - t0
    print(f"Elapsed: {elapsed:.2f}s")
    if 'choices' in res:
        content = res['choices'][0]['message']['content']
        print("Response:", content)
    else:
        print("Error:", res)
    print()
