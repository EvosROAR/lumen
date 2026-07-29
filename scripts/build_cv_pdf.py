"""Generate a clean, single-font CV PDF (Calibri) with consistent typography."""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# Consistent modern font family
pdfmetrics.registerFont(TTFont("Body", r"C:\Windows\Fonts\calibri.ttf"))
pdfmetrics.registerFont(TTFont("BodyBold", r"C:\Windows\Fonts\calibrib.ttf"))
pdfmetrics.registerFont(TTFont("BodyItalic", r"C:\Windows\Fonts\calibrii.ttf"))

OUT_DIR = Path(r"d:\Projects\CV")
OUT_FILES = [
    OUT_DIR / "CV_Nuno_Tamada_EN_links.pdf",
]

PAGE_W, PAGE_H = A4
MARGIN_X = 16 * mm
MARGIN_TOP = 14 * mm
MARGIN_BOTTOM = 12 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

INK = (0.12, 0.12, 0.12)
MUTED = (0.38, 0.38, 0.38)
LINK = (0.06, 0.37, 0.55)  # clickable link color
RULE = (0.82, 0.82, 0.82)


def to_url(link: str) -> str:
    text = link.strip()
    if text.startswith("http://") or text.startswith("https://"):
        return text
    if text.startswith("mailto:"):
        return text
    lower = text.lower()
    if "google play" in lower or "com.konekmarket" in lower:
        return "https://play.google.com/store/apps/details?id=com.konekmarket"
    if text.startswith("github.com/") or text.startswith("linkedin.com/") or text.startswith("cert."):
        return "https://" + text
    if "." in text and " " not in text:
        return "https://" + text
    return text


def draw_link(c, x, y, label, url=None, size=9, font="Body", color=LINK):
    """Draw visible link text + clickable annotation."""
    href = to_url(url or label)
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    c.drawString(x, y, label)
    w = pdfmetrics.stringWidth(label, font, size)
    # PDF y is baseline; annotation box covers the glyph height
    c.linkURL(
        href,
        (x - 0.5, y - 2.0, x + w + 0.5, y + size + 1.0),
        relative=0,
    )
    return w


def draw_rule(c, y):
    c.setStrokeColorRGB(*RULE)
    c.setLineWidth(0.6)
    c.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)


def wrap_text(text, font, size, max_width):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if pdfmetrics.stringWidth(trial, font, size) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def section_heading(c, title, y):
    c.setFont("BodyBold", 11)
    c.setFillColorRGB(*INK)
    c.drawString(MARGIN_X, y, title.upper())
    y -= 2.2 * mm
    draw_rule(c, y)
    return y - 4.2 * mm


def bullet(c, text, y, size=9.5, leading=3.6 * mm, indent=3.5 * mm):
    max_w = CONTENT_W - indent
    lines = wrap_text(text, "Body", size, max_w)
    for i, line in enumerate(lines):
        c.setFillColorRGB(*INK)
        c.setFont("Body", size)
        if i == 0:
            c.drawString(MARGIN_X, y, "•")
            c.drawString(MARGIN_X + indent, y, line)
        else:
            c.drawString(MARGIN_X + indent, y, line)
        y -= leading
    return y


def project_block(c, title, stack, desc, link, y):
    # title left + stack right (same line)
    c.setFont("BodyBold", 10.5)
    c.setFillColorRGB(*INK)
    c.drawString(MARGIN_X, y, title)
    c.setFont("Body", 9)
    c.setFillColorRGB(*MUTED)
    c.drawRightString(PAGE_W - MARGIN_X, y, stack)
    y -= 4.0 * mm

    c.setFillColorRGB(*INK)
    for line in wrap_text(desc, "Body", 9.5, CONTENT_W):
        c.setFont("Body", 9.5)
        c.drawString(MARGIN_X, y, line)
        y -= 3.7 * mm

    draw_link(c, MARGIN_X, y, link, size=9)
    return y - 4.8 * mm


def job_header(c, role_company, dates, y):
    c.setFont("BodyBold", 10.5)
    c.setFillColorRGB(*INK)
    c.drawString(MARGIN_X, y, role_company)
    c.setFont("Body", 9)
    c.setFillColorRGB(*MUTED)
    c.drawRightString(PAGE_W - MARGIN_X, y, dates)
    return y - 4.0 * mm


