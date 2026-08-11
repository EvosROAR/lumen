"""Download 30 Indonesian regulation documents from ID_REG_MD_RAG (HF)."""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parents[1] / "docs" / "datasets" / "id-reg-md-rag-30"
MANIFEST = OUT_DIR / "MANIFEST.json"
SOURCE = "https://huggingface.co/datasets/Azzindani/ID_REG_MD_RAG"
LICENSE = "CC BY 4.0"


def fetch_rows(offset: int, length: int = 100) -> list[dict]:
    qs = urllib.parse.urlencode(
        {
            "dataset": "Azzindani/ID_REG_MD_RAG",
            "config": "default",
            "split": "train",
            "offset": offset,
            "length": length,
        }
    )
    url = f"https://datasets-server.huggingface.co/rows?{qs}"
    req = urllib.request.Request(url, headers={"User-Agent": "lumen-thesis-dataset/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return [item["row"] for item in data.get("rows", [])]


def safe_filename(text: str, max_len: int = 80) -> str:
    text = re.sub(r"[^\w\s\-().]", "", text, flags=re.UNICODE)
    text = re.sub(r"\s+", "-", text.strip())
    text = text.strip("-_") or "dokumen"
    return text[:max_len]


def reg_key(row: dict) -> str:
    return "|".join(
        [
            str(row.get("regulation_type") or ""),
            str(row.get("regulation_number") or ""),
            str(row.get("year") or ""),
            str(row.get("about") or ""),
        ]
    )


def build_markdown(meta: dict, chunks: list[dict]) -> str:
    chunks_sorted = sorted(
        chunks,
        key=lambda r: (
            str(r.get("chapter") or ""),
            str(r.get("article") or ""),
            int(r.get("chunk_id") or 0),
        ),
    )
    lines = [
        f"# {meta['regulation_type']} Nomor {meta['regulation_number']} Tahun {meta['year']}",
        "",
        f"**Tentang:** {meta['about']}",
        f"**Lembaga:** {meta['enacting_body']}",
        f"**Tanggal berlaku:** {meta.get('effective_date') or '-'}",
        "",
        "> Sumber dataset: Azzindani/ID_REG_MD_RAG (Hugging Face), lisensi CC BY 4.0.",
        "> Teks peraturan berasal dari repositori publik; verifikasi ke Lembaran Negara untuk keperluan hukum resmi.",
        "",
        "---",
        "",
    ]
    last_chapter = None
    for row in chunks_sorted:
        chapter = str(row.get("chapter") or "").strip()
        article = str(row.get("article") or "").strip()
        content = str(row.get("content") or "").strip()
        if not content:
            continue
        if chapter and chapter != "N/A" and chapter != last_chapter:
            lines.append(f"## {chapter}")
            lines.append("")
            last_chapter = chapter
        if article and article != "N/A":
            lines.append(f"### {article}")
            lines.append("")
        lines.append(content)
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.md"):
        old.unlink()

    grouped: dict[str, list[dict]] = defaultdict(list)
    offset = 0
    page = 100
    max_scan = 12000  # scan enough chunks to gather diverse regs

    print("Fetching rows from Hugging Face datasets-server...")
    while offset < max_scan and len(grouped) < 200:
        try:
            rows = fetch_rows(offset, page)
        except Exception as exc:  # noqa: BLE001
            print(f"offset={offset} error={exc}; retrying...")
            time.sleep(2)
            rows = fetch_rows(offset, page)
        if not rows:
            break
        for row in rows:
            about = str(row.get("about") or "").strip()
            if not about or about.lower() in {"no description", "n/a", "-"}:
                continue
            content = str(row.get("content") or "").strip()
            if len(content) < 40:
                continue
            slim = {
                k: row.get(k)
                for k in (
                    "regulation_type",
                    "enacting_body",
                    "regulation_number",
                    "year",
                    "about",
                    "effective_date",
                    "chapter",
                    "article",
                    "content",
                    "chunk_id",
                )
            }
            grouped[reg_key(row)].append(slim)
        offset += page
        if offset % 1000 == 0:
            print(f"  scanned {offset} chunks -> {len(grouped)} regulations")

    # Score candidates: prefer mid-size, complete-looking docs
    candidates = []
    for key, chunks in grouped.items():
        meta = chunks[0]
        text_len = sum(len(str(c.get("content") or "")) for c in chunks)
        if text_len < 2500 or text_len > 80_000:
            continue
        if len(chunks) < 3:
            continue
        candidates.append((text_len, len(chunks), key, meta, chunks))

    # Prefer longer + more chunks, but keep size spread
    candidates.sort(key=lambda x: (x[1], x[0]), reverse=True)
    selected = []
    seen_types: set[str] = set()
    seen_years: set[str] = set()

    # Pass 1: diversify type + year
    for text_len, nchunks, key, meta, chunks in candidates:
        rtype = str(meta.get("regulation_type") or "")
        year = str(meta.get("year") or "")
        if len(selected) < 20 and (rtype in seen_types and year in seen_years):
            continue
        selected.append((text_len, nchunks, key, meta, chunks))
        seen_types.add(rtype)
        seen_years.add(year)
        if len(selected) >= 30:
            break

    if len(selected) < 30:
        have = {k for _, _, k, _, _ in selected}
        for item in candidates:
            if item[2] in have:
                continue
            selected.append(item)
            if len(selected) >= 30:
                break

    selected = selected[:30]
    if len(selected) < 30:
        raise SystemExit(f"Only found {len(selected)} usable regulations; widen filters.")
    manifest = {
        "source_dataset": SOURCE,
        "license": LICENSE,
        "attribution": [
            "Dataset Curator: Azzindani (Hugging Face Datasets)",
            "Original Source: Government of the Republic of Indonesia (public regulations)",
        ],
        "note": "Dokumen digabung dari chunk pasal pada dataset ID_REG_MD_RAG untuk eksperimen RAG skripsi.",
        "count": len(selected),
        "documents": [],
    }

    for i, (text_len, nchunks, key, meta, chunks) in enumerate(selected, 1):
        rtype = str(meta.get("regulation_type") or "PERATURAN")
        num = str(meta.get("regulation_number") or "X")
        year = str(meta.get("year") or "0000")
        about = str(meta.get("about") or "tanpa-judul")
        fname = f"{i:02d}-{safe_filename(rtype)}-{safe_filename(num)}-{year}-{safe_filename(about)}.md"
        # keep filename shorter for upload UX
        if len(fname) > 120:
            fname = f"{i:02d}-{safe_filename(rtype)}-{safe_filename(num)}-{year}.md"
        md = build_markdown(meta, chunks)
        path = OUT_DIR / fname
        path.write_text(md, encoding="utf-8")
        manifest["documents"].append(
            {
                "index": i,
                "filename": fname,
                "regulation_type": rtype,
                "regulation_number": num,
                "year": year,
                "about": about,
                "chunk_count": len(chunks),
                "chars": len(md),
            }
        )
        print(f"[{i:02d}/30] {fname} ({len(md)} chars, {len(chunks)} chunks)")

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    readme = OUT_DIR / "README.txt"
    readme.write_text(
        "\n".join(
            [
                "Dataset subset untuk eksperimen Lumen (skripsi)",
                f"Sumber: {SOURCE}",
                f"Lisensi: {LICENSE}",
                "Atribusi wajib: Azzindani (kurator) + peraturan publik RI.",
                "",
                "Cara pakai:",
                "1. Unggah file .md (bukan README/MANIFEST) ke Desk Lumen.",
                "2. Buat golden set yang expected_filenames-nya sama persis dengan nama file.",
                "3. Cantumkan sumber & lisensi di bab metode skripsi.",
                "",
                f"Jumlah dokumen: {len(selected)}",
            ]
        ),
        encoding="utf-8",
    )
    print(f"\nDONE -> {OUT_DIR}")
    print(f"Manifest -> {MANIFEST}")


if __name__ == "__main__":
    main()
