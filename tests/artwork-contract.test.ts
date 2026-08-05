import { describe, expect, it } from "vitest";
import {
  classifySource,
  isArtworkStatus,
  plainText,
  sanitizeTags,
  validateArtworkId,
} from "../src/domain/artwork-contract";

describe("artwork contract", () => {
  it("normalizes supported source URLs", () => {
    expect(classifySource("https://www.pixiv.net/artworks/128700071")).toEqual({
      source: "pixiv",
      artworkId: "128700071",
      sourceUrl: "https://www.pixiv.net/artworks/128700071",
    });
    expect(classifySource("https://twitter.com/artist/status/123")).toEqual({
      source: "x",
      artworkId: "https://x.com/artist/status/123",
      sourceUrl: "https://x.com/artist/status/123",
    });
  });

  it("rejects unsafe IDs and protocols", () => {
    expect(() => validateArtworkId("../wrangler")).toThrow(
      "藏品编号格式不正确",
    );
    expect(() => classifySource("file:///tmp/artwork")).toThrow(
      "只接受 http(s) 链接",
    );
  });

  it("normalizes tags and display text", () => {
    expect(sanitizeTags(["#夜景", " 夜景 ", "蓝色"])).toEqual(["夜景", "蓝色"]);
    expect(plainText("<p>A &amp; B<br>C</p>")).toBe("A & B C");
  });

  it("accepts only known lifecycle states", () => {
    expect(isArtworkStatus("hidden")).toBe(true);
    expect(isArtworkStatus("draft")).toBe(false);
  });
});