def build(path: Path):
    c = canvas.Canvas(str(path), pagesize=A4)
    y = PAGE_H - MARGIN_TOP

    # Header
    c.setFont("BodyBold", 20)
    c.setFillColorRGB(*INK)
    c.drawString(MARGIN_X, y, "Nuno Tamada")
    y -= 6 * mm

    c.setFont("Body", 11)
    c.setFillColorRGB(*MUTED)
    c.drawString(MARGIN_X, y, "Web, Mobile & AI Developer")
    y -= 5 * mm

    c.setFont("Body", 9)
    # Email (clickable) + phone/location
    email = "nunotamada12@gmail.com"
    draw_link(c, MARGIN_X, y, email, url="mailto:nunotamada12@gmail.com", size=9)
    c.setFillColorRGB(*MUTED)
    c.setFont("Body", 9)
    c.drawString(
        MARGIN_X + pdfmetrics.stringWidth(email, "Body", 9),
        y,
        "  ·  +62 821-9992-3850  ·  Indonesia — Remote-ready",
    )
    y -= 3.8 * mm

    # GitHub + LinkedIn (clickable)
    c.setFillColorRGB(*MUTED)
    c.setFont("Body", 9)
    c.drawString(MARGIN_X, y, "GitHub: ")
    x = MARGIN_X + pdfmetrics.stringWidth("GitHub: ", "Body", 9)
    draw_link(c, x, y, "github.com/EvosROAR", size=9)
    x += pdfmetrics.stringWidth("github.com/EvosROAR", "Body", 9)
    c.setFillColorRGB(*MUTED)
    c.setFont("Body", 9)
    c.drawString(x, y, "  ·  LinkedIn: ")
    x += pdfmetrics.stringWidth("  ·  LinkedIn: ", "Body", 9)
    draw_link(c, x, y, "linkedin.com/in/nuno-tamada-a69624254", size=9)
    y -= 6.5 * mm

    # Summary
    y = section_heading(c, "Summary", y)
    summary = (
        "Web, mobile, and AI developer experienced in React Native, React/Next.js, and "
        "Flutter-based learning apps. Shipped mobile features for Konek Market (Google Play), "
        "built full-stack web products with Next.js, and developed Lumen — a RAG knowledge desk "
        "with hybrid retrieval, streaming answers, citations, and Recall@K evaluation. "
        "Comfortable with API integration, debugging, and AI-assisted engineering workflows."
    )
    c.setFillColorRGB(*INK)
    for line in wrap_text(summary, "Body", 9.5, CONTENT_W):
        c.setFont("Body", 9.5)
        c.drawString(MARGIN_X, y, line)
        y -= 3.8 * mm
    y -= 3.2 * mm

    # Skills
    y = section_heading(c, "Skills", y)
    skills = [
        ("Languages & Frameworks:", "React Native, React, Next.js, TypeScript, JavaScript, Flutter"),
        ("Backend & Data:", "Firebase, Prisma, PostgreSQL, REST APIs, Axios, Groq (LLM APIs)"),
        ("Practices:", "Git, Debugging, UI from design, API integration, RAG pipelines, retrieval evaluation"),
    ]
    for label, value in skills:
        c.setFont("BodyBold", 9.5)
        c.setFillColorRGB(*INK)
        c.drawString(MARGIN_X, y, label)
        label_w = pdfmetrics.stringWidth(label + " ", "BodyBold", 9.5)
        c.setFont("Body", 9.5)
        c.drawString(MARGIN_X + label_w, y, value)
        y -= 4.0 * mm
    y -= 2.5 * mm

    # Experience
    y = section_heading(c, "Experience", y)

    y = job_header(c, "Mobile Developer Intern — Konek Market", "Aug – Dec 2024", y)
    intro = (
        "Konek Market (“Rekomendasi Internetku”) helps users find, compare, and subscribe to nearby "
        "internet/WiFi providers, manage subscriptions, and submit support tickets."
    )
    c.setFillColorRGB(*INK)
    for line in wrap_text(intro, "BodyItalic", 9.2, CONTENT_W):
        c.setFont("BodyItalic", 9.2)
        c.drawString(MARGIN_X, y, line)
        y -= 3.5 * mm
    y -= 0.8 * mm
    for item in [
        "Developed React Native screens from UI/UX designs with Axios API integration (GET/POST/PUT).",
        "Built Profile, Review & Rating, Promo, ISP/OSP chat, Gangguan (outage) cards, and Onboarding.",
        "Debugged internal-testing issues and verified fixes before handoff; app published on Google Play.",
    ]:
        y = bullet(c, item, y)
    draw_link(
        c,
        MARGIN_X + 3.5 * mm,
        y,
        "play.google.com/store/apps/details?id=com.konekmarket",
        size=9,
    )
    y -= 5.2 * mm

    y = job_header(c, "Drive Test Engineer — YPTT Solutions Indonesia", "Sep – Oct 2021", y)
    for item in [
        "Measured and documented 3G/4G network performance at event venues using Ookla Speedtest and G-MoN Pro.",
        "Reviewed radio KPIs (RSRP, RSRQ, RSSI, SNR) and logged results for operational reporting.",
    ]:
        y = bullet(c, item, y)
    y -= 1.5 * mm

    y = job_header(c, "Teaching Assistant (TJKT) — SMK Negeri 3 Singaraja", "Mar – Jul 2024", y)
    y = bullet(
        c,
        "Assisted practical teaching on fiber handling/splicing, wired network installation, and Windows configuration.",
        y,
    )
    y -= 2.8 * mm

    # Projects
    y = section_heading(c, "Projects", y)

    projects = [
        (
            "Edu App",
            "Flutter · Firebase",
            "Learning app with courses, exercises, streaks, leaderboard, and in-app admin CMS (ID/EN).",
            "edu-app-ec176.web.app",
        ),
        (
            "LearnQuest LMS",
            "Next.js · Prisma",
            "Gamified LMS: courses, quizzes, forums, XP/levels, and progress tracking.",
            "learnquest-lms-59vf.vercel.app",
        ),
        (
            "Lumen — AI Knowledge Desk",
            "Next.js · TypeScript · RAG · Groq",
            "RAG desk: hybrid retrieval (vector + BM25), streaming answers + citations, golden eval (10 docs · ~0.8s · Recall@4 = 100%).",
            "lumen-five-umber.vercel.app",
        ),
        (
            "Konek Market (Mobile)",
            "React Native · Axios",
            "Published internet/WiFi aggregator app — feature implementation + API integration during internship.",
            "play.google.com/store/apps/details?id=com.konekmarket",
        ),
    ]

    for i, (title, stack, desc, link) in enumerate(projects):
        y = project_block(c, title, stack, desc, link, y)
        if i < len(projects) - 1:
            draw_rule(c, y + 1.8 * mm)
            y -= 1.2 * mm

    # Page 2 if needed — education/certs; check remaining space
    if y < MARGIN_BOTTOM + 35 * mm:
        c.showPage()
        y = PAGE_H - MARGIN_TOP

    y = section_heading(c, "Education", y)
    c.setFont("BodyBold", 10.5)
    c.setFillColorRGB(*INK)
    c.drawString(MARGIN_X, y, "Bachelor’s in Informatics Engineering — Universitas Pendidikan Ganesha")
    c.setFont("Body", 9)
    c.setFillColorRGB(*MUTED)
    c.drawRightString(PAGE_W - MARGIN_X, y, "2021 – Present (Expected 2026)")
    y -= 4.0 * mm
    c.setFont("Body", 9.5)
    c.setFillColorRGB(*INK)
    c.drawString(MARGIN_X, y, "Final-year student, currently completing thesis.")
    y -= 6 * mm

    y = section_heading(c, "Languages & Certificates", y)
    c.setFont("Body", 9.5)
    c.setFillColorRGB(*INK)
    c.drawString(MARGIN_X, y, "Indonesian — Native  ·  English — Professional/Conversational (EF SET B2)")
    y -= 4.0 * mm
    c.setFillColorRGB(*MUTED)
    c.setFont("Body", 9)
    c.drawString(MARGIN_X, y, "EF SET English Certificate — ")
    x = MARGIN_X + pdfmetrics.stringWidth("EF SET English Certificate — ", "Body", 9)
    draw_link(c, x, y, "cert.efset.org/en/Kwn1u8", size=9)

    c.save()
    print("saved", path)


def main():
    out = OUT_DIR / "CV_Nuno_Tamada_EN_links.pdf"
    build(out)


if __name__ == "__main__":
    main()
