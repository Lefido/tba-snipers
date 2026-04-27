"""
Génération de fichiers Excel (.xlsx) avec la bibliothèque standard Python.
Crée un ZIP contenant les XML minimaux requis par le format Office Open XML.
Colonnes : Type, Date, Colis annoncés, Colis Flashé
"""
import zipfile
import io
import random
import os
from datetime import datetime, timedelta

TYPES = ["Dispersion 14h", "Arrivée 14h", "Dispersion 18h", "Arrivée 18h", "Concentration"]


def generate_rows(count, date_start, date_end):
    rows = []
    delta = (date_end - date_start).days
    for _ in range(count):
        typ = random.choice(TYPES)
        d = date_start + timedelta(days=random.randint(0, delta))
        date_str = d.strftime("%d/%m/%Y")
        # Colis annoncés entre 50 et 500
        colis_ann = random.randint(50, 500)
        # Colis flashé entre 0 et colis_annoncés (logique métier)
        colis_flash = random.randint(0, colis_ann)
        rows.append([typ, date_str, colis_ann, colis_flash])
    return rows


def escape_xml(text):
    amp = chr(38) + "amp;"
    lt = chr(38) + "lt;"
    gt = chr(38) + "gt;"
    quot = chr(38) + "quot;"
    text = text.replace(chr(38), amp)
    text = text.replace(chr(60), lt)
    text = text.replace(chr(62), gt)
    text = text.replace(chr(34), quot)
    return text


def build_xlsx(rows, out_path):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # [Content_Types].xml
        zf.writestr("[Content_Types].xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>''')

        # _rels/.rels
        zf.writestr("_rels/.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>''')

        # xl/_rels/workbook.xml.rels
        zf.writestr("xl/_rels/workbook.xml.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>''')

        # xl/workbook.xml
        zf.writestr("xl/workbook.xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Données" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>''')

        # xl/styles.xml
        zf.writestr("xl/styles.xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>''')

        # xl/worksheets/sheet1.xml
        sheet_parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n<sheetData>']
        headers = ["Type", "Date", "Colis annoncés", "Colis Flashé"]
        all_rows = [headers] + rows
        for r_idx, row in enumerate(all_rows, 1):
            cells = []
            for c_idx, val in enumerate(row, 1):
                col_letter = chr(64 + c_idx)  # A, B, C, D
                cell_ref = f"{col_letter}{r_idx}"
                safe = escape_xml(str(val))
                cells.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{safe}</t></is></c>')
            sheet_parts.append(f'<row r="{r_idx}">{"".join(cells)}</row>')
        sheet_parts.append('</sheetData>\n</worksheet>')
        zf.writestr("xl/worksheets/sheet1.xml", "\n".join(sheet_parts))

    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    print(f"Created: {out_path} ({len(rows)} data rows)")


if __name__ == "__main__":
    random.seed(42)
    os.makedirs("Exploitation", exist_ok=True)

    # 1. donnees_completes.xlsx  ~100 lignes, jan-avr 2024
    rows1 = generate_rows(100, datetime(2024, 1, 1), datetime(2024, 4, 30))
    build_xlsx(rows1, "donnees_completes.xlsx")

    # 2. donnees_fevrier.xlsx  ~30 lignes, fév 2024
    rows2 = generate_rows(30, datetime(2024, 2, 1), datetime(2024, 2, 29))
    build_xlsx(rows2, "donnees_fevrier.xlsx")

    # 3. Exploitation/donnees_exploitation_q1.xlsx  ~45 lignes, jan-mar 2024
    rows3 = generate_rows(45, datetime(2024, 1, 1), datetime(2024, 3, 31))
    build_xlsx(rows3, "Exploitation/donnees_exploitation_q1.xlsx")

    # 4. Exploitation/donnees_exploitation_mars.xlsx  ~25 lignes, mars 2024
    rows4 = generate_rows(25, datetime(2024, 3, 1), datetime(2024, 3, 31))
    build_xlsx(rows4, "Exploitation/donnees_exploitation_mars.xlsx")

    print("\nTous les fichiers Excel ont été générés avec succès.")

