"""Cameroon geographic reference data — regions, cities (communes), quartiers.

Covers all 10 regions with major cities and their neighbourhoods, focusing on
areas with high population density and internet connectivity so that users can
find their address at launch time.

Data is organised as plain dicts so it can be served directly by the
/geo/* endpoints or loaded into a database via a seed script.
"""

from __future__ import annotations


# ── Types (mirrors Pydantic schemas) ──────────────────────────────────────

GeoRegion = dict[str, str]       # {"code": ..., "name": ...}
GeoCity = dict[str, str]         # {"code": ..., "name": ..., "region_code": ...}
GeoQuartier = dict[str, str]     # {"code": ..., "name": ..., "city_code": ..., "commune_name": ...}

# ── Regions ────────────────────────────────────────────────────────────────

REGIONS: list[GeoRegion] = [
    {"code": "CE", "name": "Centre"},
    {"code": "LT", "name": "Littoral"},
    {"code": "OU", "name": "Ouest"},
    {"code": "SU", "name": "Sud"},
    {"code": "NO", "name": "Nord"},
    {"code": "EN", "name": "Extrême-Nord"},
    {"code": "AD", "name": "Adamaoua"},
    {"code": "ES", "name": "Est"},
    {"code": "NW", "name": "Nord-Ouest"},
    {"code": "SW", "name": "Sud-Ouest"},
]

# ── Cities ─────────────────────────────────────────────────────────────────

CITIES: list[GeoCity] = [
    # ── Centre (CE) ──────────────────────────────────────────────────────
    {"code": "YDE", "name": "Yaoundé",           "region_code": "CE"},
    {"code": "MBA", "name": "Mbalmayo",          "region_code": "CE"},
    {"code": "OBA", "name": "Obala",             "region_code": "CE"},
    {"code": "AKL", "name": "Akonolinga",        "region_code": "CE"},
    {"code": "EKA", "name": "Eséka",             "region_code": "CE"},
    {"code": "NGE", "name": "Nanga-Eboko",       "region_code": "CE"},
    {"code": "BFA", "name": "Bafia",             "region_code": "CE"},
    {"code": "MON", "name": "Monatele",          "region_code": "CE"},
    {"code": "SAA", "name": "Saa",               "region_code": "CE"},
    # ── Littoral (LT) ────────────────────────────────────────────────────
    {"code": "DLA", "name": "Douala",            "region_code": "LT"},
    {"code": "EDA", "name": "Edéa",              "region_code": "LT"},
    {"code": "NKG", "name": "Nkongsamba",        "region_code": "LT"},
    {"code": "LOM", "name": "Loum",              "region_code": "LT"},
    {"code": "MBG", "name": "Mbanga",            "region_code": "LT"},
    {"code": "MLG", "name": "Melong",            "region_code": "LT"},
    {"code": "PNJ", "name": "Penja",             "region_code": "LT"},
    {"code": "DBB", "name": "Dibombari",         "region_code": "LT"},
    # ── Ouest (OU) ──────────────────────────────────────────────────────
    {"code": "BFM", "name": "Bafoussam",         "region_code": "OU"},
    {"code": "DSG", "name": "Dschang",           "region_code": "OU"},
    {"code": "MDA", "name": "Mbouda",            "region_code": "OU"},
    {"code": "FBN", "name": "Foumban",           "region_code": "OU"},
    {"code": "BFG", "name": "Bafang",            "region_code": "OU"},
    {"code": "BGT", "name": "Bangangté",         "region_code": "OU"},
    {"code": "TBA", "name": "Tonga",             "region_code": "OU"},
    {"code": "BAJ", "name": "Bazou",             "region_code": "OU"},
    {"code": "NDJ", "name": "Bandjoun",          "region_code": "OU"},
    # ── Sud (SU) ─────────────────────────────────────────────────────────
    {"code": "EBW", "name": "Ebolowa",           "region_code": "SU"},
    {"code": "SGA", "name": "Sangmélima",        "region_code": "SU"},
    {"code": "KRI", "name": "Kribi",             "region_code": "SU"},
    {"code": "AMB", "name": "Ambam",             "region_code": "SU"},
    {"code": "MVK", "name": "Mvangan",           "region_code": "SU"},
    # ── Nord (NO) ────────────────────────────────────────────────────────
    {"code": "GRA", "name": "Garoua",            "region_code": "NO"},
    {"code": "PTA", "name": "Pitoa",             "region_code": "NO"},
    {"code": "GUI", "name": "Guider",            "region_code": "NO"},
    {"code": "RYS", "name": "Rey-Bouba",         "region_code": "NO"},
    {"code": "LAG", "name": "Lagdo",             "region_code": "NO"},
    # ── Extrême-Nord (EN) ────────────────────────────────────────────────
    {"code": "MRA", "name": "Maroua",            "region_code": "EN"},
    {"code": "KSL", "name": "Kousséri",          "region_code": "EN"},
    {"code": "MKO", "name": "Mokolo",            "region_code": "EN"},
    {"code": "YGO", "name": "Yagoua",            "region_code": "EN"},
    {"code": "KAZ", "name": "Kaélé",             "region_code": "EN"},
    {"code": "MOK", "name": "Mora",              "region_code": "EN"},
    {"code": "WZD", "name": "Waza",              "region_code": "EN"},
    # ── Adamaoua (AD) ────────────────────────────────────────────────────
    {"code": "NGD", "name": "Ngaoundéré",        "region_code": "AD"},
    {"code": "TBT", "name": "Tibati",            "region_code": "AD"},
    {"code": "TGN", "name": "Tignère",           "region_code": "AD"},
    {"code": "BYO", "name": "Banyo",             "region_code": "AD"},
    {"code": "MEI", "name": "Meiganga",          "region_code": "AD"},
    {"code": "DJO", "name": "Djohong",           "region_code": "AD"},
    # ── Est (ES) ─────────────────────────────────────────────────────────
    {"code": "BTA", "name": "Bertoua",           "region_code": "ES"},
    {"code": "BTR", "name": "Batouri",           "region_code": "ES"},
    {"code": "YKM", "name": "Yokadouma",         "region_code": "ES"},
    {"code": "ABG", "name": "Abong-Mbang",       "region_code": "ES"},
    {"code": "DMN", "name": "Dimako",            "region_code": "ES"},
    {"code": "LDM", "name": "Lomié",             "region_code": "ES"},
    # ── Nord-Ouest (NW) ──────────────────────────────────────────────────
    {"code": "BDA", "name": "Bamenda",           "region_code": "NW"},
    {"code": "KBA", "name": "Kumbo",             "region_code": "NW"},
    {"code": "NDP", "name": "Ndop",              "region_code": "NW"},
    {"code": "NKW", "name": "Nkambé",            "region_code": "NW"},
    {"code": "WUM", "name": "Wum",               "region_code": "NW"},
    {"code": "MCM", "name": "Mamfé",             "region_code": "NW"},
    # ── Sud-Ouest (SW) ──────────────────────────────────────────────────
    {"code": "BUE", "name": "Buéa",              "region_code": "SW"},
    {"code": "LBE", "name": "Limbé",             "region_code": "SW"},
    {"code": "KUM", "name": "Kumba",             "region_code": "SW"},
    {"code": "TND", "name": "Tiko",              "region_code": "SW"},
    {"code": "MUT", "name": "Mutengene",         "region_code": "SW"},
    {"code": "IDN", "name": "Idenau",            "region_code": "SW"},
]

