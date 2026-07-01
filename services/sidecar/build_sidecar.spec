# -*- mode: python ; coding: utf-8 -*-
# Run from services/sidecar/ with:
#   .venv/Scripts/pyinstaller build_sidecar.spec --distpath dist --workpath build/pyinstaller

block_cipher = None

a = Analysis(
    ['sidecar/main.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=[
        # Our own AI provider modules (loaded by string-import in routers/ai.py)
        'sidecar.ai_providers.ollama',
        'sidecar.ai_providers.claude',
        'sidecar.ai_providers.openai_provider',
        'sidecar.ai_providers.groq',
        'sidecar.ai_providers.gemini',
        # uvicorn internals not auto-detected
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # FastAPI / starlette internals
        'anyio',
        'anyio._backends._asyncio',
        'anyio._backends._trio',
        'starlette.routing',
        'email.mime.text',
        'email.mime.multipart',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'PIL._tkinter_finder'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='factor-sidecar',
)
