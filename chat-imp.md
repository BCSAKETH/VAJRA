# 🛡️ VAJRA Intelligence & Chat Pipeline Hardening Report: Eliminating Hallucinations & Enforcing Operational Grounding

**Document:** `chat-imp.md`  
**Status:** Architectural Blueprint & Action Plan  
**Target Systems:** `vajra_backend/agent_loop.py`, `vajra_backend/catalyst_llm.py`, `vajra_backend/crime_heads_118_map.py`, `vajra_backend/ksp_pnlg_engine.py`  
**Auditor:** VAJRA Core Engineering & CCTNS Grounding Unit  

---

## 1. Executive Summary & Root Cause Forensic Audit

A deep forensic inspection across production chat logs and tool invocations revealed that hallucinations in the VAJRA platform originate from **two distinct vectors**:
1. **Deterministic / Heuristic Layer (Backend Tool Code):** Naive substring matching, hardcoded arithmetic formulas posing as cosine similarities, static percentage strings, and template-stamped legal sections.
2. **Generative Layer (QuickML GLM Endpoint):** LLM hallucinating Special & Local Laws (e.g., inventing BNS sections for narcotics instead of the NDPS Act, conflating the IT Act with BNS, and inventing non-existent geographical entities).

```
                      ┌────────────────────────────────────────┐
                      │             OFFICER QUERY              │
                      └───────────────────┬────────────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   ▼                                             ▼
        [ TOOL DISPATCH ENGINE ]                     [ QUICKML GLM SYNTHESIS ]
  (agent_loop.py / crime_heads_118_map)                 (catalyst_llm.py)
                   │                                             │
   ❌ Substring Collision ("oc" in "operations")  ❌ Hallucinated BNS Sections (NDPS -> BNS)
   ❌ Fake Cosine Scores (0.96 - idx * 0.04)     ❌ Conflated IT Act vs BNS (Sec 66C BNS)
   ❌ Hardcoded Section Stamping                  ❌ Fictional Topography ("Yelahaanahalli")
   ❌ Static Hub Percentages                      ❌ Speculative Links (Naxalites -> Meth Labs)
                   │                                             │
                   └──────────────────────┬──────────────────────┘
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    FABRICATED / DISTORTED RESPONSE     │
                      └────────────────────────────────────────┘
```

---

## 2. Hallucination Taxonomy & Observed Failure Modes

