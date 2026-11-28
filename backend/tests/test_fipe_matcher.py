import unittest
from typing import List, Tuple

from backend.domain.fipe_matcher import (
    build_fipe_catalog_entry,
    build_year_buckets,
    match_listings_against_catalog,
)


def _make_catalog(
    rows: List[Tuple[str, str, str, int, str, float]],
):
    entries = [
        build_fipe_catalog_entry(
            codigo_fipe=code,
            nome_marca=brand,
            nome_modelo=model,
            ano_modelo=year,
            nome_combustivel=fuel,
            valor=valor,
            mes_referencia=11,
            ano_referencia=2026,
        )
        for code, brand, model, year, fuel, valor in rows
    ]
    return build_year_buckets(entries)


class TestFipeMatcher(unittest.TestCase):
    def test_onix_premier_hatch_and_sedan_vs_base_2026(self):
        catalog = _make_catalog(
            [
                ("004519-5", "GM - Chevrolet", "ONIX HATCH 1.0 12V Flex 5p Mec.", 2026, "Flex", 81864),
                ("004511-0", "GM - Chevrolet", "ONIX HATCH 1.0 12V TB Flex 5p Aut.", 2026, "Flex", 92083),
                ("004514-4", "GM - Chevrolet", "ONIX HATCH LT 1.0 12V TB Flex 5p Aut.", 2026, "Flex", 97803),
                ("004515-2", "GM - Chevrolet", "ONIX HATCH LTZ 1.0 12V TB Flex 5p Aut.", 2026, "Flex", 104127),
                ("004516-0", "GM - Chevrolet", "ONIX HATCH PREM. 1.0 12V TB Flex 5p Aut.", 2026, "Flex", 109698),
                ("004530-6", "GM - Chevrolet", "ONIX HATCH RS 1.0 TB 12V Flex 5p Aut.", 2026, "Flex", 112468),
                ("004499-7", "GM - Chevrolet", "ONIX SEDAN Plus 1.0 12V TB Flex Aut.", 2026, "Flex", 99921),
                ("004504-7", "GM - Chevrolet", "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut", 2026, "Flex", 113201),
            ]
        )

        items = [
            {
                "id": "onix_hatch_premier",
                "brand": "Chevrolet",
                "model": "Onix",
                "version": "Hatch Premier 1.0 12V TB Flex Aut. 4P",
                "year": 2026,
                "transmission": "Automático",
                "fuel": "Flex",
                "title": "Chevrolet Onix Hatch Premier 1.0 12V TB Flex Aut. 4P 2026",
            },
            {
                "id": "onix_sedan_premier",
                "brand": "Chevrolet",
                "model": "Onix",
                "version": "Sedan Plus Premier 1.0 12V TB Flex Aut. 4P",
                "year": 2026,
                "transmission": "Automático",
                "fuel": "Flex",
                "title": "Chevrolet Onix Sedan Plus Premier 1.0 12V TB Flex Aut. 4P 2026",
            },
            {
                "id": "onix_hatch_base",
                "brand": "Chevrolet",
                "model": "Onix",
                "version": "Hatch 1.0 12V TB Flex Aut. 4P",
                "year": 2026,
                "transmission": "Automático",
                "fuel": "Flex",
                "title": "Chevrolet Onix Hatch 1.0 12V TB Flex Aut. 4P 2026",
            },
        ]

        matches = match_listings_against_catalog(items, catalog)
        self.assertEqual(matches["onix_hatch_premier"]["codigo_fipe"], "004516-0")
        self.assertEqual(matches["onix_sedan_premier"]["codigo_fipe"], "004504-7")
        self.assertEqual(matches["onix_hatch_base"]["codigo_fipe"], "004511-0")

    def test_abbreviated_trims_and_trailing_dot_punctuation(self):
        catalog = _make_catalog(
            [
                # T-Cross
                ("005510-7", "VW - VolksWagen", "T-Cross 200 TSI 1.0  Flex 12V 5p Aut.", 2020, "Flex", 88430),
                ("005509-3", "VW - VolksWagen", "T-Cross Comfor. 200 TSI 1.0 Flex 5p Aut.", 2020, "Flex", 95141),
                ("005508-5", "VW - VolksWagen", "T-Cross Hig. 250 TSI 1.4 Flex 16V 5p Aut", 2020, "Flex", 104034),
                # Renegade
                ("017085-2", "Jeep", "Renegade Sport T270 1.3 TB 4x2 Flex Aut.", 2022, "Flex", 94496),
                ("017088-7", "Jeep", "Renegade Long. T270 1.3 TB 4x2 Flex Aut.", 2022, "Flex", 98024),
                # Commander (Aut vs Aut. trailing dot bug)
                ("017093-3", "Jeep", "Commander Longitude T270 1.3 TB Flex Aut", 2023, "Flex", 146979),
                ("017082-8", "Jeep", "Commander Overland T270 1.3 TB Flex Aut.", 2023, "Flex", 167264),
                # HB20 (Aut vs Aut. trailing dot bug)
                ("015214-5", "Hyundai", "HB20 Comfort 1.0 TB Flex 12V Aut", 2023, "Flex", 79139),
                ("015209-9", "Hyundai", "HB20 Platinum 1.0 TB Flex 12V Aut.", 2023, "Flex", 87187),
                # City Hatchback (Aut vs Aut. trailing dot bug)
                ("014108-9", "Honda", "CITY Hatchback EXL 1.5 Flex 16V Aut.", 2022, "Flex", 97828),
                ("014107-0", "Honda", "CITY Hatchback Touring 1.5 Flex 16V Aut", 2022, "Flex", 100791),
                # Compass Trailhawk (TD350 vs TD 350, Die. vs Diesel)
                ("017075-5", "Jeep", "COMPASS LONG. TD 350 2.0 4x4 Diesel Aut.", 2022, "Diesel", 129264),
                ("017078-0", "Jeep", "COMPASS TRAILHAWK TD350 2.0 4x4 Die. Aut", 2022, "Diesel", 138516),
                # Amarok High.CD (glued dot word)
                ("005325-2", "VW - VolksWagen", "AMAROK SE CD 2.0 16V TDI 4x4 Diesel", 2015, "Diesel", 77652),
                ("005340-6", "VW - VolksWagen", "AMAROK High.CD 2.0 16V TDI 4x4 Dies. Aut", 2015, "Diesel", 98245),
                # Corolla Altis slash alternative
                ("002111-3", "Toyota", "Corolla XEi 2.0 Flex 16V Aut.", 2011, "Flex", 59241),
                ("002112-1", "Toyota", "Corolla ALTIS/A.Premiu. 2.0 Flex 16V Aut", 2011, "Flex", 60876),
                # Fiesta TIT./TIT.Plus glued dot + slash
                ("003388-0", "Ford", "Fiesta 1.6 16V Flex Aut. 5p", 2016, "Flex", 48014),
                ("003390-1", "Ford", "Fiesta TIT./TIT.Plus 1.6 16V Flex Aut.", 2016, "Flex", 51600),
                # Duster Dynamique vs Hi-Flex noise
                ("025181-0", "Renault", "DUSTER 1.6 Hi-Flex 16V Mec.", 2013, "Flex", 46751),
                ("025183-6", "Renault", "DUSTER Dynamique 1.6 Flex 16V Mec.", 2013, "Flex", 48492),
                # Audi Q8 Perf.bl. (glued bl.)
                ("008251-1", "Audi", "Q8 Perfo. 3.0 TFSI Quattro S-tron/(Híb.)", 2019, "Gasolina", 318037),
                ("008250-3", "Audi", "Q8 Perf.Black 3.0 TFSI Quat. S-tr/(Híb.)", 2019, "Gasolina", 304785),
            ]
        )

        cases = [
            ("tcross_comf", "Volkswagen", "T-Cross", "Comfortline 1.0 TSI Flex 5P Aut.", 2020, "Automático", "Flex", "Volkswagen T-Cross Comfortline 1.0 TSI Flex 5P Aut. 2020", "005509-3"),
            ("renegade_long", "Jeep", "Renegade", "Longitude T270 1.3 Turbo 4x2 Aut.", 2022, "Automático", "Flex", "Jeep Renegade Longitude T270 1.3 Turbo 4x2 Aut. 2022", "017088-7"),
            ("commander_over", "Jeep", "Commander", "Overland T270 1.3 TB Flex AUT", 2023, "Automático", "Flex", "Jeep Commander Overland T270 1.3 TB Flex AUT 2023", "017082-8"),
            ("hb20_plat", "Hyundai", "HB20", "Platinum 1.0 TB Flex 12V AUT", 2023, "Automático", "Flex", "Hyundai HB20 Platinum 1.0 TB Flex 12V AUT 2023", "015209-9"),
            ("city_touring", "Honda", "City", "Hatchback Touring 1.5 Flex 16V Aut.", 2022, "Automático", "Flex", "Honda City Hatchback Touring 1.5 Flex 16V Aut. 2022", "014107-0"),
            ("compass_trail", "Jeep", "Compass", "Trailhawk 2.0 4X4 Dies. 16V Aut.", 2022, "Automático", "Diesel", "Jeep Compass Trailhawk 2.0 4X4 Dies. 16V Aut. 2022", "017078-0"),
            ("amarok_high", "Volkswagen", "Amarok", "Highline CD 2.0 16V TDI 4X4 Dies.", 2015, "Automático", "Diesel", "Volkswagen Amarok Highline CD 2.0 16V TDI 4X4 Dies. 2015", "005340-6"),
            ("corolla_altis", "Toyota", "Corolla", "Altis 2.0 Flex 16V Aut.", 2011, "Automático", "Flex", "Toyota Corolla Altis 2.0 Flex 16V Aut. 2011", "002112-1"),
            ("fiesta_tit", "Ford", "Fiesta", "Titanium 1.6 Powershift Aut.", 2016, "Automático", "Flex", "Ford Fiesta Titanium 1.6 Powershift Aut. 2016", "003390-1"),
            ("duster_dyn", "Renault", "Duster", "Dynamique 1.6 Hi-flex 16V Mec.", 2013, "Manual", "Flex", "Renault Duster Dynamique 1.6 Hi-flex 16V Mec. 2013", "025183-6"),
            ("q8_perf_bl", "Audi", "Q8", "Perf.bl. 3.0 TFSI Coupe Quat. S-tron.", 2019, "Automático", "Híbrido", "Audi Q8 Perf.bl. 3.0 TFSI Coupe Quat. S-tron. 2019", "008250-3"),
        ]

        items = [
            {
                "id": cid,
                "brand": brand,
                "model": model,
                "version": ver,
                "year": yr,
                "transmission": trans,
                "fuel": fuel,
                "title": title,
            }
            for cid, brand, model, ver, yr, trans, fuel, title, _ in cases
        ]
        matches = match_listings_against_catalog(items, catalog)
        for cid, *_, expected_code in cases:
            self.assertIn(cid, matches, f"Missing match for {cid}")
            self.assertEqual(
                matches[cid]["codigo_fipe"],
                expected_code,
                f"Wrong FIPE for {cid}: got {matches[cid]['nome_modelo']} ({matches[cid]['codigo_fipe']})",
            )

    def test_doors_and_horsepower_tiebreakers(self):
        catalog = _make_catalog(
            [
                ("008032-2", "Audi", "A3 1.6 3p", 2000, "Gasolina", 15924),
                ("008040-3", "Audi", "A3 1.6 5p", 2000, "Gasolina", 19221),
                ("008046-2", "Audi", "A3 1.8 Turbo 3p Aut.", 2002, "Gasolina", 26628),
                ("008073-0", "Audi", "A3 1.8 Turbo 180cv 3p Aut./ Tip.", 2002, "Gasolina", 21312),
            ]
        )
        items = [
            {
                "id": "a3_5p",
                "brand": "Audi",
                "model": "A3",
                "version": "1.6 5P",
                "year": 2000,
                "title": "Audi A3 1.6 5P 2000",
            },
            {
                "id": "a3_turbo_base",
                "brand": "Audi",
                "model": "A3",
                "version": "1.8 Turbo 3P Aut.",
                "year": 2002,
                "transmission": "Automático",
                "title": "Audi A3 1.8 Turbo 3P Aut. 2002",
            },
            {
                "id": "a3_turbo_180",
                "brand": "Audi",
                "model": "A3",
                "version": "1.8 Turbo 180cv 3P Aut.",
                "year": 2002,
                "transmission": "Automático",
                "title": "Audi A3 1.8 Turbo 180cv 3P Aut. 2002",
            },
        ]
        matches = match_listings_against_catalog(items, catalog)
        self.assertEqual(matches["a3_5p"]["codigo_fipe"], "008040-3")
        self.assertEqual(matches["a3_turbo_base"]["codigo_fipe"], "008046-2")
        self.assertEqual(matches["a3_turbo_180"]["codigo_fipe"], "008073-0")

    def test_does_not_match_cabriolet_when_not_mentioned(self):
        catalog = _make_catalog(
            [
                ("008184-1", "Audi", "A3 Sportback 1.4 TFSI S-tronic", 2015, "Gasolina", 69698),
                ("008190-6", "Audi", "A3 Sportback 1.8 16V TFSI S-tronic", 2015, "Gasolina", 82500),
                ("008195-7", "Audi", "A3 Cabriolet 1.8 16V TFSI 180cv S-tronic", 2015, "Gasolina", 158965),
            ]
        )
        matches = match_listings_against_catalog(
            [
                {
                    "id": "a3_18_plain",
                    "brand": "Audi",
                    "model": "A3",
                    "version": "1.8 TFSI S-tronic",
                    "year": 2015,
                    "transmission": "Automático",
                    "title": "Audi A3 1.8 TFSI S-tronic 2015",
                },
                {
                    "id": "a3_16_bogus",
                    "brand": "Audi",
                    "model": "A3",
                    "version": "1.6 3P",
                    "year": 2015,
                    "title": "Audi A3 1.6 3P 2015",
                },
            ],
            catalog,
        )
        self.assertEqual(matches["a3_18_plain"]["codigo_fipe"], "008190-6")
        if "a3_16_bogus" in matches:
            self.assertNotEqual(matches["a3_16_bogus"]["codigo_fipe"], "008195-7")


if __name__ == "__main__":
    unittest.main()
