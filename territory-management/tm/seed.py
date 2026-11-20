"""Fictional demo data: two field forces covering Sweden. All names are made up."""

from .store import MASTER, Store

ACCOUNTS = [
    # id, name, type, specialty, segment, postal_code, city, potential
    ("A001", "Northgate University Hospital", "Hospital", "Hematology", "Centre of Excellence", "171 64", "Solna", 95),
    ("A002", "Lakeside Hematology Clinic", "Clinic", "Hematology", "High", "113 45", "Stockholm", 60),
    ("A003", "Birchwood Children's Hospital", "Hospital", "Pediatric hematology", "High", "141 86", "Huddinge", 70),
    ("A004", "Uppland Regional Hospital", "Hospital", "Hematology", "Medium", "751 85", "Uppsala", 50),
    ("A005", "Southcoast University Hospital", "Hospital", "Hematology", "Centre of Excellence", "221 85", "Lund", 90),
    ("A006", "Harbour Blood Disorders Unit", "Clinic", "Hematology", "Medium", "211 20", "Malmö", 40),
    ("A007", "Westbay Hospital", "Hospital", "Hematology", "High", "413 45", "Göteborg", 65),
    ("A008", "Riverside Rheumatology", "Clinic", "Rheumatology", "High", "114 28", "Stockholm", 55),
    ("A009", "Pinecrest Immunology Centre", "Clinic", "Immunology", "Medium", "416 50", "Göteborg", 45),
    ("A010", "Northern Lights Hospital", "Hospital", "Hematology", "Medium", "901 85", "Umeå", 35),
    ("A011", "Fjällgården Clinic", "Clinic", "Rheumatology", "Low", "831 30", "Östersund", 15),
    ("A012", "Meadow Family Practice", "Clinic", "General practice", "Low", "118 20", "Stockholm", 5),
    ("A013", "Coastline Rheumatology", "Clinic", "Rheumatology", "Medium", "252 21", "Helsingborg", 30),
    ("A014", "Ironworks County Hospital", "Hospital", "Immunology", "Medium", "702 10", "Örebro", 40),
    ("A015", "Linden Pediatric Centre", "Clinic", "Pediatric hematology", "Medium", "582 25", "Linköping", 30),
]


def seed(store: Store) -> None:
    for a in ACCOUNTS:
        store.upsert_account(dict(zip(("id", "name", "type", "specialty", "segment", "postal_code", "city", "potential"), a)),
                             commit=False)
    store.db.commit()

    store.upsert_field_force("HEM", "Hematology", [
        {"field": "specialty", "op": "in", "value": ["Hematology", "Pediatric hematology"]}])
    store.upsert_field_force("IMM", "Immunology & Rheumatology", [
        {"field": "specialty", "op": "in", "value": ["Immunology", "Rheumatology"]}])

    t = store.add_territory
    t(MASTER, "HEM-SE", "Hematology Sweden", "HEM")
    t(MASTER, "HEM-KAM", "Hematology Key Accounts", "HEM", "HEM-SE")
    t(MASTER, "HEM-EAST", "Hematology East", "HEM", "HEM-SE")
    t(MASTER, "HEM-WEST", "Hematology West & South", "HEM", "HEM-SE")
    t(MASTER, "IMM-SE", "Immunology Sweden", "IMM")
    t(MASTER, "IMM-NORTH", "Immunology North", "IMM", "IMM-SE")
    t(MASTER, "IMM-SOUTH", "Immunology South", "IMM", "IMM-SE")

    # Centres of excellence go to the key account team instead of geography.
    store.add_account_rule(MASTER, "HEM-KAM", [{"field": "segment", "op": "eq", "value": "Centre of Excellence"}],
                           priority=10, name="Centres of excellence")

    # Swedish postal codes: first digits roughly map to regions.
    for prefix in ("1", "5", "6", "7", "8", "9"):
        store.add_geo_rule(MASTER, "HEM-EAST", prefix)
    for prefix in ("2", "3", "4"):
        store.add_geo_rule(MASTER, "HEM-WEST", prefix)
    for prefix in ("1", "7", "8", "9"):
        store.add_geo_rule(MASTER, "IMM-NORTH", prefix)
    for prefix in ("2", "3", "4", "5", "6"):
        store.add_geo_rule(MASTER, "IMM-SOUTH", prefix)

    store.add_roster("HEM-KAM", "Alex Berg", "alex.berg@example.com", "key account manager")
    store.add_roster("HEM-EAST", "Sam Lind", "sam.lind@example.com")
    store.add_roster("HEM-WEST", "Robin Ek", "robin.ek@example.com")
    store.add_roster("IMM-NORTH", "Kim Holm", "kim.holm@example.com")
    store.add_roster("IMM-SOUTH", "Jo Strand", "jo.strand@example.com")
    store.add_roster("HEM-SE", "Charlie Nyberg", "charlie.nyberg@example.com", "manager")
