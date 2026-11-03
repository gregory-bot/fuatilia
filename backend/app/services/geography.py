"""Counties, facilities and CHPs used by the synthetic data and the facility search.

Facility names give the demo geographic realism only. All patients, distances, CHPs
and outcomes attached to them are invented.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class County:
    name: str
    rural: bool
    weight: float  # share of synthetic patients
    distance_mean_km: float  # typical distance to the treatment facility
    treatment_facility: str
    screening_sites: tuple[str, ...]
    villages: tuple[str, ...]
    chps: tuple[tuple[str, str], ...]  # (CHP name, area)


COUNTIES: tuple[County, ...] = (
    County("Samburu", True, 0.15, 58, "Samburu County Referral Hospital, Maralal",
           ("Lodung'okwe Dispensary", "Wamba Health Centre", "Baragoi Sub-County Hospital",
            "Suguta Marmar Health Centre", "Archers Post Health Centre"),
           ("Lodung'okwe", "Wamba", "Baragoi", "Suguta Marmar", "Archers Post", "Kisima"),
           (("Grace Naeku", "Lodung'okwe & Kisima"), ("Nashipai Lolkirr", "Wamba & Archers Post"))),
    County("Baringo", True, 0.14, 44, "Baringo County Referral Hospital, Kabarnet",
           ("Marigat Sub-County Hospital", "Chemolingot Sub-County Hospital",
            "Kabartonjo Sub-County Hospital", "Mogotio Health Centre", "Tangulbei Health Centre"),
           ("Marigat", "Chemolingot", "Kabartonjo", "Mogotio", "Tangulbei", "Loruk"),
           (("Jepkemboi Kiptoo", "Marigat & Loruk"), ("Mercy Chepchumba", "Tiaty & Tangulbei"))),
    County("Turkana", True, 0.10, 72, "Lodwar County Referral Hospital",
           ("Kakuma Sub-County Hospital", "Lokichoggio Health Centre", "Kalokol Health Centre"),
           ("Kakuma", "Lokichoggio", "Kalokol", "Lokori"),
           (("Akai Ekiru", "Kakuma & Lokichoggio"),)),
    County("West Pokot", True, 0.07, 50, "Kapenguria County Referral Hospital",
           ("Sigor Sub-County Hospital", "Chepareria Health Centre", "Alale Health Centre"),
           ("Sigor", "Chepareria", "Alale", "Kacheliba"),
           (("Cheptoo Lomuria", "Sigor & Chepareria"),)),
    County("Laikipia", True, 0.07, 38, "Nanyuki Teaching & Referral Hospital",
           ("Doldol Health Centre", "Rumuruti Sub-County Hospital", "Kimanjo Dispensary"),
           ("Doldol", "Rumuruti", "Kimanjo", "Ol Moran"),
           (("Wanjiru Maina", "Doldol & Kimanjo"),)),
    County("Nakuru", False, 0.12, 20, "Nakuru Level 5 Hospital",
           ("Naivasha Sub-County Hospital", "Molo Sub-County Hospital", "Bondeni Health Centre"),
           ("Naivasha", "Molo", "Bondeni", "Njoro"),
           (("Wambui Njoroge", "Naivasha & Njoro"),)),
    County("Kisumu", False, 0.10, 16, "Jaramogi Oginga Odinga Teaching & Referral Hospital",
           ("Ahero Sub-County Hospital", "Kombewa Sub-County Hospital", "Nyakach Health Centre"),
           ("Ahero", "Kombewa", "Nyakach", "Kondele"),
           (("Achieng Odhiambo", "Ahero & Nyakach"),)),
    County("Nairobi", False, 0.10, 9, "Kenyatta National Hospital",
           ("Mathare North Health Centre", "Kibera South Health Centre", "Kayole II Sub-County Hospital"),
           ("Mathare", "Kibera", "Kayole", "Kawangware"),
           (("Zawadi Mwangi", "Mathare & Kayole"),)),
    County("Kakamega", False, 0.09, 24, "Kakamega County General Hospital",
           ("Malava Sub-County Hospital", "Butere Sub-County Hospital", "Shibwe Health Centre"),
           ("Malava", "Butere", "Shibwe", "Lurambi"),
           (("Nafula Wekesa", "Malava & Butere"),)),
    County("Kilifi", False, 0.06, 30, "Kilifi County Referral Hospital",
           ("Mariakani Sub-County Hospital", "Ganze Health Centre", "Rabai Health Centre"),
           ("Mariakani", "Ganze", "Rabai", "Bamba"),
           (("Halima Bakari", "Ganze & Bamba"),)),
)

BY_NAME = {c.name: c for c in COUNTIES}


def county(name: str) -> County:
    try:
        return BY_NAME[name]
    except KeyError as exc:  # surfaced as 422 by the API layer
        raise ValueError(f"Unknown county: {name}") from exc


def facilities(query: str = "", county_name: str | None = None) -> list[dict]:
    """Flat, searchable facility list (screening sites + treatment sites)."""
    q = query.strip().lower()
    rows: list[dict] = []
    for c in COUNTIES:
        if county_name and c.name != county_name:
            continue
        rows.append({"name": c.treatment_facility, "county": c.name, "type": "treatment",
                     "services": ["LEEP", "Thermal ablation", "Cryotherapy", "Biopsy", "Referral oncology"]})
        for site in c.screening_sites:
            rows.append({"name": site, "county": c.name, "type": "screening",
                         "services": ["VIA screening", "HPV self-sampling", "Thermal ablation"]})
    if q:
        rows = [r for r in rows if q in r["name"].lower() or q in r["county"].lower()]
    return rows
