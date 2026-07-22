# Bundled timetable OCR data

`eng.traineddata.gz` and `chi_sim.traineddata.gz` are the compact
`4.0.0_best_int` language files distributed by `@tesseract.js-data/eng` and
`@tesseract.js-data/chi_sim` version 1.0.0.

They are bundled so the Vercel analysis function does not download OCR models
from a third-party CDN during a cold start. The npm language-data packages are
published under the MIT license; the underlying Tesseract trained data is
distributed under Apache-2.0.
