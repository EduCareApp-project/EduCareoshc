import fitz
src = '.agents/outputs/revised-excursion-form.pdf'
out = '.agents/outputs/revised-excursion-form.png'
doc = fitz.open(src)
pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
pix.save(out)
print(out)
