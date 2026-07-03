#!/usr/bin/env python3
"""Build fixed rootfs + OTA zip, deploy to camera via HTTP (no SSH)."""
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path("/home/lll/atomcam_tools")
HOST = "10.0.0.228"
SQUASH_IN = REPO / "target/rootfs_hack.squashfs"
WORK = Path("/tmp/rootfs-webui-fix")
WWW_STAGING = Path("/tmp/web-new-var-www")
OUT_SQUASH = Path("/tmp/rootfs_hack_webui_fix.squashfs")
STAGE = Path("/tmp/ota-stage")
ZIP_PATH = Path("/tmp/webui-fix.zip")
HTTP_PORT = 8877
GIT = "/tmp/git_commit.py"


def run(cmd, **kw):
    print("+", " ".join(cmd) if isinstance(cmd, list) else cmd)
    return subprocess.run(cmd, check=True, **kw)


def commit(msg, *files):
    if Path(GIT).exists():
        run(["python3", GIT, msg, *files])


def fix_local_build():
    lb = REPO / "buildscripts/local_build.sh"
    text = lb.read_text()
    old = """  find $TARGET_DIR/var/www -type f \\( -name '*.js' -o -name '*.css' \\) ! -name '*.gz' ! -name '*.br' | while read -r f; do
    [ -f "${f}.gz" ] && rm -f "$f"
  done"""
    new = """  # .js は lighttpd rewrite で .gz を配信。.css は実機 lighttpd 未更新時の互換のため非圧縮も残す。
  find $TARGET_DIR/var/www -type f -name '*.js' ! -name '*.gz' ! -name '*.br' | while read -r f; do
    [ -f "${f}.gz" ] && rm -f "$f"
  done"""
    if old in text:
        lb.write_text(text.replace(old, new), newline="\n")
        commit("fix(build): CSS 非圧縮を残し旧 lighttpd でも新 UI を表示", "buildscripts/local_build.sh")


def build_web_assets():
    run(["bash", str(REPO / "scripts/hil/verify-webui-build.sh")], cwd=REPO)
    if WWW_STAGING.exists():
        shutil.rmtree(WWW_STAGING)
    WWW_STAGING.mkdir()
    with open("/tmp/web-www.tar", "wb") as out:
        run(
            [
                "docker", "compose", "exec", "-T", "builder",
                "bash", "-lc",
                "cd /atomtools/build/buildroot-2026.02.1/output/target/var/www && tar cf - .",
            ],
            cwd=REPO,
            stdout=out,
        )
    run(["tar", "-xf", "/tmp/web-www.tar", "-C", str(WWW_STAGING)])


def repack_rootfs():
    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir()
    run(["unsquashfs", "-d", str(WORK), "-f", str(SQUASH_IN)])
    dest = WORK / "var/www"
    for pat in ("bundle_*",):
        for p in dest.glob(pat):
            p.unlink(missing_ok=True)
    for name in ("index.html", "index.html.gz", "index.html.br"):
        (dest / name).unlink(missing_ok=True)
    for sub in ("assets", "locales", ".vite"):
        d = dest / sub
        if d.exists():
            shutil.rmtree(d)
        src = WWW_STAGING / sub
        if src.exists():
            shutil.copytree(src, dest / sub)
    for name in (
        "index.html", "index.html.gz", "index.html.br",
        "poster.svg", "poster.svg.gz", "poster.svg.br",
    ):
        src = WWW_STAGING / name
        if src.exists():
            shutil.copy2(src, dest / name)
    # overlay lighttpd（.css rewrite 含む）
    lt_src = REPO / "overlay_rootfs/etc/lighttpd/lighttpd.conf"
    lt_dst = WORK / "etc/lighttpd/lighttpd.conf"
    lt_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(lt_src, lt_dst)
    if OUT_SQUASH.exists():
        OUT_SQUASH.unlink()
    if shutil.which("fakeroot"):
        run(["fakeroot", "mksquashfs", str(WORK), str(OUT_SQUASH), "-comp", "xz", "-noappend", "-no-progress"])
    else:
        run(["mksquashfs", str(WORK), str(OUT_SQUASH), "-comp", "xz", "-noappend", "-no-progress"])
    print("squashfs", OUT_SQUASH.stat().st_size)


