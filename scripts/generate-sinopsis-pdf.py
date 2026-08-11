"""Generate thesis synopsis PDF for Lumen RAG retrieval comparison."""
from __future__ import annotations

import os
from pathlib import Path

from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Sinopsis-Skripsi-Nuno-Tamada.pdf"
OUT_FALLBACK = ROOT / "docs" / "Sinopsis-Skripsi-Nuno-Tamada-revisi.pdf"


def register_fonts() -> tuple[str, str]:
    candidates = [
        (r"C:\Windows\Fonts\times.ttf", r"C:\Windows\Fonts\timesbd.ttf"),
        (r"C:\Windows\Fonts\timesi.ttf", r"C:\Windows\Fonts\timesbi.ttf"),
        (r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
        (r"C:\Windows\Fonts\calibri.ttf", r"C:\Windows\Fonts\calibrib.ttf"),
    ]
    # Prefer Times for academic look
    if os.path.exists(r"C:\Windows\Fonts\times.ttf"):
        pdfmetrics.registerFont(TTFont("Body", r"C:\Windows\Fonts\times.ttf"))
        bold = r"C:\Windows\Fonts\timesbd.ttf"
        if os.path.exists(bold):
            pdfmetrics.registerFont(TTFont("BodyBold", bold))
            return "Body", "BodyBold"
        return "Body", "Body"
    for regular, bold in candidates[2:]:
        if os.path.exists(regular):
            pdfmetrics.registerFont(TTFont("Body", regular))
            if os.path.exists(bold):
                pdfmetrics.registerFont(TTFont("BodyBold", bold))
                return "Body", "BodyBold"
            return "Body", "Body"
    return "Times-Roman", "Times-Bold"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font_body, font_bold = register_fonts()

    out_path = OUT_FALLBACK
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=3 * cm,
        rightMargin=3 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
        title="Sinopsis Skripsi — Nuno Tamada Jackson Jacob",
        author="Nuno Tamada Jackson Jacob",
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TitleID",
            fontName=font_bold,
            fontSize=14,
            leading=18,
            alignment=TA_CENTER,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubTitleID",
            fontName=font_bold,
            fontSize=12,
            leading=16,
            alignment=TA_CENTER,
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MetaID",
            fontName=font_body,
            fontSize=11,
            leading=15,
            alignment=TA_CENTER,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1ID",
            fontName=font_bold,
            fontSize=12,
            leading=16,
            alignment=TA_LEFT,
            spaceBefore=12,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyID",
            fontName=font_body,
            fontSize=11,
            leading=16,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletID",
            fontName=font_body,
            fontSize=11,
            leading=16,
            leftIndent=14,
            spaceAfter=3,
            alignment=TA_JUSTIFY,
        )
    )

    story: list = []

    def h(text: str) -> None:
        story.append(Paragraph(text, styles["H1ID"]))

    def p(text: str) -> None:
        story.append(Paragraph(text, styles["BodyID"]))

    def b(text: str) -> None:
        story.append(Paragraph(f"• {text}", styles["BulletID"]))

    story.append(Paragraph("SINOPSIS SKRIPSI", styles["TitleID"]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            "Perbandingan Vector Retrieval, BM25, dan Hybrid Retrieval "
            "pada Sistem Tanya Jawab Multi-Dokumen Berbasis "
            "Retrieval Augmented Generation (RAG)",
            styles["SubTitleID"],
        )
    )
    story.append(Paragraph("Nama: Nuno Tamada Jackson Jacob", styles["MetaID"]))
    story.append(Paragraph("NIM: 211505144", styles["MetaID"]))
    story.append(Spacer(1, 0.4 * cm))

    h("1. Latar Belakang")
    p(
        "Kebutuhan untuk mendapatkan jawaban yang akurat dari banyak dokumen semakin "
        "meningkat seiring bertambahnya volume informasi digital. Model bahasa besar "
        "(Large Language Model/LLM) memiliki kemampuan memahami dan menghasilkan teks, "
        "namun cenderung memberikan jawaban yang tidak selalu terikat pada sumber yang "
        "jelas. Pendekatan Retrieval Augmented Generation (RAG) menjadi solusi dengan "
        "cara mencari potongan dokumen yang relevan terlebih dahulu, kemudian menyusun "
        "jawaban berdasarkan konteks yang ditemukan."
    )
    p(
        "Kualitas sistem RAG sangat bergantung pada metode retrieval. Vector retrieval "
        "unggul pada pencarian semantik dan parafrase, BM25 unggul pada kecocokan kata "
        "kunci secara leksikal, sedangkan Hybrid Retrieval menggabungkan keduanya. "
        "Meskipun Hybrid sering diasumsikan lebih baik, klaim tersebut perlu dibuktikan "
        "secara empiris pada corpus dan pertanyaan evaluasi yang sama. Oleh karena itu, "
        "penelitian ini berfokus pada perbandingan Vector, BM25, dan Hybrid retrieval "
        "dalam pipeline RAG multi-dokumen berbahasa Indonesia."
    )

    h("2. Rumusan Masalah")
    b(
        "Bagaimana merancang sistem tanya jawab multi-dokumen berbasis RAG yang "
        "dapat digunakan untuk membandingkan metode retrieval?"
    )
    b(
        "Bagaimana perbandingan performa Vector, BM25, dan Hybrid retrieval pada "
        "corpus dan golden set yang sama?"
    )
    b(
        "Bagaimana pengaruh nilai top-K dan bobot Hybrid terhadap kualitas retrieval?"
    )

    h("3. Tujuan Penelitian")
    b(
        "Membangun sistem tanya jawab multi-dokumen berbasis RAG yang dilengkapi "
        "sitasi sumber dan modul evaluasi retrieval."
    )
    b(
        "Membandingkan performa Vector, BM25, dan Hybrid retrieval secara empiris "
        "menggunakan metrik Success@K, Precision@K, MRR, dan latency."
    )
    b(
        "Menganalisis pengaruh nilai top-K dan bobot Hybrid untuk menentukan "
        "konfigurasi retrieval yang lebih baik pada corpus penelitian."
    )

    h("4. Batasan Penelitian")
    b(
        "Fokus evaluasi utama berada pada tahap retrieval, bukan penilaian penuh "
        "kualitas bahasa jawaban LLM."
    )
    b(
        "Corpus penelitian menggunakan dokumen berbahasa Indonesia berlisensi "
        "terbuka, antara lain subset peraturan/regulasi publik."
    )
    b("Format dokumen yang diuji meliputi teks, Markdown, dan PDF berbasis teks.")
    b(
        "Bobot Hybrid awal bersifat heuristik dan selanjutnya diuji melalui "
        "eksperimen sensitivitas."
    )

    h("5. Metodologi Penelitian")
    b("Studi literatur mengenai RAG, embedding, BM25, dan Hybrid retrieval.")
    b(
        "Pembangunan sistem mencakup ingest dokumen, chunking, embedding, retrieval, "
        "generasi jawaban, sitasi, serta modul evaluasi."
    )
    b(
        "Penyusunan corpus sekitar 20–40 dokumen dan golden set sekitar 40–60 "
        "pertanyaan, termasuk pertanyaan yang tidak memiliki jawaban pada corpus."
    )
    b(
        "Pelaksanaan eksperimen: perbandingan Vector, BM25, dan Hybrid; pengujian "
        "K = 3, 5, dan 10; serta pengujian beberapa konfigurasi bobot Hybrid."
    )
    b(
        "Evaluasi menggunakan Success@K (document-level hit), Precision@K, Mean "
        "Reciprocal Rank (MRR), dan latency retrieval."
    )
    b("Analisis hasil eksperimen dan penarikan kesimpulan.")

    h("6. Hasil yang Diharapkan")
    p(
        "Penelitian ini diharapkan menghasilkan prototipe sistem tanya jawab "
        "multi-dokumen berbasis RAG serta temuan empiris mengenai metode retrieval "
        "terbaik pada corpus yang digunakan. Hasil tersebut dapat menjadi dasar "
        "pemilihan strategi retrieval yang terukur, bukan sekadar asumsi bahwa "
        "Hybrid selalu lebih unggul."
    )

    h("7. Kontribusi Penelitian")
    p(
        "Kontribusi utama penelitian adalah perbandingan empiris Vector, BM25, dan "
        "Hybrid retrieval pada pipeline RAG multi-dokumen, dilengkapi analisis "
        "pengaruh top-K dan bobot Hybrid. Implementasi sistem berfungsi sebagai "
        "sarana eksperimen dan demonstrasi, sedangkan fokus ilmiah diarahkan pada "
        "evaluasi metode retrieval."
    )

    doc.build(story)
    print(f"WROTE {out_path}")

    # Also try updating the primary filename if it is not locked.
    try:
        import shutil

        shutil.copyfile(out_path, OUT)
        print(f"COPIED {OUT}")
    except OSError as exc:
        print(f"SKIP primary copy: {exc}")


if __name__ == "__main__":
    main()
