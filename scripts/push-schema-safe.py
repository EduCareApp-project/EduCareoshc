"""Run the development schema push with a real TTY and refuse truncation.

Drizzle's interactive constraint prompt does not consume piped `n` reliably.
Only the explicit, highlighted no-truncation choice is answered automatically.
"""
import errno
import os
import pty
import re
import select
import subprocess
import sys
import time

master, slave = pty.openpty()
child = subprocess.Popen(
    ["pnpm", "--filter", "@workspace/db", "run", "push-force"],
    stdin=slave, stdout=slave, stderr=slave, close_fds=True,
)
os.close(slave)
pending = ""
failed = False
completed = False
started = time.monotonic()
try:
    while True:
        if time.monotonic() - started > 150:
            raise RuntimeError("Schema push did not finish. No destructive choice was approved.")
        ready, _, _ = select.select([master], [], [], 1)
        if ready:
            try:
                chunk = os.read(master, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    break
                raise
            if not chunk:
                break
            sys.stdout.buffer.write(chunk)
            sys.stdout.buffer.flush()
            pending += re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", chunk.decode("utf-8", "replace"))
            failed |= bool(re.search(r"(?:^|\n)\s*(?:error|[A-Za-z]+Error):", pending))
            completed |= "Changes applied" in pending or "No changes detected" in pending
            if re.search(r"❯\s*No, add (?:the )?constraint without truncating", pending) and "Yes, truncate" in pending:
                os.write(master, b"\r")
                pending = ""
            if len(pending) > 20000:
                pending = pending[-10000:]
        if child.poll() is not None and not ready:
            break
    result = child.wait(timeout=10)
    if result or failed or not completed:
        raise RuntimeError(f"Development schema push failed with exit status {result}")
finally:
    if child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
    os.close(master)
