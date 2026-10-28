"""
VAJRA 3.0 Tool: Modus Operandi (MO) Semantic Case Retrieval
===========================================================
Retrieves historical CCTNS cases across Karnataka sharing similar behavioral,
operational, and tactical signatures using 384-d dense Sentence-BERT vectors.
"""

from typing import Dict, Any
from tools.registry import VajraTool, ToolManager
from mo_semantic_engine import find_similar_cases

class MoSemanticTool(VajraTool):
    def get_schema(self) -> dict:
        return {
            "name": "search_similar_mo",
            "description": "Finds historical CCTNS cases with similar Modus Operandi (MO) and behavioral signatures to an unsolved incident description using semantic vector search.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Narrative description of the crime's modus operandi, vehicle used, entry method, or weapon"
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of similar historical cases to retrieve (default: 5)",
                        "default": 5
                    },
                    "crime_head_id": {
                        "type": "integer",
                        "description": "Optional CCTNS CrimeMajorHeadID filter"
                    }
                },
                "required": ["query"]
            }
        }

    def execute(self, params: dict, context: dict) -> dict:
        query = (params.get("query") or params.get("text") or "").strip()
        top_k = params.get("top_k") or 5
        head_id = params.get("crime_head_id")

        if not query:
            return {
                "response_type": "text",
                "text_result": "⚠️ Please provide a modus operandi narrative to search for matching historical cases."
            }

        matches = find_similar_cases(query_text=query, top_k=top_k, head_id=head_id)

        if not matches:
            return {
                "response_type": "mo_matches",
                "text_result": f"🔍 **MO Semantic Search**: No historical cases found matching '{query[:60]}...' above similarity threshold.",
                "data": {"query": query, "matches": []}
            }

        lines = [
            f"🔍 **Modus Operandi (MO) Semantic Search Results**",
            f"*Query*: \"{query}\"\n"
        ]

        for m in matches:
            lines.append(
                f"**#{m['rank']} — FIR: {m['crime_no']}** ({m['case_date']})\n"
                f"• **Semantic Similarity**: **{m['similarity_score']}%**\n"
                f"• **Shared Behavioral Clues**: {', '.join(m['shared_behavioral_tokens']) if m['shared_behavioral_tokens'] else 'Semantic thematic correlation'}\n"
                f"• **Narrative Excerpt**: \"{m['brief_facts'][:140]}...\"\n"
            )

        lines.append("*Investigative Disclosure*: Ranked by semantic narrative similarity across Karnataka CCTNS records. Evaluated as investigative leads.")

        return {
            "response_type": "mo_matches",
            "text_result": "\n".join(lines),
            "data": {
                "query": query,
                "matches": matches,
                "epistemic_tier": "Tier 3: Investigative Lead for Investigating Officer Verification"
            },
            "citations": [{
                "type": "MO Semantic Index",
                "id": m["crime_no"],
                "details": f"Similarity: {m['similarity_score']}%"
            } for m in matches[:3]]
        }

# Register with central ToolManager
ToolManager.register("search_similar_mo", MoSemanticTool())
