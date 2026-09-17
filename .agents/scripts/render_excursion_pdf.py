import fitz
from pathlib import Path
src = Path('attached_assets/Forgotten_Island_Movie_Permission_Form_1789608404217.pdf')
out = Path('.agents/outputs/forgotten-island-page-1.png')
doc = fitz.open(src)
page = doc[0]
pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
pix.save(out)
print(f'{doc.page_count} page(s), {page.rect}, rendered {out}')