### Failure Mode 1: Substring Keyword Collision in Head Classification
* **Location:** [`vajra_backend/crime_heads_118_map.py`](file:///c:/Projects/VAJRA/vajra_backend/crime_heads_118_map.py) & [`vajra_backend/agent_loop.py:6314`](file:///c:/Projects/VAJRA/vajra_backend/agent_loop.py#L6314)
* **The Defect:** Substring check `any(kw in q_l for kw in kws)` matched `"oc"` (Matka Open-Close gambling) inside `"operations"` and `"cocaine"`.
* **Impact:** 108,914 Karnataka Police Act gambling cases were lumped into a narcotics search, inflating volume to 109,284 and bubbling up non-drug FIRs.

### Failure Mode 2: Arithmetic Mocking of Cosine Similarity
* **Location:** [`vajra_backend/agent_loop.py:6396`](file:///c:/Projects/VAJRA/vajra_backend/agent_loop.py#L6396)
* **The Defect:** `relevance_score = max(0.70, round(0.96 - (idx * 0.04), 2))`
* **Impact:** Generates fake "96%", "92%", "88%", "84%" Cosine Semantic Match labels without any vector calculation or semantic verification.

### Failure Mode 3: Blind Statutory Template Stamping
* **Location:** [`vajra_backend/agent_loop.py:6369-6385`](file:///c:/Projects/VAJRA/vajra_backend/agent_loop.py#L6369-L6385)
* **The Defect:** When `primary_head_id` is 12, the backend blindly stamped `Section 20(b)(ii)(C) / 22(c) NDPS Act` onto every retrieved row, regardless of what act was actually charged in that FIR.

### Failure Mode 4: Special & Local Law (SLL) vs. Penal Code Hallucination in GLM
* **Location:** [`vajra_backend/catalyst_llm.py`](file:///c:/Projects/VAJRA/vajra_backend/catalyst_llm.py)
* **The Defect:** The LLM cited `Section 3(10) and Section 22 BNS` for narcotics trafficking (which are General Definitions / Mistake of Fact in BNS, while narcotics is strictly the NDPS Act, 1985), and cited `U/S 66C BNS` (which is actually IT Act 2000).
* **Impact:** Severely undermines judicial and evidentiary credibility for officers preparing dockets.

### Failure Mode 5: Topographical & Speculative Narrative Confabulation
* **Location:** [`vajra_backend/catalyst_llm.py`](file:///c:/Projects/VAJRA/vajra_backend/catalyst_llm.py)
* **The Defect:** Hallucinated geographical entities (e.g. `"Yelahaanahalli"`) and ungrounded criminological linkages (claiming Western Ghats Naxalite groups operate industrial indoor Methamphetamine labs).

---

## 3. Comprehensive Solution Architecture

```
                                  PROPOSED TARGET ARCHITECTURE
                                  
    ┌─────────────────────────────────────────────────────────────────────────────────┐
    │                                OFFICER PROMPT                                   │
    └────────────────────────────────────────┬────────────────────────────────────────┘
                                             │
                                             ▼
    ┌─────────────────────────────────────────────────────────────────────────────────┐
    │ 1. BOUNDARY-AWARE TOKEN CLASSIFIER & QUERY ROUTER                               │
    │    • Word-boundary regex matching (\boc\b, \bndps\b)                            │
    │    • Multi-token BM25 / TF-IDF scoring over 118 CrimeHeads                      │
    │    • SLL Act Intent Classifier (NDPS vs. IT Act vs. POCSO vs. BNS)              │
    └────────────────────────────────────────┬────────────────────────────────────────┘
                                             │
                         ┌───────────────────┴───────────────────┐
                         ▼                                       ▼
    ┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐
    │ 2. REAL VECTOR & EMBEDDING MO ENGINE   │ │ 3. GROUNDED DATABASE JOIN ENGINE       │
    │    • Live sentence embedding vectors   │ │    • Real ActSectionAssociation joins  │
    │    • Exact Cosine Similarity formula   │ │    • Real Station/District resolution  │
    │    • Dynamic cluster aggregations      │ │    • Explicit "Uncharged / Inferred"   │
    │      (No hardcoded percentages)        │ │      provenance flags                  │
    └────────────────────┬───────────────────┘ └───────────────────┬────────────────────┘
                         │                                         │
                         └───────────────────┬─────────────────────┘
                                             │
                                             ▼
    ┌─────────────────────────────────────────────────────────────────────────────────┐
    │ 4. STATUTORY KNOWLEDGE GRAPH & RAG PROMPT INJECTION                             │
    │    • Statutory registry injected into GLM system context                        │
    │    • Strict SLL demarcation rules: NDPS (Drugs), IT Act (Cyber), POCSO (Minors) │
    │    • Explicit negative constraints against BNS conflation                       │
    └────────────────────────────────────────┬────────────────────────────────────────┘
                                             │
                                             ▼
    ┌─────────────────────────────────────────────────────────────────────────────────┐
    │ 5. DETERMINISTIC POST-GENERATION LEGAL LINTER & VERIFIER                        │
    │    • Regex scan: Match all cited sections against canonical legal index         │
    │    • Rule validator: Reject BNS sections > 358, BNSS > 531, BSA > 170           │
    │    • Auto-corrector: Fix known conflations (e.g., 66C BNS -> 66C IT Act)        │
    │    • Hallucination quarantine banner if ungrounded sections detected            │
    └────────────────────────────────────────┬────────────────────────────────────────┘
                                             │
                                             ▼
    ┌─────────────────────────────────────────────────────────────────────────────────┐
    │                VERIFIED, BSA/BNS-COMPLIANT OFFICER INTELLIGENCE                 │
    └─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Engineering Changes & Implementation Steps

### Phase A: Fix Classifier & Router Substring Matching

#### Change A1: Word-Boundary Regex Matching in `crime_heads_118_map.py`
Replace raw substring checks with tokenized regex word boundaries. Short abbreviations (e.g. `oc`, `kp`, `ndps`, `it`) must never match as arbitrary substrings inside other words (`operations`, `dock`, `credit`).

```python
# Before (Vulnerable):
if any(kw in q_l for kw in kws):
    matched_head_ids.append(head_id)

# After (Hardened):
import re

def match_crime_heads(query: str, heads_map: dict) -> list[int]:
    query_clean = query.lower()
    scores = {}
    
    for head_id, kws in heads_map.items():
        score = 0
        for kw in kws:
            # Word boundary regex prevents "oc" matching inside "operations"
            pattern = rf"\b{re.escape(kw.lower())}\b"
            matches = len(re.findall(pattern, query_clean))
            if matches > 0:
                # Give higher weight to multi-word specific phrases
                weight = 3 if " " in kw else (1 if len(kw) <= 3 else 2)
                score += matches * weight
        if score > 0:
            scores[head_id] = score
            
    # Sort heads by descending score
    ranked_heads = [h for h, s in sorted(scores.items(), key=lambda x: x[1], reverse=True)]
    return ranked_heads if ranked_heads else [17]
```

#### Change A2: Disambiguate High-Risk Substring Keywords
Update `ALL_118_CRIME_HEADS_MAP` entries for short keywords:
* Replace `"oc"` with `"matka oc"`, `"open close"`, `"oc matka"`.
* Replace `"kp"` with `"kp act"`, `"kpa"`.
* Replace `"it"` with `"it act"`, `"cyber"`.

---

### Phase B: Eliminate Pseudo-Cosine & Hardcoded Stats

#### Change B1: Compute Real Cosine Similarity on Narrative Vectors
* Replace `relevance_score = max(0.70, round(0.96 - (idx * 0.04), 2))` with actual embedding or TF-IDF cosine similarity against the query narrative.
* If a vector engine is offline or using fallback, label it honestly:
  `"Match Score: 85% (Keyword Density Match — Fallback Mode)"` instead of `"96% (Cosine Semantic Match)"`.

#### Change B2: Dynamic Aggregate Calculation for Concentration Hubs
Replace static strings like `"Bengaluru City (58%), Mysuru City (19%)..."` with real SQL aggregations:
```sql
SELECT DistrictID, COUNT(ROWID) as CaseCount 
FROM CaseMaster 
WHERE CrimeMajorHeadID IN (:head_ids) 
GROUP BY DistrictID 
ORDER BY CaseCount DESC LIMIT 4
```
Format the actual percentages dynamically from database counts.

---

### Phase C: True Database Grounding for Legal Sections

#### Change C1: Join `ActSectionAssociation` Instead of Template Stamping
In `find_similar_cases` and dossier generators:
1. Query `ActSectionAssociation` for the specific `CaseMasterID`.
2. Map `ActID` -> `Act.ActName` and `SectionID` -> `Section.SectionName`.
3. If no sections are formally linked in the DB row, output:
   `"Statutory Sections: [Pending Formal Section Association in CCTNS] — Inferred Primary Head: {CrimeHeadName}"`
   **Never** fabricate sections under the guise of verified FIR data.

---

### Phase D: Prompt Hardening & Statutory RAG Guardrails

#### Change D1: Inject Canonical Statutory Disambiguation Rules in `catalyst_llm.py`
Add explicit legal boundary rules into the system prompt:

```text
CRITICAL STATUTORY GROUNDING RULES (NEVER VIOLATE):
1. SPECIAL & LOCAL LAWS (SLL) DEMARCATION:
   - NARCOTICS & DRUGS: Governed EXCLUSIVELY by the NDPS Act, 1985 (e.g., Sec 8(c), 20, 21, 22, 27A, 29). NEVER cite BNS for drug possession, commercial trafficking, or contraband seizure.
   - CYBERCRIME & IDENTITY THEFT: Governed by the Information Technology Act, 2000 (Sec 43, 66, 66C, 66D) AND BNS Sec 318(4)/319 for General Cheating. NEVER cite "Section 66C BNS" — 66C belongs to the IT Act.
   - CHILD PROTECTION: Governed by POCSO Act, 2012 and JJ Act, 2015.
   - WEAPONS: Governed by Arms Act, 1959.
2. CODE LIMITS:
   - Bharatiya Nyaya Sanhita (BNS) has only 358 Sections. Any citation of BNS > Section 358 is an immediate hallucination error.
   - Bharatiya Nagarik Suraksha Sanhita (BNSS) has only 531 Sections.
   - Bharatiya Sakshya Adhiniyam (BSA) has only 170 Sections.
3. GROUNDING OVER CREATIVITY:
   - Never invent localities or road names (e.g., do not combine syllables to create "Yelahaanahalli").
   - Never fabricate speculative syndicate connections (e.g., do not invent links between Naxalite insurgency and indoor synthetic meth labs unless substantiated by specific case files).
```

---

### Phase E: Deterministic Post-Generation Legal Linter / Interceptor

Implement an automated validation pass in Python that intercepts every LLM-generated string before it reaches the client or officer.

#### Specification for `StatutoryLinter` (`vajra_backend/statutory_linter.py`):
1. **Regex Extraction:** Extract all legal citations matching `r"(?:Section|Sec\.?|U/S)\s*([0-9]+[A-Za-z\(\)]*)\s*(?:of\s+the\s+)?(BNS|BNSS|BSA|IPC|CrPC|NDPS|IT\s*Act|POCSO|Arms\s*Act)"`.
2. **Canonical Range & Act Verification:**
   - If `Act == "BNS"` and `Section > 358`: Flag as invalid citation.
   - If `Section in ["66", "66C", "66D", "43"]` and `Act == "BNS"`: Auto-correct to `Information Technology Act, 2000`.
   - If `Section in ["20", "21", "22", "27A", "8(c)"]` accompanied by drug terms and labeled `BNS`: Auto-correct to `NDPS Act, 1985`.
3. **Audit Tagging:** If any correction or hallucination is caught, log an alert in the governance audit trail.

```python
# vajra_backend/statutory_linter.py sample implementation
import re

LEGAL_BOUNDS = {
    "BNS": 358,
    "BNSS": 531,
    "BSA": 170,
    "IPC": 511,
    "CRPC": 484
}

CONFLATION_RULES = [
    (r"(?:Section|Sec\.?|U/S)\s*66([A-F]?)\s*(?:of\s+the\s+)?BNS", r"Section 66\1 of the Information Technology Act, 2000"),
    (r"(?:Section|Sec\.?|U/S)\s*(?:3\(10\)|22)\s*(?:of\s+the\s+)?BNS(?=.*(?:narcotics|meth|contraband|drug))", r"Section 22 of the NDPS Act, 1985"),
]

def lint_and_correct_legal_text(text: str) -> tuple[str, list[dict]]:
    corrected = text
    warnings = []
    
    # 1. Apply known conflation replacements
    for pattern, replacement in CONFLATION_RULES:
        if re.search(pattern, corrected, flags=re.IGNORECASE):
            corrected = re.sub(pattern, replacement, corrected, flags=re.IGNORECASE)
            warnings.append({"type": "AUTO_CORRECTION", "pattern": pattern, "replacement": replacement})
            
    # 2. Check upper bounds
    for act, max_sec in LEGAL_BOUNDS.items():
        found = re.findall(rf"(?:Section|Sec\.?|U/S)\s*([0-9]+)\s*(?:of\s+the\s+)?{act}\b", corrected, flags=re.IGNORECASE)
        for sec_num in found:
            if int(sec_num) > max_sec:
                warnings.append({"type": "INVALID_SECTION_OUT_OF_BOUNDS", "act": act, "section": sec_num})
                corrected = corrected.replace(f"Section {sec_num} {act}", f"Section {sec_num} [INVALID {act} SECTION - MAX IS {max_sec}]")

    return corrected, warnings
```

---

## 5. Implementation Roadmap & Priority Matrix

| Phase | Task Description | Target File(s) | Impact | Effort | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.1** | Add word-boundary regex & multi-token weighting to 118 CrimeHead matcher | `crime_heads_118_map.py`, `agent_loop.py` | Eliminates false case mixing (e.g. 108k KP Act cases in drug search) | Low | **P0 (Immediate)** |
| **1.2** | Inject SLL vs. BNS demarcation & statutory boundaries into LLM System Prompt | `catalyst_llm.py` | Stops LLM inventing BNS narcotics & cyber sections | Low | **P0 (Immediate)** |
| **1.3** | Remove fake arithmetic similarity formulas (`0.96 - idx * 0.04`) & static stats | `agent_loop.py` | Eliminates fraudulent "Cosine Match" percentages | Low | **P0 (Immediate)** |
| **2.1** | Build and integrate deterministic `StatutoryLinter` post-processor | `statutory_linter.py`, `agent_loop.py` | Auto-corrects hallucinations before sending to UI | Medium | **P1 (High)** |
| **2.2** | Replace template section stamping with live `ActSectionAssociation` joins | `agent_loop.py` | Enforces 100% DB grounded FIR charges | Medium | **P1 (High)** |
| **3.1** | Integrate real sentence-transformer embedding model for semantic search | `vajra_cognitive_brain.py`, `agent_loop.py` | True cosine semantic MO matching | High | **P2 (Strategic)** |

---

## 6. Verification & Evaluation Protocol

To ensure zero regressions and confirm hallucination suppression:
1. **Regression Query 1:** `"DRUG RACKET BENGALURU HEROIN COCAINE SYNDICATE SMUGGLING OPERATIONS"`
   - *Pass Criteria:* Returns only CrimeHead 12 cases; KP Act (Head 24) count is 0; no KP Act brief facts appear; section tags match NDPS Act or actual DB associations.
2. **Regression Query 2:** `"Legal sections for synthetic drug trafficking and online money mules"`
   - *Pass Criteria:* LLM cites NDPS Act, 1985 (Sec 21/22/27A) for drugs and IT Act (Sec 66D) / BNS Sec 318(4) for mules. Zero citations of "Section 3(10) BNS" or "Section 66C BNS".
3. **Boundary Test:** Ask about Section 400 BNS (BNS only has 358 sections).
   - *Pass Criteria:* Model/Linter immediately rejects or clarifies that BNS terminates at Section 358.

---
*Report generated and committed to project root as [`chat-imp.md`](file:///c:/Projects/VAJRA/chat-imp.md).*
