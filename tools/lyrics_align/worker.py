#!/usr/bin/env python3
"""Sommyart lyric timing worker (runs inside the "Align lyrics" GitHub Action).

For each waiting job it downloads the song, lines the pasted lyrics up with the audio ("forced alignment") and
sends back the start time of every line and word. It does NOT guess the words: the artist's text is the truth.

Model: torchaudio's MMS_FA bundle (wav2vec2 trained on ~1,100 languages, works on romanized letters).
Not yet verified on sung audio or on Igbo / Yoruba / Lingala; the review screen in Studio is there for that reason.

  python worker.py             process every waiting job
  python worker.py --selftest  generate a short synthetic speech clip and check the timing it reports
"""
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import traceback
import unicodedata
import wave

import numpy as np
import requests

SR = 16000
STRIDE = 320  # audio samples per model frame (20 ms)
WINDOW = 30 * SR
CONTEXT = 2 * SR
MAX_SECONDS = 15 * 60
AUDIENCE = "sommyart-lyrics-worker"
# Lines like [Chorus] or (x2) are labels, not lyrics.
HEADER = re.compile(r"^\s*(\[[^\]]*\]|\(?\s*x\s*\d+\s*\)?)\s*$", re.IGNORECASE)

_extra = {"æ": "ae", "œ": "oe", "ø": "o", "ß": "ss", "đ": "d", "ł": "l", "ð": "d", "þ": "th", "ı": "i"}
_uroman = None
_bundle = None
_model = None
_dict = None


# ------------------------------------------------------------------ talking to the app

def id_token():
    r = requests.get(
        os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=" + AUDIENCE,
        headers={"Authorization": "bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["value"]


def call(action, **body):
    r = requests.post(
        os.environ["WORKER_URL"],
        json={"action": action, **body},
        headers={"Authorization": "Bearer " + id_token()},
        timeout=60,
    )
    if r.status_code != 200:
        raise RuntimeError(f"{action}: HTTP {r.status_code} {r.text[:200]}")
    return r.json()


# ------------------------------------------------------------------ text

def load_model():
    global _bundle, _model, _dict
    if _model is None:
        import torch
        import torchaudio

        _bundle = torchaudio.pipelines.MMS_FA
        _dict = {k: v for k, v in _bundle.get_dict(star=None).items() if k != "-"}
        _model = _bundle.get_model(with_star=False)
        _model.eval()
        torch.set_grad_enabled(False)
        print(f"model ready, {len(_dict)} letters: {''.join(sorted(_dict))}", flush=True)
    return _model


def romanize(word):
    """Turn one word into the plain a-z letters the model knows. Returns '' when nothing usable is left."""
    global _uroman
    needs_roman = any(c.isalpha() and not unicodedata.name(c, "").startswith("LATIN") for c in word)
    s = word
    if needs_roman:
        try:
            if _uroman is None:
                import uroman as ur

                _uroman = ur.Uroman()
            s = _uroman.romanize_string(word)
        except Exception as e:  # fall back to plain accent stripping
            print("uroman unavailable:", repr(e)[:120], flush=True)
    s = s.lower()
    for k, v in _extra.items():
        s = s.replace(k, v)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("’", "'").replace("`", "'")
    return "".join(c for c in s if c in _dict)


def parse_lines(text):
    out = []
    for raw in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw.strip()
        if not line or HEADER.match(line):
            continue
        out.append(line)
    return out


# ------------------------------------------------------------------ audio

def decode(path):
    p = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True,
    )
    if p.returncode != 0:
        raise RuntimeError("Could not read the audio file: " + p.stderr.decode(errors="ignore")[:150])
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def isolate_vocals(path):
    """Strip the instruments (Demucs 'htdemucs'), because the aligner listens for a voice and music confuses it."""
    import torch
    import torchaudio
    from demucs.api import Separator

    p = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-ac", "2", "-ar", "44100", "-f", "f32le", "-"],
        capture_output=True,
    )
    if p.returncode != 0:
        raise RuntimeError("Could not read the audio file: " + p.stderr.decode(errors="ignore")[:150])
    x = torch.from_numpy(np.frombuffer(p.stdout, dtype=np.float32).copy()).reshape(-1, 2).T.contiguous()
    sep = Separator(model="htdemucs", device="cpu", shifts=0, progress=False)
    _, stems = sep.separate_tensor(x, 44100)
    vocals = stems["vocals"].mean(0, keepdim=True)
    return torchaudio.functional.resample(vocals, 44100, SR)[0].numpy().astype(np.float32)


