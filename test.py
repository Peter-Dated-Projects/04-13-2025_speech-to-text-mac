import ffmpeg

ffmpeg.input("backend/static/audio/recording_pt2oCHNgj1A2ySkFAAAB.webm").output(
    "backend/static/audio/recording_pt2oCHNgj1A2ySkFAAAB.wav",
    ar=16000,
    ac=1,
    acodec="pcm_s16le",
    format="wav",
).run(quiet=False, overwrite_output=True)
