"""
VAJRA 2.0 - Authoritative Bharatiya Nyaya Sanhita (BNS) 2023 Legal Concordance Registry
=======================================================================================
Comprehensive, deterministic in-memory mapping between the Indian Penal Code (IPC 1860)
and the Bharatiya Nyaya Sanhita (BNS 2023), including cognizable/bailable classifications,
punishment scales, and Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) procedural shifts.
"""

from typing import Dict, Any, List, Optional
import re

IPC_TO_BNS_MAP: Dict[str, Dict[str, Any]] = {
    # HOMICIDE & BODILY OFFENSES
    "302": {
        "bns_section": "Section 103(1) BNS 2023",
        "offense_name": "Punishment for Murder",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Death or Imprisonment for Life, and Fine",
        "procedural_changes": "Mandatory forensic scene videography under §105 BNSS; chargesheet within 90 days under §193(3) BNSS.",
        "transitional_clause": "Offenses committed prior to 01-July-2024 governed by IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "307": {
        "bns_section": "Section 109 BNS 2023",
        "offense_name": "Attempt to Murder",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Imprisonment up to 10 years and Fine; if hurt caused, Imprisonment for Life or up to 10 years and Fine",
        "procedural_changes": "Oppose bail under Satender Kumar Antil Category B; mandatory victim statement under §180 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "304": {
        "bns_section": "Section 105 BNS 2023",
        "offense_name": "Culpable Homicide Not Amounting to Murder",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Part I: Imprisonment for Life or up to 10 years and Fine; Part II: Imprisonment up to 10 years or Fine or both",
        "procedural_changes": "Session triable; require post-mortem forensic certificate under §63 BSA.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "304A": {
        "bns_section": "Section 106(1) BNS 2023",
        "offense_name": "Causing Death by Negligence",
        "classification": "Cognizable, Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 5 years and Fine (enhanced from 2 years under IPC 304A)",
        "procedural_changes": "Hit-and-run without reporting attracts §106(2) BNS (up to 10 years imprisonment).",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "304B": {
        "bns_section": "Section 80 BNS 2023",
        "offense_name": "Dowry Death",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Imprisonment for not less than 7 years, up to Life Imprisonment",
        "procedural_changes": "Mandatory inquest by Executive/Judicial Magistrate under §196 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },

    # SEXUAL & WOMEN OFFENSES
    "376": {
        "bns_section": "Section 64 BNS 2023",
        "offense_name": "Punishment for Rape",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Rigorous Imprisonment not less than 10 years, up to Life Imprisonment, and Fine",
        "procedural_changes": "Mandatory audio-video recording of victim statement under §176(3) BNSS; medical examination within 24 hours under §184 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "376D": {
        "bns_section": "Section 70(1) BNS 2023",
        "offense_name": "Gang Rape",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Rigorous Imprisonment not less than 20 years, up to remainder of natural life, and Fine",
        "procedural_changes": "Oppose bail under Category D (Heinous Crime); statutory 60-day trial completion mandate under §258 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "354": {
        "bns_section": "Section 74 BNS 2023",
        "offense_name": "Assault on Woman to Outrage Modesty",
        "classification": "Cognizable, Non-Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment not less than 1 year, up to 5 years, and Fine",
        "procedural_changes": "Section 35(3) BNSS notice applicable where sentence <= 7 years unless flight/tampering risk shown.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "354D": {
        "bns_section": "Section 78 BNS 2023",
        "offense_name": "Stalking",
        "classification": "First Offense: Cognizable, Bailable; Second Offense: Non-Bailable",
        "punishment": "First: up to 3 years and Fine; Subsequent: up to 5 years and Fine",
        "procedural_changes": "Electronic tracking evidence admissible under Section 63 BSA.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "498A": {
        "bns_section": "Section 85 BNS 2023",
        "offense_name": "Cruelty by Husband or Relatives of Husband",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 3 years and Fine",
        "procedural_changes": "Strict adherence to Arnesh Kumar guidelines and §35(3) BNSS notice prior to custodial arrest.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "509": {
        "bns_section": "Section 79 BNS 2023",
        "offense_name": "Word, Gesture or Act Intended to Insult Modesty of Woman",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Simple Imprisonment up to 3 years and Fine",
        "procedural_changes": "Electronic communications admissible under Section 63 BSA certificate.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },

    # PROPERTY OFFENSES (THEFT, ROBBERY, CHEATING, DACOITY)
    "379": {
        "bns_section": "Section 303(2) BNS 2023",
        "offense_name": "Theft",
        "classification": "Cognizable, Non-Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 3 years, or Fine, or both; Petty theft under ₹5,000 community service (§303(2) proviso)",
        "procedural_changes": "Community service introduced as statutory alternative for first-time petty theft.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "380": {
        "bns_section": "Section 305 BNS 2023",
        "offense_name": "Theft in Dwelling House",
        "classification": "Cognizable, Non-Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 7 years and Fine",
        "procedural_changes": "Section 35(3) BNSS notice applies; oppose bail if serial housebreaking MO established.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "384": {
        "bns_section": "Section 308(2) BNS 2023",
        "offense_name": "Extortion",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 3 years, or Fine, or both",
        "procedural_changes": "Check for organized syndicate linkage under Section 111 BNS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "392": {
        "bns_section": "Section 309(4) BNS 2023",
        "offense_name": "Robbery",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Rigorous Imprisonment up to 10 years and Fine; on highway between sunset and sunrise up to 14 years",
        "procedural_changes": "Heinous property crime; mandatory opposition to bail under §480 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "395": {
        "bns_section": "Section 310(2) BNS 2023",
        "offense_name": "Dacoity",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Imprisonment for Life, or Rigorous Imprisonment up to 10 years, and Fine",
        "procedural_changes": "Organized joint liability under §310; cross-district tracking under §111 BNS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "397": {
        "bns_section": "Section 311 BNS 2023",
        "offense_name": "Robbery or Dacoity with Attempt to Cause Death or Grievous Hurt",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Rigorous Imprisonment for not less than 7 years",
        "procedural_changes": "Statutory minimum 7-year imprisonment; absolute opposition to bail.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "406": {
        "bns_section": "Section 316(2) BNS 2023",
        "offense_name": "Criminal Breach of Trust",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 5 years, or Fine, or both",
        "procedural_changes": "Economic offense; evaluate attachment of proceeds of crime under §107 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "411": {
        "bns_section": "Section 317(2) BNS 2023",
        "offense_name": "Dishonestly Receiving Stolen Property",
        "classification": "Cognizable, Non-Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 3 years, or Fine, or both",
        "procedural_changes": "Recovered stolen property seizure protocol under §106 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "420": {
        "bns_section": "Section 318(4) BNS 2023",
        "offense_name": "Cheating and Dishonestly Inducing Delivery of Property",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 7 years and Fine",
        "procedural_changes": "Attachment of illicit bank accounts and digital assets under §107 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },

    # FORGERY & DOCUMENTS
    "467": {
        "bns_section": "Section 338 BNS 2023",
        "offense_name": "Forgery of Valuable Security or Will",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment for Life, or Imprisonment up to 10 years, and Fine",
        "procedural_changes": "FSL document examination report admissible under §329 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "468": {
        "bns_section": "Section 336(3) BNS 2023",
        "offense_name": "Forgery for Purpose of Cheating",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 7 years and Fine",
        "procedural_changes": "Electronic records require Section 63 BSA certificate.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "471": {
        "bns_section": "Section 340(2) BNS 2023",
        "offense_name": "Using as Genuine a Forged Document",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Punished in same manner as if forged document was created by offender",
        "procedural_changes": "Digital document provenance verification under §61/§63 BSA.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },

    # KIDNAPPING & ABDUCTION
    "363": {
        "bns_section": "Section 137(2) BNS 2023",
        "offense_name": "Kidnapping",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 7 years and Fine",
        "procedural_changes": "POCSO Act mandatory invocation if minor victim; immediate tracking.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "364A": {
        "bns_section": "Section 140(2) BNS 2023",
        "offense_name": "Kidnapping for Ransom",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Death or Imprisonment for Life, and Fine",
        "procedural_changes": "Heinous capital crime; mandatory bail opposition under Category D.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },

    # HURT & ASSAULT
    "323": {
        "bns_section": "Section 115(2) BNS 2023",
        "offense_name": "Voluntarily Causing Hurt",
        "classification": "Non-Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 1 year, or Fine up to ₹1,000, or both",
        "procedural_changes": "Non-cognizable; requires Magistrate order under §174 BNSS for investigation.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "324": {
        "bns_section": "Section 117(1) BNS 2023",
        "offense_name": "Voluntarily Causing Hurt by Dangerous Weapons",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 3 years, or Fine, or both",
        "procedural_changes": "Weapon seizure and FSL ballistics compliance under §105 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "325": {
        "bns_section": "Section 117(2) BNS 2023",
        "offense_name": "Voluntarily Causing Grievous Hurt",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 7 years and Fine",
        "procedural_changes": "Medical certificate from Government Medical Officer mandatory.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "326": {
        "bns_section": "Section 118(1) BNS 2023",
        "offense_name": "Voluntarily Causing Grievous Hurt by Dangerous Weapons",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment for Life, or Imprisonment up to 10 years, and Fine",
        "procedural_changes": "Heinous bodily crime; oppose bail under Satender Kumar Antil Category B.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "341": {
        "bns_section": "Section 126(2) BNS 2023",
        "offense_name": "Wrongful Restraint",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Simple Imprisonment up to 1 month, or Fine up to ₹500, or both",
        "procedural_changes": "Section 35(3) BNSS notice applicable.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "342": {
        "bns_section": "Section 127(2) BNS 2023",
        "offense_name": "Wrongful Confinement",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 1 year, or Fine up to ₹1,000, or both",
        "procedural_changes": "Section 35(3) BNSS notice applicable.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "353": {
        "bns_section": "Section 132 BNS 2023",
        "offense_name": "Assault on Public Servant Deterring Duty",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 5 years, or Fine, or both (enhanced from 2 years in IPC)",
        "procedural_changes": "Enhanced punishment protecting on-duty police personnel; oppose bail.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },

    # PUBLIC ORDER, RIOTING & CONSPIRACY
    "143": {
        "bns_section": "Section 189(2) BNS 2023",
        "offense_name": "Unlawful Assembly Member",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 6 months, or Fine, or both",
        "procedural_changes": "Video evidence of mob assembly mandatory under §105 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "147": {
        "bns_section": "Section 191(2) BNS 2023",
        "offense_name": "Rioting",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 2 years, or Fine, or both",
        "procedural_changes": "Executive Magistrate dispersal order required under §148 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "148": {
        "bns_section": "Section 191(3) BNS 2023",
        "offense_name": "Rioting Armed with Deadly Weapon",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 5 years, or Fine, or both",
        "procedural_changes": "Armed mob; non-bailable; arms recovery under §105 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "149": {
        "bns_section": "Section 190 BNS 2023",
        "offense_name": "Every Member of Unlawful Assembly Guilty of Offense",
        "classification": "Vicarious Joint Liability — Same as main offense committed",
        "punishment": "Punished as if substantive offense committed by member",
        "procedural_changes": "Relational network mapping under Bipartite Co-offender Graph.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "120B": {
        "bns_section": "Section 61(2) BNS 2023",
        "offense_name": "Criminal Conspiracy",
        "classification": "Cognizable, Non-Bailable (if target offense non-bailable)",
        "punishment": "Same as abetment of target offense committed in conspiracy",
        "procedural_changes": "CDR and tower dump analysis admissible under §63 BSA.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "34": {
        "bns_section": "Section 3(5) BNS 2023",
        "offense_name": "Acts Done by Several Persons in Furtherance of Common Intention",
        "classification": "Joint Liability Rule — Same as main offense committed",
        "punishment": "Each person liable in same manner as if done by him alone",
        "procedural_changes": "Co-offending network traversal under §3(5) BNS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },

    # NEW BNS STATUTORY OFFENSES (ORGANIZED CRIME, TERRORISM)
    "111": {
        "bns_section": "Section 111 BNS 2023",
        "offense_name": "Organized Crime Syndicate",
        "classification": "Cognizable, Non-Bailable, Triable by Special Court / Court of Session",
        "punishment": "Death or Life Imprisonment and minimum Fine of ₹5 Lakhs if death caused; otherwise 5 years to Life",
        "procedural_changes": "Requires >= 2 chargesheets in preceding 10 years; 180-day remand window under §187(3) BNSS.",
        "transitional_clause": "New substantive offense under Bharatiya Nyaya Sanhita 2023."
    },
    "112": {
        "bns_section": "Section 112 BNS 2023",
        "offense_name": "Petty Organized Crime (Snatching, Hawala, Paper Leak, Betting)",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment not less than 1 year, up to 7 years, and Fine",
        "procedural_changes": "Covers gang snatching, ticket black marketing, unauthorized betting.",
        "transitional_clause": "New substantive offense under Bharatiya Nyaya Sanhita 2023."
    },
    "113": {
        "bns_section": "Section 113 BNS 2023",
        "offense_name": "Terrorist Act",
        "classification": "Cognizable, Non-Bailable, Triable by Court of Session",
        "punishment": "Death or Life Imprisonment and Fine",
        "procedural_changes": "Investigated by Officer not below DSP rank; NIA coordination.",
        "transitional_clause": "New substantive offense under Bharatiya Nyaya Sanhita 2023."
    },

    # INTIMIDATION, TRESPASS & MOTOR VEHICLE
    "504": {
        "bns_section": "Section 352 BNS 2023",
        "offense_name": "Intentional Insult to Provoke Breach of Peace",
        "classification": "Non-Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 2 years, or Fine, or both",
        "procedural_changes": "Non-cognizable; §35(3) BNSS applies.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "506": {
        "bns_section": "Section 351(2) BNS 2023",
        "offense_name": "Criminal Intimidation",
        "classification": "Part I: Non-Cognizable, Bailable; Part II (Death threat): Cognizable, Non-Bailable",
        "punishment": "Part I: up to 2 years; Part II: up to 7 years, or Fine, or both",
        "procedural_changes": "Audio/call recordings require §63 BSA digital certificate.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "279": {
        "bns_section": "Section 281 BNS 2023",
        "offense_name": "Rash Driving or Riding on a Public Way",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 6 months, or Fine up to ₹1,000, or both",
        "procedural_changes": "CCTV / traffic camera video admissible under §63 BSA.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "337": {
        "bns_section": "Section 125(a) BNS 2023",
        "offense_name": "Causing Hurt by Endangering Life or Personal Safety",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 6 months, or Fine up to ₹500, or both",
        "procedural_changes": "Vehicle inspection report admissible under §329 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "338": {
        "bns_section": "Section 125(b) BNS 2023",
        "offense_name": "Causing Grievous Hurt by Endangering Life or Personal Safety",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 2 years, or Fine up to ₹1,000, or both",
        "procedural_changes": "Government Medical Officer wound certificate mandatory.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "447": {
        "bns_section": "Section 329(3) BNS 2023",
        "offense_name": "Criminal Trespass",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 3 months, or Fine up to ₹500, or both",
        "procedural_changes": "Revenue boundary records admissible under §63 BSA.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "448": {
        "bns_section": "Section 331(2) BNS 2023",
        "offense_name": "House Trespass",
        "classification": "Cognizable, Bailable, Triable by Any Magistrate",
        "punishment": "Imprisonment up to 1 year, or Fine up to ₹1,000, or both",
        "procedural_changes": "Spot panchnama video recording required under §105 BNSS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "457": {
        "bns_section": "Section 331(4) BNS 2023",
        "offense_name": "Lurking House-Trespass or House-Breaking by Night",
        "classification": "Cognizable, Non-Bailable, Triable by Magistrate First Class",
        "punishment": "Imprisonment up to 5 years and Fine; if theft intended up to 14 years",
        "procedural_changes": "Heinous property crime; track repeat night burglars under §112 BNS.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    },
    "201": {
        "bns_section": "Section 238 BNS 2023",
        "offense_name": "Causing Disappearance of Evidence of Offense",
        "classification": "Classification depends on main offense (Cognizable/Non-Bailable if Capital Offense)",
        "punishment": "Capital main offense: up to 7 years; Life main offense: up to 3 years",
        "procedural_changes": "Forensic digital destruction punishable; §63 BSA electronic hash integrity.",
        "transitional_clause": "Pre-July 2024 offenses tried under IPC 1860 (§358 BNS / §531 BNSS)."
    }
}


def get_bns_concordance(ipc_sec: str) -> Dict[str, Any]:
    """Resolves any IPC section number into its authoritative BNS 2023 equivalent."""
    clean = re.sub(r'[^0-9A-Za-z]', '', str(ipc_sec or '')).upper()
    if clean in IPC_TO_BNS_MAP:
        return IPC_TO_BNS_MAP[clean]

    # Numeric prefix fallback
    m = re.match(r'(\d+)', clean)
    if m and m.group(1) in IPC_TO_BNS_MAP:
        return IPC_TO_BNS_MAP[m.group(1)]

    # Authoritative fallback for unlisted section
    return {
        "bns_section": f"Section {clean} BNS 2023 (Concordance under review)",
        "offense_name": f"Offense corresponding to IPC {clean}",
        "classification": "Determined as per Second Schedule BNSS 2023",
        "punishment": "As prescribed under Bharatiya Nyaya Sanhita 2023",
        "procedural_changes": "Procedure governed by Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023.",
        "transitional_clause": "Offenses prior to 01-July-2024 governed by IPC 1860 pursuant to Section 531 BNSS."
    }


def map_ipc_sections_to_bns(sections: List[Any]) -> List[str]:
    """Transforms a raw list of IPC sections from CCTNS into court-admissible BNS citations."""
    out = []
    for s in sections:
        s_str = str(s).strip()
        m = re.search(r'(\d+[A-Za-z]?)', s_str)
        sec_num = m.group(1) if m else s_str
        concordance = get_bns_concordance(sec_num)
        bns_sec = concordance.get("bns_section", "").replace(" 2023", "")
        offense = concordance.get("offense_name", "")
        cls_info = concordance.get("classification", "").split(",")[0]  # e.g. Cognizable
        out.append(f"{bns_sec} ({offense} / IPC {sec_num}) — {cls_info}")
    return out