def emissions(wave_np):
    """Log-probabilities per 20 ms frame, computed 30 s at a time (with 2 s of context on each side)."""
    import torch

    model = load_model()
    n = len(wave_np)
    x = (wave_np - wave_np.mean()) / (wave_np.std() + 1e-7)
    nwin = math.ceil(n / WINDOW)
    padded = np.pad(x, (CONTEXT, nwin * WINDOW - n + CONTEXT))
    cf, wf = CONTEXT // STRIDE, WINDOW // STRIDE
    out = []
    for i in range(nwin):
        seg = torch.from_numpy(padded[i * WINDOW: i * WINDOW + WINDOW + 2 * CONTEXT]).unsqueeze(0)
        em, _ = model(seg)
        em = torch.log_softmax(em[0], dim=-1).numpy()
        out.append(em[cf: cf + wf])
        print(f"  window {i + 1}/{nwin}", flush=True)
    em = np.concatenate(out, axis=0)
    return em[: math.ceil(n / STRIDE)]


# ------------------------------------------------------------------ alignment (CTC Viterbi)

def viterbi(lp, tokens):
    """lp: (T, C) log-probs with blank = 0. tokens: list of ids. Returns per-token (first_frame, last_frame, score)."""
    T, L = lp.shape[0], len(tokens)
    if L == 0:
        return []
    if T < L:
        raise RuntimeError("The lyrics are too long for this audio")
    S = 2 * L + 1
    labels = np.zeros(S, dtype=np.int64)
    labels[1::2] = tokens
    can_skip = np.zeros(S, dtype=bool)  # may jump over the blank before a new, different token
    for s in range(3, S, 2):
        can_skip[s] = labels[s] != labels[s - 2]
    NEG = -1e30
    alpha = np.full(S, NEG, dtype=np.float64)
    alpha[0] = lp[0, 0]
    alpha[1] = lp[0, labels[1]]
    back = np.zeros((T, S), dtype=np.int8)  # 0 stay, 1 from s-1, 2 from s-2
    for t in range(1, T):
        c1 = np.full(S, NEG)
        c1[1:] = alpha[:-1]
        c2 = np.full(S, NEG)
        c2[2:] = np.where(can_skip[2:], alpha[:-2], NEG)
        stack = np.stack([alpha, c1, c2])
        k = stack.argmax(axis=0)
        back[t] = k
        alpha = stack[k, np.arange(S)] + lp[t, labels]
    s = S - 1 if alpha[S - 1] >= alpha[S - 2] else S - 2
    path = np.zeros(T, dtype=np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(back[t, s])
    spans = []
    for i in range(L):
        frames = np.nonzero(path == 2 * i + 1)[0]
        if len(frames) == 0:  # should not happen, but never crash on it
            frames = np.array([0])
        sc = float(np.exp(lp[frames, tokens[i]]).mean())
        spans.append((int(frames[0]), int(frames[-1]), sc))
    return spans


def align(wave_np, lyrics_text):
    load_model()  # also sets up the letter table that text cleaning needs
    lines = parse_lines(lyrics_text)
    if not lines:
        raise RuntimeError("There are no lyrics to line up")
    words = []  # (line index, text, letters)
    for li, line in enumerate(lines):
        for w in line.split():
            words.append((li, w, romanize(w)))
    tokens, owner = [], []
    for wi, (_, _, letters) in enumerate(words):
        for ch in letters:
            tokens.append(_dict[ch])
            owner.append(wi)
    if len(tokens) < 3:
        raise RuntimeError("The lyrics have too few letters the model understands")
    lp = emissions(wave_np)
    spans = viterbi(lp, tokens)
    per_word = {}
    for tok_i, wi in enumerate(owner):
        per_word.setdefault(wi, []).append(spans[tok_i])
    sec = STRIDE / SR
    timed = {}
    for wi, sp in per_word.items():
        timed[wi] = (
            round(sp[0][0] * sec, 2),
            round((sp[-1][1] + 1) * sec, 2),
            round(float(np.mean([s[2] for s in sp])), 3),
        )
    out_lines = []
    for li, line in enumerate(lines):
        ws = []
        for wi, (l2, text, _) in enumerate(words):
            if l2 != li:
                continue
            item = {"w": text}
            if wi in timed:
                item["t"], item["e"], item["c"] = timed[wi]
            ws.append(item)
        got = [w for w in ws if "t" in w]
        out_lines.append({
            "text": line,
            "t": got[0]["t"] if got else None,
            "end": got[-1]["e"] if got else None,
            "conf": round(float(np.mean([w["c"] for w in got])), 3) if got else 0.0,
            "words": ws,
        })
    # Lines with no usable letters (e.g. "(x2)") borrow the time of the line before them.
    prev = 0.0
    for ln in out_lines:
        if ln["t"] is None:
            ln["t"], ln["end"] = prev, prev
        ln["t"] = max(ln["t"], prev)
        prev = ln["t"]
    return {
        "engine": "torchaudio MMS_FA",
        "audio_seconds": round(len(wave_np) / SR, 1),
        "lines": out_lines,
        "avg_conf": round(float(np.mean([l["conf"] for l in out_lines])), 3),
    }


# ------------------------------------------------------------------ jobs

def run_jobs():
    done = 0
    while True:
        job = call("claim").get("job")
        if not job:
            break
        print(f"job {job['id']} · {job.get('title')}", flush=True)
        try:
            with tempfile.TemporaryDirectory() as d:
                path = os.path.join(d, "song")
                r = requests.get(job["audio_url"], timeout=120, stream=True)
                r.raise_for_status()
                size = 0
                with open(path, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        size += len(chunk)
                        if size > 120 * 1024 * 1024:
                            raise RuntimeError("The audio file is too big")
                        f.write(chunk)
                audio = decode(path)
                if len(audio) / SR > MAX_SECONDS:
                    raise RuntimeError("Songs longer than 15 minutes are not supported yet")
                if os.environ.get("ISOLATE_VOCALS", "1") == "1":
                    print("  separating vocals…", flush=True)
                    audio = isolate_vocals(path)
            result = align(audio, job["lyrics_text"])
            result["vocals_isolated"] = os.environ.get("ISOLATE_VOCALS", "1") == "1"
            call("complete", id=job["id"], result=result)
            print(f"  done · average confidence {result['avg_conf']}", flush=True)
            done += 1
        except Exception as e:
            traceback.print_exc()
            msg = str(e) or e.__class__.__name__
            try:
                call("fail", id=job["id"], error=msg[:400])
            except Exception:
                traceback.print_exc()
    print(f"finished, {done} job(s) done", flush=True)


# ------------------------------------------------------------------ self test

def selftest():
    """Speak known words with espeak-ng, glue them together with gaps, and see if the aligner finds them."""
    load_model()
    cases = {"Ọlụ Chineke ṅụrị": "olu chineke nuri", "Déjà vu ça va": "deja vu ca va", "Straße": "strasse"}
    for src, want in cases.items():
        got = " ".join(romanize(w) for w in src.split())
        print(f"normalise {src!r} -> {got!r}", "OK" if got == want else f"EXPECTED {want!r}")
    print("hebrew sample ->", repr(romanize("שלום")), "| cyrillic sample ->", repr(romanize("привет")), flush=True)
    norm = "; ".join(f"{k} -> {' '.join(romanize(w) for w in k.split())}" for k in cases) + f" | hebrew {romanize('שלום')!r} | ge'ez-free check"
    print(f"::notice title=text cleaning::{norm}")

    base = ("the lord is my shepherd I shall not want he makes me lie down in green pastures he leads me beside "
            "still waters he restores my soul").split()
    words = (base * 4)[:90]
    rate = 22050
    pieces, truth, t = [], [], 0.0
    gap = np.zeros(int(0.35 * rate), dtype=np.int16)
    with tempfile.TemporaryDirectory() as d:
        for i, w in enumerate(words):
            p = os.path.join(d, f"w{i}.wav")
            subprocess.run(["espeak-ng", "-s", "130", "-w", p, w], check=True)
            with wave.open(p) as wf:
                frames = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16)
                if wf.getframerate() != rate:
                    rate = wf.getframerate()
            pieces += [frames, gap]
            truth.append((t, t + len(frames) / rate))
            t += (len(frames) + len(gap)) / rate
        full = os.path.join(d, "all.wav")
        with wave.open(full, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(rate)
            wf.writeframes(np.concatenate(pieces).tobytes())
        audio = decode(full)
    print(f"synthetic clip: {len(audio) / SR:.1f} s, {len(words)} words", flush=True)
    lines = [" ".join(words[i:i + 6]) for i in range(0, len(words), 6)]
    res = align(audio, "\n".join(lines))
    got = [w for ln in res["lines"] for w in ln["words"]]
    errs = np.array([abs(g["t"] - tr[0]) for g, tr in zip(got, truth)])
    summary = (f"{len(words)} words, {len(audio) / SR:.0f}s | start error median {np.median(errs):.3f}s p90 {np.percentile(errs, 90):.3f}s "
               f"max {errs.max():.3f}s | within 0.15s {np.mean(errs <= 0.15) * 100:.0f}% within 0.30s {np.mean(errs <= 0.30) * 100:.0f}%")
    print(f"::notice title=selftest result::{summary}")
    print(f"start-time error: median {np.median(errs):.3f}s, 90th percentile {np.percentile(errs, 90):.3f}s, max {errs.max():.3f}s")
    print(f"within 0.15 s: {np.mean(errs <= 0.15) * 100:.0f}%   within 0.30 s: {np.mean(errs <= 0.30) * 100:.0f}%")
    print("first line:", json.dumps(res["lines"][0])[:300])
    if np.median(errs) > 0.3:
        print("SELFTEST FAILED")
        sys.exit(1)
    print("SELFTEST PASSED")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        run_jobs()
