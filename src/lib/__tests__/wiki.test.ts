import { describe, it, expect, vi, beforeEach } from "vitest";

// Shared mock functions
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
const mockAccess = vi.fn();
const mockAppendFile = vi.fn();

vi.mock("fs", () => ({
  default: {
    promises: {
      readFile: (...args: unknown[]) => mockReadFile(...args),
      writeFile: (...args: unknown[]) => mockWriteFile(...args),
      mkdir: (...args: unknown[]) => mockMkdir(...args),
      access: (...args: unknown[]) => mockAccess(...args),
      appendFile: (...args: unknown[]) => mockAppendFile(...args),
    },
  },
  promises: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    access: (...args: unknown[]) => mockAccess(...args),
    appendFile: (...args: unknown[]) => mockAppendFile(...args),
  },
}));

vi.mock("path", () => ({
  default: {
    join: (...args: string[]) => args.join("/"),
    dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
  },
  join: (...args: string[]) => args.join("/"),
  dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
}));

import {
  initWiki,
  appendLog,
  upsertWikiPage,
  getWikiIndex,
  getWikiLog,
  updateWikiIndex,
} from "../wiki";

describe("Wiki operations", () => {
  beforeEach(() => {
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockMkdir.mockReset();
    mockAccess.mockReset();
    mockAppendFile.mockReset();

    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);
  });

  describe("initWiki", () => {
    it("creates directories and initializes files", async () => {
      // fs.access throws for non-existent files (triggers file creation)
      mockAccess.mockRejectedValue(new Error("not found"));

      const result = await initWiki("cat1");

      expect(result.baseDir).toContain("wiki/cat1");
      // mkdir called for entities and topics
      expect(mockMkdir).toHaveBeenCalledTimes(2);
      // writeFile called for index.md and log.md
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
    });

    it("skips file creation if files already exist", async () => {
      mockAccess.mockResolvedValue(undefined);

      await initWiki("cat1");

      // writeFile should NOT be called since access succeeded
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe("appendLog", () => {
    it("appends log entry to log file", async () => {
      await appendLog("cat1", "ingest | 5 articles collected");

      expect(mockAppendFile).toHaveBeenCalledTimes(1);
      const call = mockAppendFile.mock.calls[0];
      expect(call[0]).toContain("wiki/cat1/log.md");
      expect(call[1]).toContain("ingest | 5 articles collected");
    });
  });

  describe("upsertWikiPage", () => {
    it("writes content to the correct path", async () => {
      await upsertWikiPage("cat1", "entities", "openai", "# OpenAI\nAI company");

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const call = mockWriteFile.mock.calls[0];
      expect(call[0]).toContain("wiki/cat1/entities/openai.md");
      expect(call[1]).toBe("# OpenAI\nAI company");
    });

    it("writes topic pages", async () => {
      await upsertWikiPage("cat1", "topics", "gpt-5", "# GPT-5");

      const call = mockWriteFile.mock.calls[0];
      expect(call[0]).toContain("wiki/cat1/topics/gpt-5.md");
    });
  });

  describe("getWikiIndex", () => {
    it("returns index content", async () => {
      mockReadFile.mockResolvedValue("# Wiki Index\n- test");

      const result = await getWikiIndex("cat1");
      expect(result).toBe("# Wiki Index\n- test");
    });

    it("returns empty string on error", async () => {
      mockReadFile.mockRejectedValue(new Error("not found"));

      const result = await getWikiIndex("nonexistent");
      expect(result).toBe("");
    });
  });

  describe("getWikiLog", () => {
    it("returns log content", async () => {
      mockReadFile.mockResolvedValue("# Wiki Log\nentry1");

      const result = await getWikiLog("cat1");
      expect(result).toBe("# Wiki Log\nentry1");
    });

    it("returns empty string on error", async () => {
      mockReadFile.mockRejectedValue(new Error("not found"));

      const result = await getWikiLog("nonexistent");
      expect(result).toBe("");
    });
  });

  describe("updateWikiIndex", () => {
    it("writes index with entities and topics", async () => {
      await updateWikiIndex("cat1", ["openai", "google"], ["gpt-5", "gemini"]);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const content = mockWriteFile.mock.calls[0][1] as string;

      expect(content).toContain("## Entities");
      expect(content).toContain("[openai](entities/openai.md)");
      expect(content).toContain("[google](entities/google.md)");
      expect(content).toContain("## Topics");
      expect(content).toContain("[gpt-5](topics/gpt-5.md)");
      expect(content).toContain("[gemini](topics/gemini.md)");
    });

    it("writes index with only entities", async () => {
      await updateWikiIndex("cat1", ["openai"], []);

      const content = mockWriteFile.mock.calls[0][1] as string;
      expect(content).toContain("## Entities");
      expect(content).not.toContain("## Topics");
    });

    it("writes index with only topics", async () => {
      await updateWikiIndex("cat1", [], ["gpt-5"]);

      const content = mockWriteFile.mock.calls[0][1] as string;
      expect(content).not.toContain("## Entities");
      expect(content).toContain("## Topics");
    });

    it("writes minimal index when both empty", async () => {
      await updateWikiIndex("cat1", [], []);

      const content = mockWriteFile.mock.calls[0][1] as string;
      expect(content).toContain("# Wiki Index");
      expect(content).not.toContain("## Entities");
      expect(content).not.toContain("## Topics");
    });
  });
});
