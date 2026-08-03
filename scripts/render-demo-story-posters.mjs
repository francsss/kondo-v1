import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = resolve(process.cwd(), "assets/demo-stories");
const variants = [
  ["01-arrival-in-china", "01-arrival-in-china.png", "centre", 1, 1, 0],
  ["02-jiaxing-campus", "02-jiaxing-campus.png", "centre", 1, 1, 0],
  ["03-arrival-checklist", "01-arrival-in-china.png", "south", 1.04, 1.08, 4],
  ["04-campus-first-look", "02-jiaxing-campus.png", "north", 1.05, 1.06, -3],
  ["05-travel-light", "01-arrival-in-china.png", "north", 0.98, 0.94, -5],
  ["06-campus-morning", "02-jiaxing-campus.png", "south", 1.08, 1.12, 6],
  ["07-new-city-energy", "01-arrival-in-china.png", "east", 1.06, 1.08, 9],
  ["08-campus-after-class", "02-jiaxing-campus.png", "west", 0.98, 0.92, -8],
  [
    "09-first-week-reflection",
    "01-arrival-in-china.png",
    "west",
    1.02,
    0.88,
    2,
  ],
  ["10-finding-community", "02-jiaxing-campus.png", "east", 1.03, 1.1, 4],
];

await mkdir(root, { recursive: true });

for (const [name, source, position, brightness, saturation, hue] of variants) {
  await sharp(resolve(root, source))
    .resize({ width: 720, height: 1280, fit: "cover", position })
    .modulate({ brightness, saturation, hue })
    .sharpen({ sigma: 0.55 })
    .jpeg({ quality: 86, progressive: true, chromaSubsampling: "4:2:0" })
    .toFile(resolve(root, `${name}.jpg`));
  process.stdout.write(`${name}.jpg\n`);
}
