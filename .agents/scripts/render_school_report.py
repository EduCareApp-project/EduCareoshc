import fitz
from pathlib import Path
src = Path('attached_assets/Elysium_20OSHC_20-_20Aldercourt_20-_20Term_203_20Report_20-_20_1788690361590.pdf')
out = Path('.agents/outputs/school-report-page-1.png')
doc = fitz.open(src)
page = doc[0]
pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
pix.save(out)
print(f'pages={doc.page_count} size={page.rect} images={len(page.get_images(full=True))} output={out}')
