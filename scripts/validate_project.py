#!/usr/bin/env python3
"""Static compatibility and safety checks for the 313 GitHub Pages / Apps Script project."""
from __future__ import annotations

import re
import subprocess
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
CHECKS = 0


def check(condition: bool, message: str) -> None:
    global CHECKS
    CHECKS += 1
    if not condition:
        ERRORS.append(message)


class PageInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.html_attrs: dict[str, str] = {}
        self.title_seen = False
        self.viewport_seen = False
        self.refs: list[tuple[str, str]] = []
        self.scripts: list[tuple[str, str]] = []
        self._in_title = False
        self._in_script = False
        self._script_src = ""
        self._script_type = ""
        self._script_chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {k.lower(): (v or "") for k, v in attrs}
        if tag == "html":
            self.html_attrs = values
        if "id" in values:
            self.ids.append(values["id"])
        if tag == "meta" and values.get("name", "").lower() == "viewport":
            self.viewport_seen = True
        if tag in ("script", "img", "source", "iframe") and values.get("src"):
            self.refs.append(("src", values["src"]))
        if tag == "link" and values.get("href"):
            self.refs.append(("href", values["href"]))
        if tag == "a" and values.get("href"):
            self.refs.append(("href", values["href"]))
        if tag == "script":
            self._in_script = True
            self._script_src = values.get("src", "")
            self._script_type = values.get("type", "").lower()
            self._script_chunks = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag == "script" and self._in_script:
            source = "".join(self._script_chunks)
            if not self._script_src and source.strip() and self._script_type in (
                "", "text/javascript", "application/javascript", "module"
            ):
                self.scripts.append((self._script_type, source))
            self._in_script = False
            self._script_src = ""
            self._script_type = ""
            self._script_chunks = []

    def handle_data(self, data: str) -> None:
        if self._in_script:
            self._script_chunks.append(data)


