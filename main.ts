// Solmar Heat — the entry program for the make.fun gta6-01 bounty.
// This is a plain Node 22 program using only the standard library. It takes
// the game (game/) and its screenshots (screenshots/) from beside this file,
// copies them into the output directory, and writes the dossier.json that
// the judge reads, using the vendored make.fun library.
//
// The grader runs this program twice and expects identical bytes both
// times, so there is no timestamp, randomness or environment-dependent
// content in anything written here. Outside the grader, set
// MAKEFUN_OUTPUT_DIR to choose where the output goes:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the playable game and the screenshots, then write the dossier.
// The limits mirror the gate so a build that would be refused fails here
// first: at most 4 screenshots of 256 KiB, at most 993 game files totalling
// 48 MiB, no game path longer than 1000 bytes, and a 160 KiB dossier text.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
