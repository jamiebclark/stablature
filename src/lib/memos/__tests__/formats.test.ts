import { describe, expect, it } from "vitest";
import { chooseFormat, normaliseFormat, parseFormat, sniff } from "../formats";

const FMT_A = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  'audio/mp4; codecs="mp4a.40.5"',
  "audio/mp4;codecs=opus",
  "audio/webm",
  "audio/webm;codecs=opus",
  "AUDIO/WEBM; CODECS=OPUS",
  "audio/ogg",
  "audio/ogg;codecs=opus",
];
const FMT_D = [
  "audio/wav",
  "audio/mpeg",
  "video/webm",
  "audio/webm;codecs=vorbis",
  "audio/webm;codecs=opus,vp8",
  "audio/mp4;codecs=avc1.42E01E",
  "text/html",
  "application/octet-stream",
  "",
  null,
  undefined,
];

describe("parseFormat", () => {
  it.each(FMT_A)("accepts %s", (f) => expect(parseFormat(f)).not.toBeNull());
  it.each(FMT_D)("refuses %s", (f) => expect(parseFormat(f)).toBeNull());
  it("normalises", () => {
    expect(normaliseFormat('audio/webm; codecs="opus"')).toBe("audio/webm;codecs=opus");
    expect(normaliseFormat("AUDIO/WEBM; CODECS=OPUS")).toBe("audio/webm;codecs=opus");
  });
});

describe("chooseFormat", () => {
  const only = (...ok: string[]) => (t: string) => ok.includes(t);
  it("prefers MP4, then WebM, then Ogg", () => {
    expect(chooseFormat(() => true)).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(chooseFormat(only("audio/mp4"))).toBe("audio/mp4");
    expect(chooseFormat(only("audio/webm;codecs=opus", "audio/ogg;codecs=opus"))).toBe(
      "audio/webm;codecs=opus",
    );
    expect(chooseFormat(only("audio/ogg;codecs=opus"))).toBe("audio/ogg;codecs=opus");
    expect(chooseFormat(() => false)).toBeNull();
  });
});

describe("sniff", () => {
  it("recognises each container and nothing else", () => {
    expect(sniff(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]))).toBe("audio/mp4");
    expect(sniff(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe("audio/webm");
    expect(sniff(new Uint8Array([0x4f, 0x67, 0x67, 0x53]))).toBe("audio/ogg");
    expect(sniff(new TextEncoder().encode("<html>"))).toBeNull();
  });
});