# ── Quartiers ─────────────────────────────────────────────────────────────

QUARTIERS: list[GeoQuartier] = [
    # ══════════════════════════════════════════════════════════════════════
    # YAOUNDÉ  (YDE) — 7 communes, 40+ quartiers
    # ══════════════════════════════════════════════════════════════════════
    # Yaoundé 1er
    {"code": "BAS", "name": "Bastos",        "city_code": "YDE", "commune_name": "Yaoundé 1er"},
    {"code": "NLG", "name": "Nlongkak",      "city_code": "YDE", "commune_name": "Yaoundé 1er"},
    {"code": "TSG", "name": "Tsinga",        "city_code": "YDE", "commune_name": "Yaoundé 1er"},
    {"code": "EMK", "name": "Etoa-Meki",     "city_code": "YDE", "commune_name": "Yaoundé 1er"},
    {"code": "MFD", "name": "Mfandena",      "city_code": "YDE", "commune_name": "Yaoundé 1er"},
    {"code": "ELG", "name": "Elig-Essono",   "city_code": "YDE", "commune_name": "Yaoundé 1er"},
    {"code": "NLM", "name": "Nkolmesseng",   "city_code": "YDE", "commune_name": "Yaoundé 1er"},
    # Yaoundé 2e
    {"code": "MVG", "name": "Mvog-Mbi",      "city_code": "YDE", "commune_name": "Yaoundé 2e"},
    {"code": "MKL", "name": "Mokolo",        "city_code": "YDE", "commune_name": "Yaoundé 2e"},
    {"code": "CIT", "name": "Cité Verte",    "city_code": "YDE", "commune_name": "Yaoundé 2e"},
    {"code": "BRI", "name": "Briqueterie",   "city_code": "YDE", "commune_name": "Yaoundé 2e"},
    {"code": "MVA", "name": "Mvog-Ada",      "city_code": "YDE", "commune_name": "Yaoundé 2e"},
    {"code": "MVB", "name": "Mvog-Betsi",    "city_code": "YDE", "commune_name": "Yaoundé 2e"},
    # Yaoundé 3e
    {"code": "NSM", "name": "Nsam",          "city_code": "YDE", "commune_name": "Yaoundé 3e"},
    {"code": "OMS", "name": "Omnisports",    "city_code": "YDE", "commune_name": "Yaoundé 3e"},
    {"code": "EFO", "name": "Efoulan",       "city_code": "YDE", "commune_name": "Yaoundé 3e"},
    {"code": "NKD", "name": "Nkolo",         "city_code": "YDE", "commune_name": "Yaoundé 3e"},
    {"code": "LNG", "name": "Longkak",       "city_code": "YDE", "commune_name": "Yaoundé 3e"},
    # Yaoundé 4e
    {"code": "MBO", "name": "Mimboman",      "city_code": "YDE", "commune_name": "Yaoundé 4e"},
    {"code": "KON", "name": "Kondengui",     "city_code": "YDE", "commune_name": "Yaoundé 4e"},
    {"code": "EKE", "name": "Ekounou",       "city_code": "YDE", "commune_name": "Yaoundé 4e"},
    {"code": "ODA", "name": "Odza",          "city_code": "YDE", "commune_name": "Yaoundé 4e"},
    {"code": "NKI", "name": "Nkosi",         "city_code": "YDE", "commune_name": "Yaoundé 4e"},
    # Yaoundé 5e
    {"code": "NGO", "name": "Ngousso",       "city_code": "YDE", "commune_name": "Yaoundé 5e"},
    {"code": "ESS", "name": "Essos",         "city_code": "YDE", "commune_name": "Yaoundé 5e"},
    {"code": "NGB", "name": "Ngoulmekong",   "city_code": "YDE", "commune_name": "Yaoundé 5e"},
    {"code": "NTN", "name": "Ntanfoang",     "city_code": "YDE", "commune_name": "Yaoundé 5e"},
    # Yaoundé 6e
    {"code": "MEL", "name": "Melen",         "city_code": "YDE", "commune_name": "Yaoundé 6e"},
    {"code": "BYA", "name": "Biyem-Assi",    "city_code": "YDE", "commune_name": "Yaoundé 6e"},
    {"code": "MDS", "name": "Mendong",       "city_code": "YDE", "commune_name": "Yaoundé 6e"},
    {"code": "ETO", "name": "Etoug-Ebe",     "city_code": "YDE", "commune_name": "Yaoundé 6e"},
    {"code": "BLS", "name": "Bastos-Olympia", "city_code": "YDE", "commune_name": "Yaoundé 6e"},
    {"code": "TMD", "name": "Tamdja",        "city_code": "YDE", "commune_name": "Yaoundé 6e"},
    # Yaoundé 7e
    {"code": "NKB", "name": "Nkolbisson",    "city_code": "YDE", "commune_name": "Yaoundé 7e"},
    {"code": "OYO", "name": "Oyom-Abang",    "city_code": "YDE", "commune_name": "Yaoundé 7e"},
    {"code": "NKY", "name": "Nkondi",        "city_code": "YDE", "commune_name": "Yaoundé 7e"},
    {"code": "SOA", "name": "Soa",           "city_code": "YDE", "commune_name": "Yaoundé 7e"},

    # ══════════════════════════════════════════════════════════════════════
    # DOUALA  (DLA) — 6 communes, 35+ quartiers
    # ══════════════════════════════════════════════════════════════════════
    # Douala 1er
    {"code": "AKW", "name": "Akwa",          "city_code": "DLA", "commune_name": "Douala 1er"},
    {"code": "DEI", "name": "Deido",         "city_code": "DLA", "commune_name": "Douala 1er"},
    {"code": "BPR", "name": "Bonapriso",     "city_code": "DLA", "commune_name": "Douala 1er"},
    {"code": "BON", "name": "Bonanjo",       "city_code": "DLA", "commune_name": "Douala 1er"},
    {"code": "BAL", "name": "Bali",          "city_code": "DLA", "commune_name": "Douala 1er"},
    {"code": "BSG", "name": "Bessengue",     "city_code": "DLA", "commune_name": "Douala 1er"},
    # Douala 2e
    {"code": "NBL", "name": "New Bell",      "city_code": "DLA", "commune_name": "Douala 2e"},
    {"code": "VLG", "name": "Village",       "city_code": "DLA", "commune_name": "Douala 2e"},
    {"code": "NGG", "name": "Nkongmondo",    "city_code": "DLA", "commune_name": "Douala 2e"},
    {"code": "BEA", "name": "Beedi",         "city_code": "DLA", "commune_name": "Douala 2e"},
    # Douala 3e
    {"code": "NDK", "name": "Ndokoti",       "city_code": "DLA", "commune_name": "Douala 3e"},
    {"code": "KOT", "name": "Kotto",         "city_code": "DLA", "commune_name": "Douala 3e"},
    {"code": "LOG", "name": "Logpom",        "city_code": "DLA", "commune_name": "Douala 3e"},
    {"code": "YAS", "name": "Yassa",         "city_code": "DLA", "commune_name": "Douala 3e"},
    {"code": "PKL", "name": "Pk17",          "city_code": "DLA", "commune_name": "Douala 3e"},
    {"code": "LBA", "name": "Logbaba",       "city_code": "DLA", "commune_name": "Douala 3e"},
    # Douala 4e
    {"code": "BNB", "name": "Bonabéri",      "city_code": "DLA", "commune_name": "Douala 4e"},
    {"code": "BNS", "name": "Bonassama",     "city_code": "DLA", "commune_name": "Douala 4e"},
    {"code": "NDD", "name": "Ndobo",         "city_code": "DLA", "commune_name": "Douala 4e"},
    {"code": "BDL", "name": "Bodé",          "city_code": "DLA", "commune_name": "Douala 4e"},
    {"code": "BDE", "name": "Bonendale",     "city_code": "DLA", "commune_name": "Douala 4e"},
    # Douala 5e
    {"code": "BMS", "name": "Bonamoussadi",  "city_code": "DLA", "commune_name": "Douala 5e"},
    {"code": "MKP", "name": "Makepe",        "city_code": "DLA", "commune_name": "Douala 5e"},
    {"code": "BPD", "name": "Bépanda",       "city_code": "DLA", "commune_name": "Douala 5e"},
    {"code": "LGB", "name": "Logbessou",     "city_code": "DLA", "commune_name": "Douala 5e"},
    {"code": "KMS", "name": "Kotto-Bass",    "city_code": "DLA", "commune_name": "Douala 5e"},
    {"code": "NDD2", "name": "Ndokbanga",    "city_code": "DLA", "commune_name": "Douala 5e"},
    # Douala 6e
    {"code": "MBN", "name": "Manoka",        "city_code": "DLA", "commune_name": "Douala 6e"},
    {"code": "JPM", "name": "Japoma",        "city_code": "DLA", "commune_name": "Douala 6e"},
    {"code": "NSM2", "name": "Nsimi",        "city_code": "DLA", "commune_name": "Douala 6e"},

    # ══════════════════════════════════════════════════════════════════════
    # BAFOUSSAM  (BFM) — 3 communes
    # ══════════════════════════════════════════════════════════════════════
    {"code": "TGI", "name": "Tamdja",         "city_code": "BFM", "commune_name": "Bafoussam 1er"},
    {"code": "DJE", "name": "Djemoun",        "city_code": "BFM", "commune_name": "Bafoussam 1er"},
    {"code": "KPT", "name": "Kaptement",      "city_code": "BFM", "commune_name": "Bafoussam 1er"},
    {"code": "KAM", "name": "Kamkop",         "city_code": "BFM", "commune_name": "Bafoussam 2e"},
    {"code": "BAM", "name": "Bamougoum",      "city_code": "BFM", "commune_name": "Bafoussam 2e"},
    {"code": "SAP", "name": "Sapeta",         "city_code": "BFM", "commune_name": "Bafoussam 2e"},
    {"code": "TOU", "name": "Tougang",        "city_code": "BFM", "commune_name": "Bafoussam 3e"},
    {"code": "NDZ", "name": "Ndiangdam",      "city_code": "BFM", "commune_name": "Bafoussam 3e"},
    {"code": "RYT", "name": "Ryient",         "city_code": "BFM", "commune_name": "Bafoussam 3e"},

    # ══════════════════════════════════════════════════════════════════════
    # DSCHANG  (DSG) — 12 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "CVR", "name": "Centre-ville",    "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "MKT", "name": "Marché Central",  "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "FCK", "name": "Foto",            "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "FML", "name": "Fondanti",        "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "MBO2", "name": "Mbouo",           "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "BAF2", "name": "Bafou",           "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "UDS", "name": "Campus Universitaire", "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "HOP", "name": "Hôpital",         "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "CLM", "name": "Climate Centre",   "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "JBD", "name": "Jardin Botanique", "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "FGT", "name": "Fongo-Tongo",      "city_code": "DSG", "commune_name": "Dschang"},
    {"code": "FRK", "name": "Foréké",          "city_code": "DSG", "commune_name": "Dschang"},

    # ══════════════════════════════════════════════════════════════════════
    # MBOUDA  (MDA) — 8 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "MDAC", "name": "Centre-ville",    "city_code": "MDA", "commune_name": "Mbouda"},
    {"code": "MDAM", "name": "Marché Central",  "city_code": "MDA", "commune_name": "Mbouda"},
    {"code": "BMS2", "name": "Bamessingué",    "city_code": "MDA", "commune_name": "Mbouda"},
    {"code": "BLT", "name": "Balatchi",        "city_code": "MDA", "commune_name": "Mbouda"},
    {"code": "MDAN", "name": "Ndé",            "city_code": "MDA", "commune_name": "Mbouda"},
    {"code": "MDAB", "name": "Bangang",        "city_code": "MDA", "commune_name": "Mbouda"},
    {"code": "WDL", "name": "Wandala",         "city_code": "MDA", "commune_name": "Mbouda"},
    {"code": "PLT2", "name": "Plateau",         "city_code": "MDA", "commune_name": "Mbouda"},

    # ══════════════════════════════════════════════════════════════════════
    # FOUMBAN  (FBN) — 15 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "FBC", "name": "Centre-ville",    "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "NJI", "name": "Njinka",          "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "SUL", "name": "Sultanat",        "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "KNG", "name": "Kounga",          "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "MRE", "name": "Maram",            "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "PNZ", "name": "Panzo",           "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "QGB", "name": "Quartier Gabon",   "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "MSC", "name": "Montagne Sacrée",  "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "NJY", "name": "Njiyouom",        "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "NJD2", "name": "Njindaré",        "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "NJB", "name": "Njimbam",         "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "NJL", "name": "Njiloum",         "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "NJS", "name": "Njissé",          "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "MNK2", "name": "Manka",           "city_code": "FBN", "commune_name": "Foumban"},
    {"code": "MMB", "name": "Mambain",         "city_code": "FBN", "commune_name": "Foumban"},

    # ══════════════════════════════════════════════════════════════════════
    # BAFANG  (BFG) — 8 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "BFGC", "name": "Centre-ville",    "city_code": "BFG", "commune_name": "Bafang"},
    {"code": "BBN", "name": "Baboutcheu-Ngaleu", "city_code": "BFG", "commune_name": "Bafang"},
    {"code": "BKJ", "name": "Bankondji",       "city_code": "BFG", "commune_name": "Bafang"},
    {"code": "BSP", "name": "Bassap",          "city_code": "BFG", "commune_name": "Bafang"},
    {"code": "BNC", "name": "Baboutcha-Nitcheu", "city_code": "BFG", "commune_name": "Bafang"},
    {"code": "BDM", "name": "Bandoumka",       "city_code": "BFG", "commune_name": "Bafang"},
    {"code": "BBN2", "name": "Baboné",          "city_code": "BFG", "commune_name": "Bafang"},
    {"code": "BFL", "name": "Banfelouk",       "city_code": "BFG", "commune_name": "Bafang"},

    # ══════════════════════════════════════════════════════════════════════
    # BANGANGTÉ  (BGT) — 6 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "BGTC", "name": "Centre-ville",    "city_code": "BGT", "commune_name": "Bangangté"},
    {"code": "BFU", "name": "Bafeumbath",      "city_code": "BGT", "commune_name": "Bangangté"},
    {"code": "BNK", "name": "Banekane",        "city_code": "BGT", "commune_name": "Bangangté"},
    {"code": "BTL", "name": "Batela",          "city_code": "BGT", "commune_name": "Bangangté"},
    {"code": "BFK", "name": "Bangang-Fokam",   "city_code": "BGT", "commune_name": "Bangangté"},
    {"code": "BGTN", "name": "Ndi",            "city_code": "BGT", "commune_name": "Bangangté"},

    # ══════════════════════════════════════════════════════════════════════
    # BAMENDA  (BDA) — 3 communes
    # ══════════════════════════════════════════════════════════════════════
    {"code": "MNK", "name": "Mankon",         "city_code": "BDA", "commune_name": "Bamenda 1er"},
    {"code": "UPT", "name": "Up Station",     "city_code": "BDA", "commune_name": "Bamenda 1er"},
    {"code": "NTA", "name": "Ntarikon",        "city_code": "BDA", "commune_name": "Bamenda 1er"},
    {"code": "NKN", "name": "Nkwen",          "city_code": "BDA", "commune_name": "Bamenda 2e"},
    {"code": "OLD", "name": "Old Town",       "city_code": "BDA", "commune_name": "Bamenda 2e"},
    {"code": "ML3", "name": "Mile 3 Nkwen",   "city_code": "BDA", "commune_name": "Bamenda 2e"},
    {"code": "NTB", "name": "Ntarinkon",      "city_code": "BDA", "commune_name": "Bamenda 3e"},
    {"code": "ML4", "name": "Mile 4",         "city_code": "BDA", "commune_name": "Bamenda 3e"},
    {"code": "ML6", "name": "Mile 6 Mankon",  "city_code": "BDA", "commune_name": "Bamenda 3e"},

    # ══════════════════════════════════════════════════════════════════════
    # KUMBO  (KBA)
    # ══════════════════════════════════════════════════════════════════════
    {"code": "TOB", "name": "Tobin",          "city_code": "KBA", "commune_name": "Kumbo"},
    {"code": "NSO", "name": "Nso Quarter",    "city_code": "KBA", "commune_name": "Kumbo"},
    {"code": "KBC", "name": "Kumbo Centre",   "city_code": "KBA", "commune_name": "Kumbo"},
    {"code": "MBV", "name": "Mbve",           "city_code": "KBA", "commune_name": "Kumbo"},
    {"code": "SHS", "name": "Shisong",        "city_code": "KBA", "commune_name": "Kumbo"},

    # ══════════════════════════════════════════════════════════════════════
    # BUÉA  (BUE)
    # ══════════════════════════════════════════════════════════════════════
    {"code": "MOL", "name": "Molyko",         "city_code": "BUE", "commune_name": "Buéa"},
    {"code": "GCE", "name": "Great Soppo",    "city_code": "BUE", "commune_name": "Buéa"},
    {"code": "BUT", "name": "Buéa Town",      "city_code": "BUE", "commune_name": "Buéa"},
    {"code": "ML16", "name": "Mile 16",       "city_code": "BUE", "commune_name": "Buéa"},
    {"code": "ML17", "name": "Mile 17",       "city_code": "BUE", "commune_name": "Buéa"},
    {"code": "BKP", "name": "Bokwango",       "city_code": "BUE", "commune_name": "Buéa"},
    {"code": "WNB", "name": "Wonjeki",        "city_code": "BUE", "commune_name": "Buéa"},

    # ══════════════════════════════════════════════════════════════════════
    # LIMBÉ  (LBE)
    # ══════════════════════════════════════════════════════════════════════
    {"code": "DWN", "name": "Down Beach",      "city_code": "LBE", "commune_name": "Limbé 1er"},
    {"code": "BOT", "name": "Bota",           "city_code": "LBE", "commune_name": "Limbé 1er"},
    {"code": "MLQ", "name": "Mile 1",         "city_code": "LBE", "commune_name": "Limbé 1er"},
    {"code": "NWO", "name": "New Town",       "city_code": "LBE", "commune_name": "Limbé 2e"},
    {"code": "CBB", "name": "Cassava Beach",  "city_code": "LBE", "commune_name": "Limbé 2e"},
    {"code": "JSE", "name": "Jenge",          "city_code": "LBE", "commune_name": "Limbé 3e"},

    # ══════════════════════════════════════════════════════════════════════
    # KUMBA  (KUM)
    # ══════════════════════════════════════════════════════════════════════
    {"code": "FIT", "name": "Fiango",         "city_code": "KUM", "commune_name": "Kumba 1er"},
    {"code": "KKT", "name": "Kakwa",          "city_code": "KUM", "commune_name": "Kumba 1er"},
    {"code": "KMC", "name": "Kumba Town",     "city_code": "KUM", "commune_name": "Kumba 1er"},
    {"code": "MBN2", "name": "Mbonge Road",   "city_code": "KUM", "commune_name": "Kumba 2e"},
    {"code": "HLS", "name": "Hospice",        "city_code": "KUM", "commune_name": "Kumba 2e"},

    # ══════════════════════════════════════════════════════════════════════
    # GAROUA  (GRA)
    # ══════════════════════════════════════════════════════════════════════
    {"code": "ROP", "name": "Roupaye",         "city_code": "GRA", "commune_name": "Garoua 1er"},
    {"code": "YEL", "name": "Yelwa",          "city_code": "GRA", "commune_name": "Garoua 1er"},
    {"code": "DGR", "name": "Doualaré",       "city_code": "GRA", "commune_name": "Garoua 1er"},
    {"code": "WJD", "name": "Wouro DjéRingol", "city_code": "GRA", "commune_name": "Garoua 2e"},
    {"code": "LPR", "name": "Lopéré",         "city_code": "GRA", "commune_name": "Garoua 2e"},
    {"code": "MRA2", "name": "Marouaré",      "city_code": "GRA", "commune_name": "Garoua 3e"},
    {"code": "QBH", "name": "Quartier Bouchni", "city_code": "GRA", "commune_name": "Garoua 3e"},

    # ══════════════════════════════════════════════════════════════════════
    # MAROUA  (MRA) — 3 communes
    # ══════════════════════════════════════════════════════════════════════
    {"code": "DMY", "name": "Domayo",          "city_code": "MRA", "commune_name": "Maroua 1er"},
    {"code": "LKD", "name": "Lakiré",         "city_code": "MRA", "commune_name": "Maroua 1er"},
    {"code": "KRL", "name": "Kakalé",         "city_code": "MRA", "commune_name": "Maroua 1er"},
    {"code": "DLF", "name": "Doualaré",       "city_code": "MRA", "commune_name": "Maroua 2e"},
    {"code": "PTA2", "name": "Pitoaré",        "city_code": "MRA", "commune_name": "Maroua 2e"},
    {"code": "WRD", "name": "Wourndé",        "city_code": "MRA", "commune_name": "Maroua 2e"},
    {"code": "GGR", "name": "Gongoré",        "city_code": "MRA", "commune_name": "Maroua 3e"},
    {"code": "ZLZ", "name": "Ziling",         "city_code": "MRA", "commune_name": "Maroua 3e"},

    # ══════════════════════════════════════════════════════════════════════
    # KOUSSÉRI  (KSL)
    # ══════════════════════════════════════════════════════════════════════
    {"code": "KSC", "name": "Centre-ville",    "city_code": "KSL", "commune_name": "Kousséri"},
    {"code": "BLD", "name": "Boulai",         "city_code": "KSL", "commune_name": "Kousséri"},
    {"code": "AMC", "name": "Amchidé",        "city_code": "KSL", "commune_name": "Kousséri"},
    {"code": "NGA2", "name": "Ngana",          "city_code": "KSL", "commune_name": "Kousséri"},

    # ══════════════════════════════════════════════════════════════════════
    # NGAOUNDÉRÉ  (NGD) — 3 communes
    # ══════════════════════════════════════════════════════════════════════
    {"code": "JOL", "name": "Joli Soir",       "city_code": "NGD", "commune_name": "Ngaoundéré 1er"},
    {"code": "WRB", "name": "Wouro Bappé",    "city_code": "NGD", "commune_name": "Ngaoundéré 1er"},
    {"code": "MRC", "name": "Marché Central",  "city_code": "NGD", "commune_name": "Ngaoundéré 1er"},
    {"code": "WRS", "name": "Wouro Sira",     "city_code": "NGD", "commune_name": "Ngaoundéré 2e"},
    {"code": "WRD2", "name": "Wouro Djégué",   "city_code": "NGD", "commune_name": "Ngaoundéré 2e"},
    {"code": "GMR", "name": "Gamaré",         "city_code": "NGD", "commune_name": "Ngaoundéré 3e"},
    {"code": "TBG", "name": "Tibati-Gare",    "city_code": "NGD", "commune_name": "Ngaoundéré 3e"},

    # ══════════════════════════════════════════════════════════════════════
    # BERTOUA  (BTA) — 2 communes
    # ══════════════════════════════════════════════════════════════════════
    {"code": "HAU", "name": "Haoussa",         "city_code": "BTA", "commune_name": "Bertoua 1er"},
    {"code": "NKL", "name": "Nkolbikon",      "city_code": "BTA", "commune_name": "Bertoua 1er"},
    {"code": "CVR2", "name": "Centre-ville",   "city_code": "BTA", "commune_name": "Bertoua 1er"},
    {"code": "NKM", "name": "Nkolmetet",      "city_code": "BTA", "commune_name": "Bertoua 2e"},
    {"code": "NDM", "name": "Ndokmbe",        "city_code": "BTA", "commune_name": "Bertoua 2e"},

    # ══════════════════════════════════════════════════════════════════════
    # EBOLOWA  (EBW)
    # ══════════════════════════════════════════════════════════════════════
    {"code": "ANG", "name": "Angalé",          "city_code": "EBW", "commune_name": "Ebolowa 1er"},
    {"code": "NKO", "name": "Nkolfoulou",     "city_code": "EBW", "commune_name": "Ebolowa 1er"},
    {"code": "EBC", "name": "Centre-ville",    "city_code": "EBW", "commune_name": "Ebolowa 2e"},
    {"code": "NKL2", "name": "Nkolbikok",      "city_code": "EBW", "commune_name": "Ebolowa 2e"},
    {"code": "AHU", "name": "Ahuom",          "city_code": "EBW", "commune_name": "Ebolowa 2e"},

    # ══════════════════════════════════════════════════════════════════════
    # KRIBI  (KRI)
    # ══════════════════════════════════════════════════════════════════════
    {"code": "CEN", "name": "Centre-ville",    "city_code": "KRI", "commune_name": "Kribi 1er"},
    {"code": "ABT", "name": "Akpabé",         "city_code": "KRI", "commune_name": "Kribi 1er"},
    {"code": "NDB", "name": "Ndjombé",        "city_code": "KRI", "commune_name": "Kribi 2e"},
    {"code": "LBT", "name": "Lobé",           "city_code": "KRI", "commune_name": "Kribi 2e"},

    # ══════════════════════════════════════════════════════════════════════
    # SANGMÉLIMA  (SGA)
    # ══════════════════════════════════════════════════════════════════════
    {"code": "SGC", "name": "Centre-ville",    "city_code": "SGA", "commune_name": "Sangmélima"},
    {"code": "NKF", "name": "Nkolfame",        "city_code": "SGA", "commune_name": "Sangmélima"},
    {"code": "MEL2", "name": "Mekalat",        "city_code": "SGA", "commune_name": "Sangmélima"},

    # ══════════════════════════════════════════════════════════════════════
    # EDEA  (EDA) — 2 communes, 14 quartiers
    # ══════════════════════════════════════════════════════════════════════
    # Edéa 1er
    {"code": "PNG", "name": "Pongo",            "city_code": "EDA", "commune_name": "Edéa 1er"},
    {"code": "PSC", "name": "Pongo-Sonel",       "city_code": "EDA", "commune_name": "Edéa 1er"},
    {"code": "CCM", "name": "Centre Commercial",  "city_code": "EDA", "commune_name": "Edéa 1er"},
    {"code": "PLA", "name": "Plateau Administratif", "city_code": "EDA", "commune_name": "Edéa 1er"},
    {"code": "DSA", "name": "Domaine Sanaga",    "city_code": "EDA", "commune_name": "Edéa 1er"},
    {"code": "EDB", "name": "Edéa-Bassa",       "city_code": "EDA", "commune_name": "Edéa 1er"},
    {"code": "EDL", "name": "Edéa-Limbe",      "city_code": "EDA", "commune_name": "Edéa 1er"},
    {"code": "BSS1", "name": "Bisséké I",        "city_code": "EDA", "commune_name": "Edéa 1er"},
    {"code": "AMR", "name": "Amour",            "city_code": "EDA", "commune_name": "Edéa 1er"},
    {"code": "HUS", "name": "Haoussa",          "city_code": "EDA", "commune_name": "Edéa 1er"},
    # Edéa 2e
    {"code": "EKT", "name": "Ékité",            "city_code": "EDA", "commune_name": "Edéa 2e"},
    {"code": "NDB2", "name": "Ndongbok",         "city_code": "EDA", "commune_name": "Edéa 2e"},
    {"code": "KPL", "name": "Koplim",           "city_code": "EDA", "commune_name": "Edéa 2e"},
    {"code": "MPM", "name": "Mpombo",            "city_code": "EDA", "commune_name": "Edéa 2e"},

    # ══════════════════════════════════════════════════════════════════════
    # NKONGSAMBA  (NKG) — 2 communes, 8 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "NKS", "name": "Centre-ville",     "city_code": "NKG", "commune_name": "Nkongsamba 1er"},
    {"code": "MPL", "name": "Manengole",       "city_code": "NKG", "commune_name": "Nkongsamba 1er"},
    {"code": "SLM", "name": "Salmoa",          "city_code": "NKG", "commune_name": "Nkongsamba 1er"},
    {"code": "NTL", "name": "Ntolo",           "city_code": "NKG", "commune_name": "Nkongsamba 1er"},
    {"code": "NKG2", "name": "Nkongsamba Nord", "city_code": "NKG", "commune_name": "Nkongsamba 2e"},
    {"code": "BNG", "name": "Bangem",           "city_code": "NKG", "commune_name": "Nkongsamba 2e"},
    {"code": "KLO", "name": "Kilo",            "city_code": "NKG", "commune_name": "Nkongsamba 2e"},
    {"code": "QDS", "name": "Quartier Dschang", "city_code": "NKG", "commune_name": "Nkongsamba 2e"},

    # ── Smaller cities — single commune with centre-ville + 1-2 quartiers ─

    # ══════════════════════════════════════════════════════════════════════
    # MBALMAYO  (MBA) — 9 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "MBC", "name": "Centre-ville",    "city_code": "MBA", "commune_name": "Mbalmayo"},
    {"code": "MNV", "name": "Nkolveng",        "city_code": "MBA", "commune_name": "Mbalmayo"},
    {"code": "NKZ", "name": "Nkolzok",         "city_code": "MBA", "commune_name": "Mbalmayo"},
    {"code": "NKD2", "name": "Nkondi",          "city_code": "MBA", "commune_name": "Mbalmayo"},
    {"code": "OBK", "name": "Obeck",           "city_code": "MBA", "commune_name": "Mbalmayo"},
    {"code": "MLB", "name": "Melombo",         "city_code": "MBA", "commune_name": "Mbalmayo"},
    {"code": "NSL", "name": "Nsengnlong",      "city_code": "MBA", "commune_name": "Mbalmayo"},
    {"code": "VML", "name": "Vimli (Akom)",    "city_code": "MBA", "commune_name": "Mbalmayo"},
    {"code": "NDK2", "name": "Ndoukong",        "city_code": "MBA", "commune_name": "Mbalmayo"},

    # ══════════════════════════════════════════════════════════════════════
    # OBALA  (OBA) — 8 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "OBC", "name": "Centre-ville",    "city_code": "OBA", "commune_name": "Obala"},
    {"code": "MKM1", "name": "Minkama I",       "city_code": "OBA", "commune_name": "Obala"},
    {"code": "MKM2", "name": "Minkama II",      "city_code": "OBA", "commune_name": "Obala"},
    {"code": "MKM3", "name": "Minkama III",     "city_code": "OBA", "commune_name": "Obala"},
    {"code": "ABK", "name": "Abokono",          "city_code": "OBA", "commune_name": "Obala"},
    {"code": "NDM2", "name": "Ndindon",          "city_code": "OBA", "commune_name": "Obala"},
    {"code": "EKA2", "name": "Ekok-Assi",       "city_code": "OBA", "commune_name": "Obala"},
    {"code": "NKB2", "name": "Nkolbikok",       "city_code": "OBA", "commune_name": "Obala"},

    # ══════════════════════════════════════════════════════════════════════
    # BAFIA  (BFA) — 8 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "BFC", "name": "Centre-ville",    "city_code": "BFA", "commune_name": "Bafia"},
    {"code": "LBL", "name": "Lablé",           "city_code": "BFA", "commune_name": "Bafia"},
    {"code": "NDG", "name": "Ndengue",         "city_code": "BFA", "commune_name": "Bafia"},
    {"code": "NYS", "name": "Nyamsong",        "city_code": "BFA", "commune_name": "Bafia"},
    {"code": "WND", "name": "Wandala",         "city_code": "BFA", "commune_name": "Bafia"},
    {"code": "IBN", "name": "Ibana",           "city_code": "BFA", "commune_name": "Bafia"},
    {"code": "TBR", "name": "Tamboro",         "city_code": "BFA", "commune_name": "Bafia"},
    {"code": "MSC2", "name": "Messangsang",     "city_code": "BFA", "commune_name": "Bafia"},

    # ── Smaller Centre cities ──────────────────────────────────────────────
    {"code": "AKC", "name": "Centre-ville",    "city_code": "AKL", "commune_name": "Akonolinga"},
    {"code": "EKC", "name": "Centre-ville",    "city_code": "EKA", "commune_name": "Eséka"},
    {"code": "NSM3", "name": "Nsimeyong",       "city_code": "NGE", "commune_name": "Nanga-Eboko"},
    {"code": "NGC", "name": "Centre-ville",    "city_code": "NGE", "commune_name": "Nanga-Eboko"},
    {"code": "ABG2", "name": "Abang",           "city_code": "NGE", "commune_name": "Nanga-Eboko"},
    {"code": "MNC", "name": "Centre-ville",    "city_code": "MON", "commune_name": "Monatele"},
    {"code": "SAC", "name": "Centre-ville",    "city_code": "SAA", "commune_name": "Saa"},

    # Littoral smaller cities
    {"code": "LMC", "name": "Centre-ville",   "city_code": "LOM", "commune_name": "Loum"},
    {"code": "MBGC", "name": "Centre-ville",   "city_code": "MBG", "commune_name": "Mbanga"},
    {"code": "MLGC", "name": "Centre-ville",   "city_code": "MLG", "commune_name": "Melong"},
    {"code": "PNJC", "name": "Centre-ville",   "city_code": "PNJ", "commune_name": "Penja"},
    {"code": "DBBC", "name": "Centre-ville",   "city_code": "DBB", "commune_name": "Dibombari"},

    # ══════════════════════════════════════════════════════════════════════
    # BANDJOUN  (NDJ) — 5 quartiers
    # ══════════════════════════════════════════════════════════════════════
    {"code": "NDJC", "name": "Centre-ville",    "city_code": "NDJ", "commune_name": "Bandjoun"},
    {"code": "HLA", "name": "Hiala",           "city_code": "NDJ", "commune_name": "Bandjoun"},
    {"code": "TKO", "name": "Toukouo",          "city_code": "NDJ", "commune_name": "Bandjoun"},
    {"code": "MGM", "name": "Magom",           "city_code": "NDJ", "commune_name": "Bandjoun"},
    {"code": "PET", "name": "Pète-Bandjoun",    "city_code": "NDJ", "commune_name": "Bandjoun"},

    # ── Smaller Ouest cities ──────────────────────────────────────────────
    {"code": "TBAC", "name": "Centre-ville",    "city_code": "TBA", "commune_name": "Tonga"},
    {"code": "BAJC", "name": "Centre-ville",    "city_code": "BAJ", "commune_name": "Bazou"},

    # Sud smaller cities
    {"code": "AMBC", "name": "Centre-ville",   "city_code": "AMB", "commune_name": "Ambam"},
    {"code": "MVKC", "name": "Centre-ville",   "city_code": "MVK", "commune_name": "Mvangan"},

    # Nord smaller cities
    {"code": "PTC", "name": "Centre-ville",    "city_code": "PTA", "commune_name": "Pitoa"},
    {"code": "GUC", "name": "Centre-ville",    "city_code": "GUI", "commune_name": "Guider"},
    {"code": "RYC", "name": "Centre-ville",    "city_code": "RYS", "commune_name": "Rey-Bouba"},
    {"code": "LGC", "name": "Centre-ville",    "city_code": "LAG", "commune_name": "Lagdo"},

    # Extrême-Nord smaller cities
    {"code": "MKC", "name": "Centre-ville",    "city_code": "MKO", "commune_name": "Mokolo"},
    {"code": "YGC", "name": "Centre-ville",    "city_code": "YGO", "commune_name": "Yagoua"},
    {"code": "KZC", "name": "Centre-ville",    "city_code": "KAZ", "commune_name": "Kaélé"},
    {"code": "MRC2", "name": "Centre-ville",    "city_code": "MOK", "commune_name": "Mora"},
    {"code": "WZC", "name": "Centre-ville",    "city_code": "WZD", "commune_name": "Waza"},

    # Adamaoua smaller cities
    {"code": "TBC", "name": "Centre-ville",    "city_code": "TBT", "commune_name": "Tibati"},
    {"code": "TGC", "name": "Centre-ville",    "city_code": "TGN", "commune_name": "Tignère"},
    {"code": "BYC", "name": "Centre-ville",    "city_code": "BYO", "commune_name": "Banyo"},
    {"code": "MEC", "name": "Centre-ville",    "city_code": "MEI", "commune_name": "Meiganga"},
    {"code": "DJC", "name": "Centre-ville",    "city_code": "DJO", "commune_name": "Djohong"},

    # Est smaller cities
    {"code": "BTC", "name": "Centre-ville",    "city_code": "BTR", "commune_name": "Batouri"},
    {"code": "YKC", "name": "Centre-ville",    "city_code": "YKM", "commune_name": "Yokadouma"},
    {"code": "ABC", "name": "Centre-ville",    "city_code": "ABG", "commune_name": "Abong-Mbang"},
    {"code": "DMC", "name": "Centre-ville",    "city_code": "DMN", "commune_name": "Dimako"},
    {"code": "LDC", "name": "Centre-ville",    "city_code": "LDM", "commune_name": "Lomié"},

    # Nord-Ouest smaller cities
    {"code": "NPC", "name": "Centre-ville",    "city_code": "NDP", "commune_name": "Ndop"},
    {"code": "NKWC", "name": "Centre-ville",   "city_code": "NKW", "commune_name": "Nkambé"},
    {"code": "WUC", "name": "Centre-ville",    "city_code": "WUM", "commune_name": "Wum"},
    {"code": "MCC", "name": "Centre-ville",    "city_code": "MCM", "commune_name": "Mamfé"},

    # Sud-Ouest smaller cities
    {"code": "TKC", "name": "Centre-ville",    "city_code": "TND", "commune_name": "Tiko"},
    {"code": "MTC", "name": "Centre-ville",    "city_code": "MUT", "commune_name": "Mutengene"},
    {"code": "IDC", "name": "Centre-ville",    "city_code": "IDN", "commune_name": "Idenau"},
]

# ── Lookup helpers ─────────────────────────────────────────────────────────

_cities_by_region: dict[str, list[GeoCity]] = {}
_quartiers_by_city: dict[str, list[GeoQuartier]] = {}


def _build_lookups() -> None:
    for c in CITIES:
        _cities_by_region.setdefault(c["region_code"], []).append(c)
    for q in QUARTIERS:
        _quartiers_by_city.setdefault(q["city_code"], []).append(q)


_build_lookups()


def get_regions() -> list[GeoRegion]:
    return REGIONS


def get_cities(region_code: str) -> list[GeoCity]:
    return _cities_by_region.get(region_code, [])


def get_quartiers(city_code: str) -> list[GeoQuartier]:
    return _quartiers_by_city.get(city_code, [])


# ── Stats ──────────────────────────────────────────────────────────────────

def stats() -> dict[str, int]:
    return {
        "regions": len(REGIONS),
        "cities": len(CITIES),
        "quartiers": len(QUARTIERS),
    }