def make_zip():
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir()
    for name in ("factory_t31_ZMC6tiIDQN", "hostname", "authorized_keys"):
        shutil.copy2(REPO / "target" / name, STAGE / name)
    shutil.copy2(OUT_SQUASH, STAGE / "rootfs_hack.squashfs")
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    run(["zip", "-j", str(ZIP_PATH), *(str(STAGE / n) for n in os.listdir(STAGE))])
    print("zip", ZIP_PATH.stat().st_size)


def lan_ip():
    r = subprocess.run(
        ["bash", "-lc", f"ip route get {HOST} | awk '{{print $7; exit}}'"],
        capture_output=True,
        text=True,
    )
    ip = r.stdout.strip()
    if not ip:
        raise SystemExit("cannot determine LAN IP toward camera")
    return ip


def http_get(url):
    with urllib.request.urlopen(url, timeout=15) as res:
        return res.read().decode()


def parse_hack_ini(text):
    cfg = {}
    for line in text.splitlines():
        if not line.strip() or "=" not in line:
            continue
        k, v = line.split("=", 1)
        cfg[k.strip()] = v.strip()
    return cfg


def http_post_json(url, data: bytes, content_type="application/json"):
    req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": content_type})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read()


def ota_deploy(zip_url: str):
    ini_text = http_get(f"http://{HOST}/cgi-bin/hack_ini.cgi")
    cfg = parse_hack_ini(ini_text)
    cfg["CUSTOM_ZIP"] = "on"
    cfg["CUSTOM_ZIP_URL"] = zip_url
    # hack_ini.cgi POST は JSON オブジェクトを受け取る（Setting.vue 互換）
    body = json.dumps(cfg).encode()
    http_post_json(f"http://{HOST}/cgi-bin/hack_ini.cgi", body)
    print("hack_ini CUSTOM_ZIP_URL set")
  # update はバックグラウンドで curl+reboot するため短いタイムアウトでよい
    try:
        http_post_json(
            f"http://{HOST}/cgi-bin/cmd.cgi",
            json.dumps({"exec": "update"}).encode(),
        )
    except urllib.error.HTTPError:
        pass
    except TimeoutError:
        pass
    print("update triggered")


def wait_up(timeout=300):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            html = http_get(f"http://{HOST}/")
            if "/assets/" in html:
                css_m = re.search(r'href="(\./assets/[^"]+\.css)"', html)
                if css_m:
                    css_path = css_m.group(1).replace("./", "/")
                    req = urllib.request.Request(f"http://{HOST}{css_path}")
                    with urllib.request.urlopen(req, timeout=10) as res:
                        if res.status == 200:
                            print("OK new UI css", css_path, res.status)
                            return True
        except Exception as e:
            print("wait:", e)
        time.sleep(15)
    return False


def main():
    fix_local_build()
    build_web_assets()
    repack_rootfs()
    make_zip()
    # リポジトリへ手順スクリプトを保存
    ota_sh = REPO / "scripts/hil/ota-webui-fix.sh"
    shutil.copy2("/tmp/ota-webui-fix.sh", ota_sh)
    os.chmod(ota_sh, 0o755)
    shutil.copy2("/tmp/ota-webui-fix.py", "/tmp/ota-webui-fix.py")
    ip = lan_ip()
    zip_url = f"http://{ip}:{HTTP_PORT}/webui-fix.zip"
    # HTTP server
    serve_dir = ZIP_PATH.parent
    srv = subprocess.Popen(
        ["python3", "-m", "http.server", str(HTTP_PORT), "--bind", ip],
        cwd=serve_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(1)
        ota_deploy(zip_url)
        ok = wait_up()
        if not ok:
            raise SystemExit("OTA done but CSS check failed")
        commit(
            "fix(hil): OTA webui-fix 手順と CSS/lighttpd 互換",
            "scripts/hil/ota-webui-fix.sh",
            "buildscripts/local_build.sh",
        )
    finally:
        srv.terminate()


if __name__ == "__main__":
    main()
