"""Automated smoke & structural integrity checks for the Noetic Poietic Generator."""

from pathlib import Path
import http.server
import re
import socketserver
import sys
import threading
import urllib.request

ROOT = Path(__file__).resolve().parent.parent


def check_files_and_bindings():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    main_js = (ROOT / "src" / "main.js").read_text(encoding="utf-8")
    i18n_js = (ROOT / "src" / "i18n.js").read_text(encoding="utf-8")

    # 1. Verify every getElementById in main.js exists in index.html
    dom_ids = set(re.findall(r'id="([^"]+)"', html))
    referenced_ids = set(re.findall(r'getElementById\("([^"]+)"\)', main_js))
    missing_ids = referenced_ids - dom_ids
    assert not missing_ids, f"Missing DOM IDs in index.html: {missing_ids}"

    # 2. Verify every data-i18n attribute exists in i18n.js
    i18n_attrs = set(re.findall(r'data-i18n="([^"]+)"', html))
    for key in i18n_attrs:
        assert re.search(rf'\b{re.escape(key)}\s*:', i18n_js), f"Missing i18n key: {key}"

    # 3. Verify all local ES module imports resolve to existing files and exported symbols exist
    js_files = sorted((ROOT / "src").glob("*.js"))
    assert len(js_files) == 11, f"Expected 11 JS modules, found {len(js_files)}"
    for js_file in js_files:
        text = js_file.read_text(encoding="utf-8")
        for names, imp in re.findall(r'import\s+\{([^}]+)\}\s+from\s+"(\.[^"]+)"', text):
            clean_imp = imp.split("?", 1)[0]
            target = (js_file.parent / clean_imp).resolve()
            assert target.exists(), f"Broken import {imp} in {js_file.name}"
            target_text = target.read_text(encoding="utf-8")
            for sym in [n.strip().split(" as ")[0].strip() for n in names.split(",") if n.strip()]:
                pattern = rf'export\s+(?:async\s+)?(?:function|class|const|let|var)\s+{re.escape(sym)}\b'
                assert re.search(pattern, target_text), f"Missing export '{sym}' in {target.name} (imported by {js_file.name})"

    # 4. Verify required GitHub Pages files exist
    for rel in [".nojekyll", ".github/workflows/pages.yml", "README.md", "styles.css"]:
        assert (ROOT / rel).exists(), f"Missing required file: {rel}"

    print(
        f"[OK] Checked {len(js_files)} JS modules, {len(referenced_ids)} DOM bindings, "
        f"{len(i18n_attrs)} i18n keys, and all ES module exports."
    )


def check_static_serving():
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def log_message(self, format, *args):
            pass

    with socketserver.TCPServer(("127.0.0.1", 0), QuietHandler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            paths = [
                "/",
                "/styles.css",
                "/src/main.js",
                "/src/i18n.js",
                "/src/semanticEngine.js",
                "/src/topologyEngine.js",
                "/src/mirrorEngine.js",
                "/src/swarmEngine.js",
                "/src/syncEngine.js",
                "/src/replayEngine.js",
                "/src/renderer.js",
            ]
            for p in paths:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}{p}", timeout=5) as resp:
                    assert resp.status == 200, f"Expected 200 for {p}, got {resp.status}"
                    assert len(resp.read()) > 100, f"Unexpectedly small asset {p}"
        finally:
            httpd.shutdown()

    print(f"[OK] Verified HTTP 200 static serving across all {len(paths)} assets.")


if __name__ == "__main__":
    check_files_and_bindings()
    if "--serve" in sys.argv:
        check_static_serving()
    print("[PASS] All smoke checks succeeded.")
