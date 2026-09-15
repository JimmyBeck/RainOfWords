#!/usr/bin/env python3
"""
PocketBay 自动化部署工具
遵循 Zero-Leak 规范：
1. 项目路径基于脚本自身位置动态解析 (os.path.abspath(__file__))，严禁出现开发者本地绝对路径。
2. 设备凭据从环境变量 POCKETBAY_DEVICE_SECRET 或 ~/.pocketbay/credentials.json 安全读取，严禁硬编码。
"""

import os
import sys
import json
import time
import tarfile
import urllib.request
import urllib.error

# 动态解析项目根目录（基于当前脚本路径）
TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(TOOLS_DIR)
API_BASE = "https://pocketbay.com/api"


def get_device_secret():
    # 1. 优先读取环境变量
    secret = os.environ.get("POCKETBAY_DEVICE_SECRET")
    if secret:
        return secret

    # 2. 从本地受信任凭据文件读取
    cred_file = os.path.join(os.path.expanduser("~"), ".pocketbay", "credentials.json")
    if os.path.exists(cred_file):
        try:
            with open(cred_file, "r", encoding="utf-8") as f:
                creds = json.load(f)
            token = creds.get("https://pocketbay.com", {}).get("_device", {}).get("token")
            if token:
                return token
        except Exception:
            pass

    print("[提示] 未检测到 POCKETBAY_DEVICE_SECRET 环境变量或已保存凭据。")
    print("可设置环境变量后重新执行：export POCKETBAY_DEVICE_SECRET=<your_secret>")
    sys.exit(1)


def create_archive(output_path):
    print(f"[PocketBay] 正在打包项目目录: {os.path.basename(PROJECT_ROOT)} ...")
    exclude_prefixes = {".git", ".DS_Store", "Thumbs.db", "__pycache__"}

    with tarfile.open(output_path, "w:gz") as tar:
        for root, dirs, files in os.walk(PROJECT_ROOT):
            # 过滤排除目录
            dirs[:] = [d for d in dirs if not any(d.startswith(p) for p in exclude_prefixes)]
            for file in files:
                if any(file.startswith(p) for p in exclude_prefixes):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, PROJECT_ROOT)
                tar.add(full_path, arcname=rel_path)

    print(f"[PocketBay] 打包完成: {output_path}")


def main():
    secret = get_device_secret()
    archive_path = os.path.join("/tmp", f"pocketbay_deploy_{int(time.time())}.tar.gz")

    try:
        create_archive(archive_path)
        print("[PocketBay] 准备上传至部署会话...")
        # 后续可通过标准 multipart/form-data 请求上传至 /api/deploy/sessions/upload
    finally:
        if os.path.exists(archive_path):
            os.remove(archive_path)


if __name__ == "__main__":
    main()
