"""Deterministic demo seed. Scapia starts >= DTC (WAITING) so the demo can drop it."""
from __future__ import annotations

from sqlmodel import Session, select

from .db import ENGINE, now_iso
from .models import CrawlRun, DtcSource, Product
from .service import fold_crawl_runs

# (id, name, image, scapia_price, dtc_label, dtc_url, dtc_price)
PRODUCTS = [
    ("gully-baaz-faris-black", "Gully Number 001 – Baaz Faris Black",
     "https://gullylabs.com/cdn/shop/files/farizbArtboard2_b0544d4f-f302-48e1-adb0-ec74f4ce78f8.webp?v=1785930065&width=800",
     7490, "Gully Labs",
     "https://gullylabs.com/collections/men/products/gully-number-001-baaz-faris-black-men?variant=50760423735580",
     3790),
    ("gully-dvaita-calico-white", "Gully Number 001 – Dvaita Calico White",
     "https://gullylabs.com/cdn/shop/files/DSC09865_ec6f692e-8cfc-4299-9a8d-effb8de4b797.jpg?v=1780482933&width=800",
     8990, "Gully Labs",
     "https://gullylabs.com/collections/men/products/gully-number-001-dvaita-calico-white-men",
     5990),
    ("gully-khoj-green", "Gully Number 001 – Khoj Green",
     "https://gullylabs.com/cdn/shop/files/DSC09465_348d9638-071e-47fb-a1f3-15d98eccc2b9.jpg?v=1780478947&width=800",
     7990, "Gully Labs",
     "https://gullylabs.com/collections/men/products/gl001-khoj-green",
     5990),
    ("gully-raga-aandhi-kobicha", "Gully Number 001 X Raga – Aandhi Kobicha",
     "https://gullylabs.com/cdn/shop/files/DSC08304_a39268ef-de55-4793-801d-6d6634d28192.jpg?v=1780383187&width=800",
     9490, "Gully Labs",
     "https://gullylabs.com/products/raga-shoe-m",
     5990),
    ("gully-baaz-kopal-green", "Gully Number 001 – Baaz Kopal Green",
     "https://gullylabs.com/cdn/shop/files/kopalmw.webp?v=1785930014&width=800",
     7990, "Gully Labs",
     "https://gullylabs.com/products/gully-number-001-baaz-jasta-green",
     3990),
    ("gully-002-wizard-red", "Gully Number 002 – 1980 Wizard Red",
     "https://gullylabs.com/cdn/shop/files/DSC04100_16b95721-4630-4b4f-b79d-f62c4e087b50.jpg?v=1780385907&width=800",
     9990, "Gully Labs",
     "https://gullylabs.com/collections/gully-number-002-the-vintage-trainers/products/gully-number-002-1980-wizard-red-unisex",
     5990),
    ("gully-002-gati-beige", "Gully Number 002 – Gati Beige",
     "https://gullylabs.com/cdn/shop/files/gati_beige.png?v=1782307140&width=800",
     8490, "Gully Labs",
     "https://gullylabs.com/collections/gully-number-002-the-vintage-trainers/products/gully-number-002-gati-beige",
     3990),
]


def seed(force: bool = False) -> None:
    with Session(ENGINE) as session:
        if not force and session.exec(select(Product)).first():
            return
        now = now_iso()
        for pid, name, img, scapia_price, dtc_label, dtc_url, dtc_price in PRODUCTS:
            session.add(Product(
                id=pid, title=name, image_url=img, price=scapia_price,
                created_at=now, updated_at=now,
            ))
            session.flush()  # parent must exist before FK children
            dtc = DtcSource(
                id=f"{pid}:DTC", product_id=pid, label=dtc_label, url=dtc_url,
                created_at=now, updated_at=now,
            )
            session.add(dtc)
            session.flush()
            # DTC price is born from a (mock) crawl_run, like the real crawler
            session.add(CrawlRun(
                dtc_source_id=dtc.id, status="OK", price=dtc_price,
                product_name=name, confidence=0.97, crawled_at=now,
            ))
        session.commit()
        fold_crawl_runs(session)


if __name__ == "__main__":
    from .db import init_db
    init_db(reset=True)
    seed(force=True)
    print("seeded", len(PRODUCTS), "products")
