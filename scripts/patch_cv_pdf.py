"""Make Lumen project block match Edu/LearnQuest layout: 1 desc line + 1 URL line."""
from pathlib import Path
import fitz

cv_dir = Path(r"d:\Projects\CV")

original = None
for f in cv_dir.glob("*.pdf"):
    doc = fitz.open(f)
    text = doc[0].get_text()
    doc.close()
    if (
        "Web & Mobile Developer" in text
        and "evaluation metrics" in text
        and "Recall@4" not in text
    ):
        original = f
        break

if original is None:
    raise SystemExit("Original CV PDF not found (close edited copies / restore original).")

print("source:", repr(original.name))

outs = [
    cv_dir / "CV Web_Mobile - Nuno Tamada (EN).pdf",
    cv_dir / "CV_Nuno_Tamada_EN_updated.pdf",
]

doc = fitz.open(str(original))
page = doc[0]
WHITE = (1, 1, 1)

lumen_stack_rect = lumen_desc_rect = lumen_link_rect = None
for b in page.get_text("dict")["blocks"]:
    if b.get("type") != 0:
        continue
    for line in b.get("lines", []):
        text = "".join(s["text"] for s in line["spans"])
        if line["bbox"][1] < 700:
            continue
        if "TypeScript" in text and "RAG" in text and line["bbox"][0] > 400:
            lumen_stack_rect = fitz.Rect(line["bbox"])
        if "hybrid retrieval" in text and "evaluation metrics" in text:
            lumen_desc_rect = fitz.Rect(line["bbox"])
        if "lumen-five-umber.vercel.app" in text:
            lumen_link_rect = fitz.Rect(line["bbox"])

# Redact stack + old desc + old link
page.add_redact_annot(lumen_stack_rect + (-1, -0.5, 2, 0.5), fill=WHITE)
page.add_redact_annot(lumen_desc_rect + (-1, -0.5, 110, 0.5), fill=WHITE)
if lumen_link_rect:
    page.add_redact_annot(lumen_link_rect + (-1, -0.5, 2, 0.5), fill=WHITE)
page.apply_redactions()

# Stack right-aligned
stack = "Next.js · TypeScript · RAG · Groq"
w = fitz.get_text_length(stack, fontname="helv", fontsize=7.7)
page.insert_text(
    (567.7 - w, lumen_stack_rect.y1 - 1.0),
    stack,
    fontsize=7.7,
    fontname="helv",
    color=(0.35, 0.35, 0.35),
)

# One description line — same rhythm as Edu App / LearnQuest
desc = (
    "RAG desk: hybrid retrieval (vector + BM25), streaming answers + citations, "
    "golden eval (10 docs · ~0.8s · Recall@4 = 100%)."
)
page.insert_text(
    (28.5, lumen_desc_rect.y1 - 1.5),
    desc,
    fontsize=7.8,
    fontname="helv",
    color=(0.18, 0.18, 0.18),
)

# Separate URL line — same as other projects
link_y = (lumen_link_rect.y1 - 1.5) if lumen_link_rect else (lumen_desc_rect.y1 + 12)
page.insert_text(
    (28.5, link_y),
    "lumen-five-umber.vercel.app",
    fontsize=7.8,
    fontname="helv",
    color=(0.25, 0.25, 0.25),
)

for out in outs:
    try:
        doc.save(str(out), garbage=4, deflate=True)
        print("wrote", out)
    except Exception as e:
        print("skip", out, e)

try:
    doc.save(str(original), garbage=4, deflate=True)
    print("updated original")
except Exception as e:
    print("original locked:", e)

doc.close()

v = fitz.open(str(outs[0]))
page = v[0]
print("--- y order ---")
for b in page.get_text("dict")["blocks"]:
    if b.get("type") != 0:
        continue
    for line in b.get("lines", []):
        if line["bbox"][1] > 700:
            t = "".join(s["text"] for s in line["spans"])
            print(f"{line['bbox'][1]:6.1f} {t}")
v.close()
