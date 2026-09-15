import fitz
from pathlib import Path

source = Path('attached_assets/Excursion_Form_-_Movies_010726_WAL_1789469295482.pdf')
out = Path('.agents/outputs/excursion-form')
doc = fitz.open(source)
print(f'pages={doc.page_count}')
for index, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    target = out / f'page-{index + 1}.png'
    pix.save(target)
    print(target)
