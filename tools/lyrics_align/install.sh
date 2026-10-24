#!/usr/bin/env bash
# Everything the lyric worker needs on the GitHub runner. Kept in a script so it can change without touching main.
set -euo pipefail
pip install torch==2.7.0 torchaudio==2.7.0 --index-url https://download.pytorch.org/whl/cpu
pip install numpy requests uroman demucs
sudo apt-get update -qq
sudo apt-get install -y -qq ffmpeg espeak-ng
