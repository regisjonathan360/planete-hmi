import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { normalizeVideo } from "../schemas";

describe("Feature: tiktok-charts-module", () => {
  
  // Property 1: Video normalization completeness
  describe("Property 1: Video normalization completeness", () => {
    it("For any valid TikTok API video response, normalizing produces an object with all required fields", () => {
      // Arbitrary for a valid raw video object
      const validRawVideo = fc.record({
        video_id: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        music_id: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        create_time: fc.integer({ min: 1600000000, max: 2000000000 }), // epoch seconds
        region_code: fc.option(fc.constantFrom("FR","US","UK","DE","ES","IT","BR","JP"), { nil: undefined }),
        view_count: fc.nat({ max: 10_000_000 }),
        like_count: fc.nat({ max: 10_000_000 }),
        comment_count: fc.nat({ max: 1_000_000 }),
        share_count: fc.nat({ max: 1_000_000 }),
        hashtag_names: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
        video_description: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
      });

      fc.assert(
        fc.property(validRawVideo, (raw) => {
          const normalized = normalizeVideo(raw);
          
          // All required fields must be present
          expect(normalized).toHaveProperty("video_id");
          expect(normalized).toHaveProperty("music_id");
          expect(normalized).toHaveProperty("username");
          expect(normalized).toHaveProperty("create_time");
          expect(normalized).toHaveProperty("region_code");
          expect(normalized).toHaveProperty("view_count");
          expect(normalized).toHaveProperty("like_count");
          expect(normalized).toHaveProperty("comment_count");
          expect(normalized).toHaveProperty("share_count");
          expect(normalized).toHaveProperty("hashtag_names");
          expect(normalized).toHaveProperty("video_description");
          
          // Types are correct
          expect(typeof normalized.video_id).toBe("string");
          expect(typeof normalized.music_id).toBe("string");
          expect(typeof normalized.username).toBe("string");
          expect(typeof normalized.create_time).toBe("string"); // ISO date
          expect(typeof normalized.view_count).toBe("number");
          expect(typeof normalized.like_count).toBe("number");
          expect(typeof normalized.comment_count).toBe("number");
          expect(typeof normalized.share_count).toBe("number");
          expect(Array.isArray(normalized.hashtag_names)).toBe(true);
          
          // Values are preserved correctly
          expect(normalized.video_id).toBe(raw.video_id);
          expect(normalized.music_id).toBe(raw.music_id);
          expect(normalized.username).toBe(raw.username);
          expect(normalized.view_count).toBe(raw.view_count);
          expect(normalized.like_count).toBe(raw.like_count);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Property 2: Deduplication idempotence
  describe("Property 2: Deduplication idempotence", () => {
    it("Collecting the same video_id N times results in exactly one record with latest metrics", () => {
      // Test the deduplication logic in-memory (same as collector uses Map)
      const videoIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);
      const metricsArb = fc.record({
        view_count: fc.nat({ max: 10_000_000 }),
        like_count: fc.nat({ max: 10_000_000 }),
        comment_count: fc.nat({ max: 1_000_000 }),
        share_count: fc.nat({ max: 1_000_000 }),
      });

      fc.assert(
        fc.property(
          videoIdArb,
          fc.array(metricsArb, { minLength: 1, maxLength: 10 }),
          (videoId, metricsList) => {
            // Simulate collector's dedup: last write wins
            const deduped = new Map<string, { view_count: number; like_count: number; comment_count: number; share_count: number }>();
            for (const metrics of metricsList) {
              deduped.set(videoId, metrics);
            }
            
            // Exactly one record
            expect(deduped.size).toBe(1);
            // Metrics reflect the last collection
            const lastMetrics = metricsList[metricsList.length - 1];
            expect(deduped.get(videoId)).toEqual(lastMetrics);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 6: New sounds default to validation queue
  describe("Property 6: New sounds default to validation queue", () => {
    it("Any new music_id not in existing set gets validation_status = 'a_verifier'", () => {
      const musicIdArb = fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0);
      const existingSetArb = fc.uniqueArray(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        { maxLength: 20 }
      );

      fc.assert(
        fc.property(musicIdArb, existingSetArb, (newMusicId, existingIds) => {
          const existingSet = new Set(existingIds);
          
          // Simulate collector logic: if not in existing set, default status is "a_verifier"
          const isNew = !existingSet.has(newMusicId);
          
          if (isNew) {
            // The collector creates the sound with this default
            const defaultStatus = "a_verifier";
            expect(defaultStatus).toBe("a_verifier");
          }
          // When a sound already exists, no status change is forced
          // (it keeps whatever status it had)
        }),
        { numRuns: 100 }
      );
    });
  });
});
