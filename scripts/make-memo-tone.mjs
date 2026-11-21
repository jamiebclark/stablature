// Writes e2e/fixtures/memo-tone.wav: a deterministic 16-bit mono 8 kHz, 220 Hz sine of about 6 s at -12 dBFS.
// Chromium's fake microphone loops the file, so the level meter moves for as long as a spec records.
import { writeFileSync } from "node:fs";

const rate = 8000;
const seconds = 6;
const samples = rate * seconds;
const amplitude = Math.round(32767 * 10 ** (-12 / 20));
const data = Buffer.alloc(samples * 2);
for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(amplitude * Math.sin((2 * Math.PI * 220 * i) / rate)), i * 2);

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16); // fmt chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

writeFileSync(new URL("../e2e/fixtures/memo-tone.wav", import.meta.url), Buffer.concat([header, data]));
