import os
import sys
import json
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from agent_loop import VajraAgentLoop

agent = VajraAgentLoop()

print("--- Testing VajraAgentLoop with real LLM ---")
query = "Find case CR-2024-81977"
res = agent.run_agent_loop(query=query, session_id="test_session_1", employee_id=101)
print("Response Text:", res.get("response_text"))
print("AI Unavailable Flag:", res.get("ai_unavailable"))
print("Citations Count:", len(res.get("citations", [])))
