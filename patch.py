with open('generate_excel.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'def escape_xml(text):\n    return text.replace("&", "&amp;").replace("<", "<").replace(">", ">").replace(\'"\', "")',
    'def escape_xml(text):\n    return text.replace("&", "&amp;").replace("<", "<").replace(">", ">").replace(\'"\', """)'
)

with open('generate_excel.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Patched successfully')

