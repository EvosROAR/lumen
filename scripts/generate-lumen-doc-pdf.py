"""Generate a text-layer PDF about Lumen (no OCR needed for ingest)."""
from __future__ import annotations

import os
from pathlib import Path

from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Lumen-Dokumentasi-Sistem.pdf"


def register_fonts() -> tuple[str, str]:
    candidates = [
        (r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
        (r"C:\Windows\Fonts\calibri.ttf", r"C:\Windows\Fonts\calibrib.ttf"),
        (r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\segoeuib.ttf"),
    ]
    for regular, bold in candidates:
        if os.path.exists(regular):
            pdfmetrics.registerFont(TTFont("Body", regular))
            if os.path.exists(bold):
                pdfmetrics.registerFont(TTFont("BodyBold", bold))
                return "Body", "BodyBold"
            return "Body", "Body"
    return "Helvetica", "Helvetica-Bold"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font_body, font_bold = register_fonts()

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="Dokumentasi Sistem Lumen — AI Knowledge Desk",
        author="Lumen Project",
        subject="Dokumentasi teknis sistem RAG Lumen untuk indexing dan evaluasi",
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName=font_bold,
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSub",
            fontName=font_body,
            fontSize=12,
            leading=16,
            alignment=TA_CENTER,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1ID",
            fontName=font_bold,
            fontSize=14,
            leading=18,
            spaceBefore=14,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2ID",
            fontName=font_bold,
            fontSize=12,
            leading=16,
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyID",
            fontName=font_body,
            fontSize=10.5,
            leading=15,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletID",
            fontName=font_body,
            fontSize=10.5,
            leading=14,
            leftIndent=12,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="FooterNote",
            fontName=font_body,
            fontSize=9,
            leading=12,
            textColor="#333333",
            spaceBefore=10,
        )
    )

    story: list = []

    def h1(text: str) -> None:
        story.append(Paragraph(text, styles["H1ID"]))

    def h2(text: str) -> None:
        story.append(Paragraph(text, styles["H2ID"]))

    def p(text: str) -> None:
        story.append(Paragraph(text, styles["BodyID"]))

    def b(text: str) -> None:
        story.append(Paragraph(f"• {text}", styles["BulletID"]))

    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("LUMEN", styles["CoverTitle"]))
    story.append(
        Paragraph(
            "AI Knowledge Desk berbasis Retrieval Augmented Generation (RAG)",
            styles["CoverSub"],
        )
    )
    story.append(Spacer(1, 0.6 * cm))
    story.append(
        Paragraph(
            "Dokumentasi Sistem (Teks Asli — siap diindeks tanpa OCR)",
            styles["CoverSub"],
        )
    )
    story.append(
        Paragraph(
            "Versi dokumen: 1.1 | Target: evaluasi retrieval, demo skripsi, Q&A sidang, self-check",
            styles["CoverSub"],
        )
    )
    story.append(PageBreak())

    h1("1. Pendahuluan")
    p(
        "Lumen adalah sistem knowledge desk berbasis Retrieval Augmented Generation (RAG). "
        "Sistem ini memungkinkan pengguna mengunggah dokumen, lalu mengajukan pertanyaan dan "
        "menerima jawaban yang dilengkapi sitasi sumber. Fokus utamanya bukan chatbot generik, "
        "melainkan pipeline pencarian informasi dokumen yang dapat diukur secara objektif."
    )
    p(
        "Dokumen ini ditulis sebagai teks asli (bukan hasil scan atau gambar) agar Lumen dapat "
        "mengekstrak isinya secara langsung saat diunggah ke pustaka. Isi dokumen dapat dipakai "
        "sebagai materi uji, bahan demo, dan referensi ringkas arsitektur sistem."
    )

    h1("2. Tujuan Sistem")
    b("Menyediakan tanya jawab dokumen dengan jawaban yang dapat dilacak ke sumber.")
    b("Membandingkan tiga mode retrieval: Vector, BM25, dan Hybrid.")
    b("Mengukur kualitas retrieval menggunakan Recall@K dan Precision@K.")
    b("Memisahkan data antar pengguna melalui autentikasi multi-user.")
    b("Mencatat latency retrieve dan generate untuk analisis performa.")

    h1("3. Ruang Lingkup")
    p(
        "Lumen mendukung format dokumen teks .txt, .md, dan PDF berbasis teks. PDF hasil scan "
        "tanpa lapisan teks tidak didukung secara andal karena ekstraksi bergantung pada teks "
        "yang tertanam di file, bukan OCR. Setelah diunggah, dokumen dipecah menjadi chunk, "
        "diberi embedding, lalu disimpan per akun pengguna."
    )

    h1("4. Arsitektur Ringkas")
    p("Alur utama sistem adalah sebagai berikut:")
    b("Ingest: unggah dokumen, ekstrak teks, chunking, embedding, simpan ke store.")
    b("Retrieve: cari chunk relevan dengan Vector, BM25, atau Hybrid.")
    b("Generate: model bahasa menyusun jawaban hanya dari konteks yang ditemukan.")
    b("Cite: tampilkan sitasi sumber beserta skor retrieval.")
    b("Evaluate: uji golden set dan catat metrik serta latency.")
    p(
        "Stack utama: Next.js (App Router), TypeScript, Supabase Auth dan Postgres, "
        "embedding lokal, serta Groq untuk generasi jawaban streaming."
    )

    h1("5. Autentikasi dan Isolasi Data")
    p(
        "Setiap pengguna masuk dengan email/password atau Google OAuth melalui Supabase Auth. "
        "Dokumen, chunk, percakapan, log query, dan golden set dieksekusi per user_id. "
        "Dengan demikian, akun yang berbeda tidak saling melihat pustaka dokumen satu sama lain. "
        "Ini penting untuk skenario multi-user dan untuk menjaga privasi materi uji."
    )

    h1("6. Metode Retrieval")
    h2("6.1 Vector Retrieval")
    p(
        "Vector retrieval mencari kemiripan semantik antara pertanyaan dan chunk dokumen "
        "menggunakan embedding. Metode ini kuat pada parafrase, misalnya pertanyaan "
        '"masa berlaku kontrak" dapat menemukan bagian "jangka waktu perjanjian". '
        "Kelemahannya, keyword eksak seperti angka atau kode pasal kadang kurang menonjol."
    )
    h2("6.2 BM25")
    p(
        "BM25 adalah metode ranking berbasis frekuensi kata (leksikal). Metode ini kuat pada "
        "istilah unik, angka, nama file, atau frasa yang muncul secara eksplisit di dokumen. "
        "Kelemahannya muncul saat pertanyaan diparafrase jauh dari kata-kata di dokumen."
    )
    h2("6.3 Hybrid Retrieval")
    p(
        "Hybrid menggabungkan skor Vector dan BM25 setelah normalisasi. Pada Lumen, bobot "
        "default adalah 0.55 untuk vector dan 0.45 untuk BM25. Bobot ini merupakan heuristik "
        "awal (sedikit lebih berat ke semantik), bukan hasil grid search formal. Mode Hybrid "
        "dipakai sebagai default pada chat. Halaman eksperimen menyediakan perbandingan "
        "berdampingan ketiga mode untuk analisis."
    )
    p(
        "Untuk memperkuat justifikasi ilmiah, analisis sensitivitas bobot dapat dilakukan "
        "pada golden set, misalnya kombinasi (0.3/0.7), (0.4/0.6), (0.5/0.5), (0.55/0.45), "
        "(0.6/0.4), dan (0.7/0.3). Konfigurasi dengan performa terbaik pada set uji yang "
        "terpisah dari set pengembangan dapat dilaporkan sebagai temuan empiris."
    )
    p(
        "Catatan penting: skor peringkat pertama yang bernilai 1.0 pada suatu mode sering "
        "berasal dari normalisasi relatif di dalam mode tersebut. Skor 1.0 berarti chunk "
        "tersebut terbaik di mode itu, bukan jaminan jawaban mutlak benar."
    )

    h1("7. Generasi Jawaban dan Sitasi")
    p(
        "Setelah retrieval, sistem membangun konteks dari top-K chunk. Model bahasa menjawab "
        "dalam bahasa yang sama dengan pertanyaan pengguna dan diinstruksikan untuk tidak "
        "mengarang fakta di luar konteks. Jawaban menyertakan rujukan sumber. Jika konteks "
        "tidak cukup, sistem diharapkan mengakui keterbatasan dokumen."
    )
    p(
        "Fitur tambahan mencakup ringkasan map-reduce untuk merangkum seluruh pustaka, serta "
        "riwayat percakapan yang tersimpan per pengguna."
    )

    h1("8. Evaluasi Golden Set")
    p(
        "Evaluasi retrieval memakai golden set: pasangan pertanyaan dan filename dokumen yang "
        "diharapkan. Evaluasi bersifat document-level hit: sebuah kasus disebut HIT jika "
        "minimal satu expected filename muncul di hasil top-K; jika tidak, disebut MISS. "
        "Fokus evaluasi adalah kualitas retrieval, bukan kebenaran kalimat jawaban LLM."
    )
    p("Metrik yang dilaporkan pada antarmuka evaluasi:")
    b(
        "Ukuran keberhasilan retrieval pada K (disebut Recall@K di antarmuka): proporsi "
        "pertanyaan yang menemukan dokumen diharapkan di top-K, dihitung dari agregasi "
        "document-level hit."
    )
    b("Precision@K: proporsi hasil top-K yang relevan terhadap harapan.")
    b("Hits: jumlah kasus HIT dibanding total kasus.")
    p(
        "Catatan terminologi: definisi di atas mengikuti implementasi Lumen (binary success "
        "per query terhadap expected document). Saat sidang, lebih aman menjelaskan sebagai "
        "document-level hit / keberhasilan retrieval pada K, lalu merujuk label Recall@K "
        "sebagai nama metrik di sistem."
    )
    p(
        "Pengguna dapat membuat golden set sendiri sesuai dokumen yang diunggah. Contoh: jika "
        "dokumen bernama Lumen-Dokumentasi-Sistem.pdf, pertanyaan evaluasi harus memasang "
        "expected filename yang sama agar metrik bermakna. Idealnya, set pengembangan "
        "(untuk memilih bobot/K) dipisah dari set uji (untuk melaporkan hasil akhir)."
    )

    h1("9. Logging Latency dan Metrik")
    p(
        "Setiap query chat dan eksperimen dapat dicatat untuk analisis. Metrik yang umum "
        "diamati meliputi retrieve_ms, generate_ms, total_ms, jumlah sitasi, dan daftar "
        "filename sitasi. Data ini berguna untuk pembahasan hasil dan perbandingan overhead "
        "antar mode retrieval."
    )

    h1("10. Halaman Aplikasi")
    b("Desk: unggah dokumen, chat, riwayat, rangkum semua.")
    b("Eksperimen: bandingkan Vector, BM25, dan Hybrid pada query yang sama.")
    b("Eval: kelola golden set dan jalankan Recall@K / Precision@K.")
    b("Metrik: lihat log latency dan ekspor CSV.")
    b("Login: autentikasi email/password atau Google.")

    h1("11. Pertanyaan Evaluasi Contoh untuk Dokumen Ini")
    p(
        "Bagian berikut sengaja ditulis agar Lumen dapat menguji dirinya sendiri setelah "
        "dokumen diindeks. Expected filename yang disarankan: Lumen-Dokumentasi-Sistem.pdf"
    )
    b("Apa kepanjangan RAG pada sistem Lumen?")
    b("Berapa bobot default hybrid retrieval di Lumen untuk vector dan BM25?")
    b("Apakah bobot Hybrid 0.55/0.45 hasil optimasi formal atau heuristik?")
    b("Metrik apa yang dipakai untuk mengevaluasi retrieval di Lumen?")
    b("Bagaimana Lumen mendefinisikan HIT pada evaluasi golden set?")
    b("Format dokumen apa saja yang didukung Lumen?")
    b("Mengapa PDF hasil scan kurang cocok untuk diindeks di Lumen?")
    b("Apa perbedaan utama Vector retrieval dan BM25?")
    b("Mode retrieval apa yang menjadi default pada fitur chat Lumen?")
    b("Apa fokus penelitian Lumen: chatbot atau evaluasi retrieval?")
    b("Sebutkan dua cara login yang didukung Lumen.")

    h1("12. Jawaban Ringkas (Hint untuk Penyusun Golden Set)")
    b("RAG: Retrieval Augmented Generation.")
    b("Hybrid default: 0.55 vector dan 0.45 BM25.")
    b("Bobot 0.55/0.45: heuristik awal, belum grid search formal.")
    b(
        "Metrik utama di antarmuka: Recall@K (agregasi document-level hit) dan Precision@K."
    )
    b("HIT: expected filename muncul di top-K.")
    b("Format: .txt, .md, dan PDF berbasis teks.")
    b("Scan PDF kurang cocok karena tidak ada lapisan teks untuk diekstrak tanpa OCR.")
    b("Vector: semantik; BM25: leksikal/keyword.")
    b("Default chat: Hybrid.")
    b("Fokus penelitian: evaluasi retrieval dalam pipeline RAG; chat adalah antarmuka.")
    b("Login: email/password dan Google OAuth.")

    h1("13. Pertanyaan dan Jawaban untuk Sidang / Penguji")
    p(
        "Bagian ini merangkum posisi ilmiah sistem Lumen. Chat adalah antarmuka; fokus "
        "penelitian adalah evaluasi metode retrieval dalam pipeline RAG. Jawaban disusun "
        "jujur terhadap implementasi: tidak mengklaim optimasi yang belum dilakukan."
    )

    h2("13.1 Mengapa menggunakan RAG?")
    p(
        "Model bahasa saja cenderung mengarang. RAG memisahkan retrieve (mencari fakta dari "
        "dokumen) dan generate (menyusun jawaban dari konteks yang ditemukan). Jawaban lebih "
        "terikat sumber, dapat disitasi, dan corpus dapat diganti tanpa fine-tune ulang model."
    )

    h2("13.2 Mengapa membandingkan Vector, BM25, dan Hybrid?")
    p(
        "Ketiga mode menangkap relevansi secara berbeda. Perbandingan mengubah klaim "
        '"Hybrid lebih bagus" menjadi pertanyaan empiris: apakah Hybrid memang lebih baik '
        "pada corpus dan query yang sama, diukur dengan metrik retrieval. Ini framing "
        "penelitian, bukan sekadar pilihan fitur produk."
    )

    h2("13.3 Apa kelebihan dan kekurangan masing-masing?")
    b(
        "Vector: kuat pada parafrase dan sinonim; lemah pada angka, kode, atau istilah unik "
        "yang jarang menonjol di ruang embedding."
    )
    b(
        "BM25: kuat pada keyword eksak, angka, dan frasa yang muncul eksplisit; lemah jika "
        "pertanyaan diparafrase jauh dari kata di dokumen."
    )
    b(
        "Hybrid: menyeimbangkan semantik dan leksikal; lebih kompleks dan memerlukan "
        "justifikasi bobot penggabungan."
    )

    h2("13.4 Mengapa bobot Hybrid 0,55 Vector dan 0,45 BM25?")
    p(
        "Pada implementasi awal, 0,55/0,45 dipakai sebagai heuristik dengan sedikit bobot "
        "lebih besar pada semantic retrieval. Bobot tersebut belum merupakan hasil optimasi "
        "formal. Oleh karena itu, analisis sensitivitas bobot pada golden set dapat dilakukan "
        "untuk mengetahui konfigurasi yang memberikan performa terbaik. Jika konfigurasi "
        "lain ternyata lebih baik, itu justru temuan empiris yang memperkuat penelitian."
    )

    h2("13.5 Bagaimana menentukan bahwa sebuah retrieval adalah HIT?")
    p(
        "Untuk satu pertanyaan golden, HIT terjadi jika minimal satu expected filename "
        "muncul di top-K hasil retrieval; jika tidak, MISS. Ini adalah document-level hit "
        "yang mengukur kualitas retrieval, bukan menilai apakah kalimat jawaban LLM benar."
    )

    h2("13.6 Bagaimana membentuk golden set?")
    b("Tentukan corpus dokumen yang diindeks.")
    b("Buat pertanyaan yang jawabannya memang ada di dokumen.")
    b("Pasangkan dengan expected filename yang benar dan selaras dengan pustaka.")
    b("Variasikan tipe query: keyword eksak dan parafrase.")
    b(
        "Idealnya pisahkan set pengembangan (memilih bobot/K) dari set uji "
        "(melaporkan hasil akhir) agar tidak bias."
    )

    h2("13.7 Mengapa menggunakan ukuran keberhasilan pada K dan Precision@K?")
    p(
        "Pada implementasi Lumen, evaluasi retrieval menggunakan pendekatan document-level "
        "hit: apakah expected document ditemukan pada top-K. Karena setiap query dalam golden "
        "set memiliki expected document, hasil agregasinya digunakan sebagai ukuran "
        "keberhasilan retrieval pada K tertentu (ditampilkan sebagai Recall@K di antarmuka). "
        "Precision@K mengukur proporsi hasil top-K yang relevan terhadap harapan. Keduanya "
        "memungkinkan evaluasi objektif tanpa bergantung pada penilaian kualitas bahasa "
        "jawaban generatif."
    )

    h2("13.8 Mengapa K misalnya 3, 5, atau 10?")
    p(
        "K kecil (sekitar 3 hingga 5) mendekati konteks chat nyata agar prompt tidak terlalu "
        "panjang. K lebih besar (misalnya 10) dipakai untuk melihat apakah dokumen relevan "
        "masih muncul meskipun tidak di puncak peringkat. Membandingkan beberapa nilai K "
        "menunjukkan trade-off: K naik sering menaikkan keberhasilan menemukan dokumen, "
        "tetapi Precision@K dapat turun."
    )

    h2("13.9 Bagaimana memastikan dataset tidak bias?")
    b("Corpus dan golden set harus selaras (jangan evaluasi corpus A dengan golden B).")
    b("Campur tipe pertanyaan (eksak dan parafrase).")
    b("Hindari pertanyaan yang hanya bisa dijawab dari judul atau nama file.")
    b("Jangan menyesuaikan bobot atau mode hanya pada sedikit query yang dihafal.")
    b(
        "Pisahkan set pengembangan dan set uji, atau minimal laporkan hasil di beberapa K "
        "dan tiga mode retrieval."
    )

    h2("13.10 Apa kontribusi penelitian?")
    p(
        "Perlu dipisahkan kontribusi implementasi dan kontribusi penelitian. Kontribusi "
        "implementasi meliputi RAG end-to-end, sitasi, multi-user dengan autentikasi, serta "
        "dashboard evaluasi dan eksperimen. Kontribusi penelitian yang menjadi pusat skripsi "
        "meliputi eksperimen Vector versus BM25 versus Hybrid, analisis pengaruh K, analisis "
        "trade-off antara keberhasilan retrieval dan precision, analisis bobot Hybrid "
        "(termasuk sensitivitas bila dilakukan), serta pengujian pada corpus dan golden set "
        "yang sama. Novelty penelitian jangan digambarkan sekadar sebagai pembuatan chatbot."
    )

    h2("13.11 Contoh dialog singkat dengan penguji")
    p(
        "Penguji: Mengapa tidak langsung memakai Hybrid saja? Jawaban: Karena belum tentu "
        "Hybrid selalu terbaik. Oleh karena itu Vector, BM25, dan Hybrid dibandingkan secara "
        "empiris pada corpus dan query yang sama menggunakan metrik retrieval."
    )
    p(
        "Penguji: Mengapa bobotnya 55 berbanding 45? Jawaban: Itu heuristik awal dengan "
        "sedikit preferensi semantik, belum optimasi formal. Analisis sensitivitas bobot "
        "dapat menentukan konfigurasi terbaik berdasarkan golden set."
    )
    p(
        "Penguji: Kalau LLM yang menjawab, mengapa tidak mengevaluasi jawaban LLM? Jawaban: "
        "Fokus penelitian berada pada tahap retrieval: apakah sistem menemukan sumber relevan "
        "sebelum konteks diberikan ke model generatif. Evaluasi utama memakai golden set dan "
        "metrik berbasis top-K."
    )
    p(
        "Penguji: Berarti penelitian ini bukan tentang chatbot? Jawaban: Benar. Chat "
        "merupakan antarmuka sistem. Fokus penelitian adalah evaluasi metode retrieval dalam "
        "pipeline RAG."
    )

    h1("14. Batasan Sistem")
    b("Kualitas jawaban bergantung pada kualitas chunk yang terambil.")
    b(
        "Jika corpus tidak relevan dengan pertanyaan, retrieval tetap mengembalikan chunk "
        "terbaik yang tersedia, meskipun topiknya kurang cocok."
    )
    b(
        "Evaluasi yang bermakna membutuhkan golden set yang selaras dengan dokumen di "
        "pustaka pengguna."
    )
    b(
        "Bobot Hybrid default bersifat heuristik hingga dilakukan analisis sensitivitas "
        "dan pelaporan pada set uji."
    )
    b(
        "Generasi jawaban memakai model eksternal; ketersediaan layanan memengaruhi latency "
        "dan keandalan."
    )

    h1("15. Kesimpulan")
    p(
        "Lumen adalah sistem tanya jawab dokumen berbasis RAG dengan hybrid retrieval, sitasi "
        "sumber, isolasi multi-user, serta perangkat evaluasi yang terukur. Chat adalah "
        "antarmuka; inti ilmiahnya adalah perbandingan dan pengukuran retrieval. Dokumen ini "
        "berfungsi sebagai spesifikasi ringkas, materi uji self-check, dan ringkasan posisi "
        "jawaban untuk sidang: setelah diunggah, sistem seharusnya mampu menjawab pertanyaan "
        "tentang arsitektur, metode retrieval, metrik evaluasi, kontribusi, dan batasan Lumen "
        "berdasarkan teks di dalam dokumen ini."
    )

    story.append(
        Paragraph(
            "Akhir dokumen. Teks ini disengaja sebagai lapisan teks asli agar ekstraksi PDF "
            "tidak memerlukan OCR.",
            styles["FooterNote"],
        )
    )

    doc.build(story)
    print(f"WROTE {OUT}")

    from pypdf import PdfReader

    reader = PdfReader(str(OUT))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    print(f"PAGES {len(reader.pages)}")
    print(f"CHARS {len(text)}")
    assert "Hybrid" in text
    assert "Recall@K" in text
    assert "0.55" in text
    assert "document-level hit" in text
    assert "heuristik" in text
    assert "evaluasi metode retrieval" in text
    assert "tanpa OCR" in text or "tanpa OCR" in text.replace("\n", " ")
    print("TEXT_LAYER_OK")


if __name__ == "__main__":
    main()