def run_node_check(source: str, label: str) -> None:
    result = subprocess.run(
        ["node", "--check", "-"],
        input=source,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    check(result.returncode == 0, f"JavaScript syntax error in {label}: {(result.stderr or result.stdout).strip()}")


def check_local_reference(page: Path, value: str) -> None:
    parsed = urlparse(value.strip())
    if parsed.scheme or parsed.netloc or not parsed.path:
        return
    path_part = unquote(parsed.path)
    if path_part.startswith("/"):
        # The site is published from a repository root, so absolute root paths are valid only if present.
        candidate = (ROOT / path_part.lstrip("/")).resolve()
    else:
        candidate = (page.parent / path_part).resolve()
    try:
        candidate.relative_to(ROOT.resolve())
    except ValueError:
        check(False, f"{page.relative_to(ROOT)} contains a path escaping the repository: {value}")
        return
    if candidate.suffix.lower() in {".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".pdf", ".woff", ".woff2"}:
        check(candidate.is_file(), f"Missing local reference in {page.relative_to(ROOT)}: {value}")
    if candidate.suffix.lower() in {".css", ".js"}:
        expected = parse_qs(parsed.query).get("v", [""])[0]
        version_match = re.search(r"\bVERSION\s*:\s*['\"]([^'\"]+)['\"]", (ROOT / "js/main.js").read_text(encoding="utf-8"))
        expected_version = version_match.group(1) if version_match else ""
        check(bool(expected and expected == expected_version),
              f"Missing or stale cache version for {value} in {page.relative_to(ROOT)}; expected v={expected_version}")


def main() -> int:
    main_js_path = ROOT / "js/main.js"
    backend_path = ROOT / "apps-script/Code.gs"
    check(main_js_path.is_file(), "js/main.js is missing")
    check(backend_path.is_file(), "apps-script/Code.gs is missing")
    if not main_js_path.is_file() or not backend_path.is_file():
        return 1

    main_js = main_js_path.read_text(encoding="utf-8")
    backend = backend_path.read_text(encoding="utf-8")
    front = re.search(r"\bVERSION\s*:\s*['\"]([^'\"]+)['\"]", main_js)
    back_ref = re.search(r"\bBACKEND_VERSION\s*:\s*['\"]([^'\"]+)['\"]", main_js)
    back_actual = re.search(r"\bAPP_VERSION\s*=\s*['\"]([^'\"]+)['\"]", backend)
    front_version = front.group(1) if front else ""
    backend_version = back_actual.group(1) if back_actual else ""
    check(bool(front), "Frontend VERSION constant not found in js/main.js")
    check(bool(back_ref), "BACKEND_VERSION constant not found in js/main.js")
    check(bool(back_actual), "APP_VERSION constant not found in apps-script/Code.gs")
    if back_ref and back_actual:
        check(back_ref.group(1) == backend_version,
              f"Frontend expects backend {back_ref.group(1)}, but Code.gs is {backend_version}")

    check(not re.search(r"function\s+getSecret\s*\(\s*\)\s*\{[^}]*['\"]UNINITIALIZED['\"]", backend, re.S),
          "getSecret() still has a known fallback secret")
    issue_token = re.search(r"^function\s+issueToken\b[\s\S]*?(?=^function\s+|\Z)", backend, re.M)
    password_hash = re.search(r"^function\s+memberPasswordHash\b[\s\S]*?(?=^function\s+|\Z)", backend, re.M)
    setup_fn = re.search(r"^function\s+setup\b[\s\S]*?(?=^function\s+|\Z)", backend, re.M)
    check(bool(issue_token) and "ensureSecret()" not in issue_token.group(0),
          "issueToken() must not silently recreate a missing AUTH_SECRET")
    check(bool(password_hash) and "ensureSecret()" not in password_hash.group(0),
          "memberPasswordHash() must not silently rotate the AUTH_SECRET")
    check(bool(setup_fn) and "ensureSecret()" in setup_fn.group(0),
          "setup() should initialize AUTH_SECRET explicitly")
    check("if (!p.photoBase64) throw new Error('عکس رضایت‌نامه پدر الزامی است');" in backend,
          "Backend does not require the consent photo even though the form does")
    check("function uploadConsentPhotoPrivate" in backend and "validImageSignature" in backend,
          "Private consent upload is missing server-side image signature checks")
    register_page = (ROOT / "register.html").read_text(encoding="utf-8")
    check('id="registerForm"' in register_page and 'id="uploadZone"' in register_page
          and 'id="registerStatus"' in register_page,
          "Camp registration page is missing its form, upload control, or status output")
    check("action: 'listCamps'" in main_js and "action: 'registerCamp'" in main_js,
          "Shared RegisterForm in js/main.js is not wired to listCamps/registerCamp")
    check("if (!selectedFile) return showStatus('برای ثبت‌نام، عکس رضایت‌نامه پدر را انتخاب کن.', 'error');" in main_js,
          "Client form does not require the consent photo")
    check("action: 'registerCamp'" not in register_page,
          "register.html must not duplicate the shared form submission handler")
    game_client = (ROOT / "js/game.js").read_text(encoding="utf-8")
    check("gameSessionId:gameSessionId" in game_client and "p.gameSessionId" in backend,
          "Game-session field name differs between browser and backend")
    check("weeklySaved" in game_client and "weeklySaved" in backend,
          "Weekly and lifetime score outcomes are not both surfaced by client and backend")

    attendance_fn = re.search(r"^function\s+saveAttendanceBatch\b[\s\S]*?(?=^function\s+|\Z)", backend, re.M)
    check(bool(attendance_fn)
          and "activeMembersById" in attendance_fn.group(0)
          and "seenMemberIds" in attendance_fn.group(0)
          and "var recordName = (String(member.firstName" in attendance_fn.group(0),
          "Attendance save must reject duplicate/fake members and use canonical member names")
    warning_fn = re.search(r"^function\s+saveWarning\b[\s\S]*?(?=^function\s+|\Z)", backend, re.M)
    check(bool(warning_fn)
          and "getSheetObjects('مسئولین')" in warning_fn.group(0)
          and "truthy(row.active)" in warning_fn.group(0)
          and "responsibility.length > 80" in warning_fn.group(0)
          and "reason.length > 300" in warning_fn.group(0),
          "Warning save must validate active officials and enforce text limits")

    # Keep API action names aligned across every browser JS/HTML entry point and backend dispatcher.
    client_actions: set[str] = set()
    client_files = sorted((ROOT / "js").glob("*.js")) + sorted(ROOT.glob("*.html"))
    for client_file in client_files:
        source = client_file.read_text(encoding="utf-8")
        client_actions.update(re.findall(r"\baction\s*:\s*['\"]([^'\"]+)['\"]", source))
    server_actions = set(re.findall(r"\baction\s*===?\s*['\"]([^'\"]+)['\"]", backend))
    missing_actions = sorted(client_actions - server_actions)
    check(not missing_actions, "Client API action(s) are not handled by Code.gs: " + ", ".join(missing_actions))

    for path in sorted((ROOT / "js").glob("*.js")):
        run_node_check(path.read_text(encoding="utf-8"), str(path.relative_to(ROOT)))
    run_node_check(backend, "apps-script/Code.gs")

    html_paths = sorted(ROOT.glob("*.html"))
    check(len(html_paths) == 16, f"Expected 16 HTML pages, found {len(html_paths)}")
    expected_version = front_version
    known_css_js = set()
    for page in html_paths:
        source = page.read_text(encoding="utf-8")
        inspector = PageInspector()
        try:
            inspector.feed(source)
            inspector.close()
        except Exception as exc:
            check(False, f"HTML parse failure in {page.name}: {exc}")
            continue
        attrs = inspector.html_attrs
        check(attrs.get("lang", "").lower().startswith("fa"), f"{page.name} should declare Persian language")
        check(attrs.get("dir", "").lower() == "rtl", f"{page.name} should declare RTL direction")
        check(bool(re.search(r"<title\b[^>]*>[\s\S]*?</title>", source, re.I)), f"{page.name} is missing a title")
        check(inspector.viewport_seen, f"{page.name} is missing the viewport meta tag")
        counts = Counter(x for x in inspector.ids if x)
        duplicates = sorted(x for x, count in counts.items() if count > 1)
        check(not duplicates, f"{page.name} has duplicate IDs: {', '.join(duplicates)}")
        check(not re.search(r"<img\b(?![^>]*\balt\s*=)[^>]*>", source, re.I),
              f"{page.name} has an image without alt text")
        for kind, value in inspector.refs:
            check_local_reference(page, value)
            parsed = urlparse(value)
            path_part = unquote(parsed.path)
            if parsed.scheme == "" and parsed.netloc == "" and path_part:
                candidate = (page.parent / path_part).resolve()
                if candidate.suffix.lower() in {".js", ".css"}:
                    known_css_js.add(candidate)
        for index, (_, inline_js) in enumerate(inspector.scripts, start=1):
            run_node_check(inline_js, f"{page.name} inline script #{index}")

    for css_path in sorted((ROOT / "css").glob("*.css")):
        css = css_path.read_text(encoding="utf-8")
        clean = re.sub(r"/\*[\s\S]*?\*/", "", css)
        clean = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '""', clean)
        depth = 0
        valid = True
        for char in clean:
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth < 0:
                    valid = False
                    break
        check(valid and depth == 0, f"Unbalanced CSS braces in {css_path.relative_to(ROOT)}")
        for value in re.findall(r"url\(\s*['\"]?([^'\")]+)", css, re.I):
            parsed = urlparse(value.strip())
            if parsed.scheme or parsed.netloc or value.strip().startswith("#") or not parsed.path:
                continue
            target = (css_path.parent / unquote(parsed.path)).resolve()
            try:
                target.relative_to(ROOT.resolve())
            except ValueError:
                check(False, f"{css_path.relative_to(ROOT)} contains a path escaping the repository: {value}")
                continue
            check(target.is_file(), f"Missing CSS URL asset in {css_path.relative_to(ROOT)}: {value}")

    if ERRORS:
        print(f"FAILED: {len(ERRORS)} of {CHECKS} checks did not pass.")
        for error in ERRORS:
            print(f" - {error}")
        return 1
    print(f"PASS: {CHECKS} checks; {len(html_paths)} HTML pages, {len(list((ROOT / 'js').glob('*.js')))} JavaScript files, "
          f"{len(list((ROOT / 'css').glob('*.css')))} stylesheets; frontend {front_version}, backend {backend_version}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
