# Student Stories demo media

These assets exist only for local visual QA. They are not loaded by the normal
seed and are never installed automatically.

The two source photographs were created with the built-in image-generation
tool using these prompts:

1. A vertical, photorealistic mobile image of a young African international
   student arriving at a modern airport in China, with natural daylight and no
   text, logo, watermark, or Kondo branding.
2. A vertical, photorealistic mobile image of a young African international
   student walking through Jiaxing University campus, with warm morning light
   and no text, logo, watermark, or Kondo branding.

`scripts/render-demo-story-posters.mjs` creates ten honest arrival/campus
compositions from those originals. `scripts/render-demo-story-video.swift`
turns each composition into a five-second H.264 vertical MP4 with a restrained
Ken Burns movement. The committed JPG and MP4 files are the runtime assets; the
large generated source PNG files are intentionally not committed.

To install the dataset into a local database and local media storage:

```bash
KONDO_ALLOW_DEMO_STORIES=true \
STORAGE_DRIVER=local \
npm run stories:demo
```

The installer rejects production, non-local storage, and any database host
that is not a loopback address.
