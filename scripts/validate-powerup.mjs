// Development-only black-box checks. Canvas recording and hardware fixtures are
// injected by Playwright; neither is imported by the production application.
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { serveDist } from "./preview-server.mjs";
const preview = await serveDist();
const output = "test/scratch/powerup";
await mkdir(output, { recursive: true });
const results = [];
try {
  for (const [name, engine] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ]) {
    if (process.argv[2] && !name.includes(process.argv[2])) continue;
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let coreStatus = "ACTIVE",
        rpmMilli = 120000,
        network = true;
      await page.addInitScript(() => {
        let seed = 7;
        Math.random = () => {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        window.__drawing = { y: 320, gates: [], golden: [], trail: 0 };
        const proto = CanvasRenderingContext2D.prototype;
        const fill = proto.fillRect,
          round = proto.roundRect,
          translate = proto.translate,
          text = proto.fillText;
        const world = (c) => c.canvas.width === 480 && c.canvas.height === 640;
        const originalFill = proto.fill;
        proto.fill = function (...args) {
          if (world(this) && this.fillStyle === "#b98622")
            window.__drawing.trail++;
          return originalFill.apply(this, args);
        };
        proto.fillRect = function (x, y, w, h) {
          if (world(this) && x === 0 && y === 0 && w === 480 && h === 640) {
            window.__drawing.gates = [];
            window.__drawing.golden = [];
            window.__drawing.trail = 0;
          }
          return fill.call(this, x, y, w, h);
        };
        proto.roundRect = function (x, y, w, h, r) {
          if (world(this) && w === 64 && h > 0) {
            const t = this.getTransform();
            window.__drawing.gates.push({ x: t.e, y: t.f, height: h });
          }
          return round.call(this, x, y, w, h, r);
        };
        proto.translate = function (x, y) {
          if (world(this) && x === 130 && y > 21 && y < 619)
            window.__drawing.y = y;
          return translate.call(this, x, y);
        };
        proto.fillText = function (value, ...args) {
          if (world(this) && value === "x2") {
            const t = this.getTransform();
            window.__drawing.golden.push({ x: t.e, y: t.f });
          }
          return text.call(this, value, ...args);
        };
      });
      await page.clock.install({ time: new Date("2026-11-01T16:00:00Z") });
      await page.clock.pauseAt(new Date("2026-11-01T16:00:10.000Z"));
      await page.route(
        "https://api.squeekchain.com/v1/status",
        async (route) => {
          if (!network) return route.abort();
          const now = await page.evaluate(() => Date.now());
          return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              schemaVersion: 1,
              measurement: {
                freshness: "online",
                provenance: "hardware",
                coreStatus,
                rpmMilli,
                receivedAt: new Date(now).toISOString(),
                staleAfterSeconds: 120,
              },
            }),
          });
        },
      );
      const tick = async (ms) => {
        await page.clock.runFor(ms);
        await delay(30);
        await page.clock.runFor(16);
        await delay(5);
      };
      await page.goto(preview.url);
      await page.evaluate(() => document.fonts.ready);
      await tick(100);
      await page
        .getByRole("button", { name: "Start flying", exact: true })
        .click({ force: true });
      await tick(3050);
      let previousY = 320;
      async function pilot(ms = 80, collect = true) {
        const art = await page.evaluate(() => window.__drawing);
        const tops = art.gates
          .filter((g) => g.y === 0 && g.x + 64 >= 112)
          .sort((a, b) => a.x - b.x);
        const top = tops[0];
        const bottom =
          top && art.gates.find((g) => Math.abs(g.x - top.x) < 0.01 && g.y > 0);
        const seed =
          top && art.golden.find((g) => Math.abs(g.x - (top.x + 32)) < 0.01);
        const target =
          collect && seed
            ? seed.y
            : top && bottom
              ? (top.height + bottom.y) / 2
              : 320;
        if (art.y > target + 5 && art.y >= previousY)
          await page.keyboard.press("Space");
        previousY = art.y;
        await tick(ms);
        assert.equal(
          await page.locator(".over-overlay,.pause-card").count(),
          0,
          `pilot must remain in flight: ${await page.locator(".pause-card,.result").allTextContents()}`,
        );
      }
      for (
        let i = 0;
        i < 650 && !(await page.locator(".double-badge").count());
        i++
      )
        await pilot();
      assert.equal(
        await page.locator(".double-badge").count(),
        1,
        "a reachable Golden Seed must be picked up during real canvas play",
      );
      const score = () => page.locator(".score").innerText();
      const remaining = () => page.locator(".double-badge > span").innerText();
      assert.equal(await page.locator(".score").count(), 1);
      assert.equal(
        await page.locator(".double-badge strong").innerText(),
        "x2",
      );
      const powerScore = await score();
      assert.equal(
        await page.evaluate(() => window.__drawing.trail),
        4,
        "powered craft has a subtle gold trail",
      );
      const badgeColors = await page.locator(".double-badge").evaluate((e) => ({
        ink: getComputedStyle(e).color,
        surface: getComputedStyle(e).backgroundColor,
      }));
      const powerRect = await page.locator(".double-badge").boundingBox();
      assert.ok(powerRect.x >= 0 && powerRect.x + powerRect.width <= 390);
      await page.screenshot({ path: `${output}/${name}-double-points.png` });
      for (const [width, height, textSize] of [
        [568, 320, 100],
        [844, 390, 100],
        [390, 844, 200],
        [568, 320, 200],
        [390, 844, 100],
      ]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(
          (size) => (document.documentElement.style.fontSize = `${size}%`),
          textSize,
        );
        await tick(64); // Orientation pauses and requires fresh hardware.
        const resume = page.getByRole("button", {
          name: "Resume",
          exact: true,
        });
        if (await resume.count()) {
          await resume.click({ force: true });
          await tick(3050);
        }
        assert.ok(
          await page.getByText("Running", { exact: true }).isVisible(),
          "ACTIVE status label remains visible in compact landscape",
        );
        const badge = await page.locator(".double-badge").boundingBox();
        const pause = await page.locator(".pause-button").boundingBox();
        assert.ok(
          badge.x + badge.width + 8 <= pause.x,
          `${width} at ${textSize}%: badge and Pause must not overlap`,
        );
        if (width > height) {
          const world = await page.locator(".game-viewport").boundingBox();
          const hud = await page.locator(".score-stack").boundingBox();
          const craftLeft = world.x + ((130 - 18) / 480) * world.width;
          assert.ok(
            hud.x + hud.width <= craftLeft,
            `${width} at ${textSize}%: score panel must leave the aircraft visible`,
          );
        }
        await page.screenshot({
          path: `${output}/${name}-badge-${width}-${textSize}.png`,
        });
      }
      await page
        .getByRole("button", { name: "Pause", exact: true })
        .click({ force: true });
      await tick(32);
      const frozen = await remaining();
      await tick(2000);
      assert.equal(await remaining(), frozen, "manual pause freezes countdown");
      await page
        .getByRole("button", { name: "How to play" })
        .click({ force: true });
      await tick(1000);
      assert.equal(await remaining(), frozen, "help freezes countdown");
      await page.keyboard.press("Escape");
      await tick(32);
      assert.equal(
        await page.getByRole("button", { name: "Resume", exact: true }).count(),
        1,
      );
      await page
        .getByRole("button", { name: "Resume", exact: true })
        .click({ force: true });
      await tick(2000);
      assert.equal(await remaining(), frozen, "resume countdown freezes power");
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await tick(60000);
      assert.equal(
        await remaining(),
        frozen,
        "hidden tab cannot consume power",
      );
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await tick(80);
      assert.equal(
        await remaining(),
        frozen,
        "fresh response cannot jump gameplay time",
      );
      await tick(2000);
      assert.equal(
        await remaining(),
        frozen,
        "visibility recovery countdown freezes power",
      );
      // Lose the signal during countdown, then require another full countdown.
      network = false;
      await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await tick(6000);
      assert.equal(await remaining(), frozen, "signal loss freezes power");
      assert.equal(
        await page.locator(".wheel").getAttribute("data-state"),
        "unknown",
      );
      network = true;
      coreStatus = "IDLE";
      rpmMilli = 0;
      for (
        let i = 0;
        i < 50 && (await page.locator(".pause-card").count());
        i++
      )
        await tick(500);
      assert.equal(
        await page.locator(".wheel").getAttribute("data-state"),
        "resting",
      );
      assert.equal(
        await remaining(),
        frozen,
        "fresh recovery begins without spending power",
      );
      await tick(3050);
      previousY = await page.evaluate(() => window.__drawing.y);
      for (
        let i = 0;
        i < 160 && (await page.locator(".double-badge").count());
        i++
      )
        await pilot(80, false);
      assert.equal(
        await page.locator(".double-badge").count(),
        0,
        "effect expires during active flight",
      );
      assert.equal(
        await page.evaluate(() => window.__drawing.trail),
        0,
        "gold trail disappears at expiration",
      );
      await tick(4500);
      assert.equal(
        await page.locator(".double-badge").count(),
        0,
        "game over clears effect",
      );
      const finalScore = Number(
        await page.locator(".result-numbers strong").first().innerText(),
      );
      assert.ok(finalScore >= Number(powerScore));
      assert.equal(
        await page.locator(".score").count(),
        0,
        "result contains one prominent total",
      );
      assert.equal(
        await page.evaluate(() =>
          Number(localStorage.getItem("squeek-glide.best.v1")),
        ),
        finalScore,
      );
      await page
        .getByRole("button", { name: "Fly again" })
        .click({ force: true });
      await tick(32);
      assert.equal(await page.locator(".score").innerText(), "0");
      assert.equal(await page.locator(".double-badge").count(), 0);
      await page.reload();
      await tick(100);
      assert.ok(
        (await page.locator(".best").innerText()).includes(String(finalScore)),
        "local best persists across reload",
      );
      assert.deepEqual(errors, []);
      results.push({
        browser: name,
        passed: true,
        powerScore: Number(powerScore),
        finalScore,
        badgeColors,
      });
      console.log(
        "PASS",
        name,
        "real canvas pickup, responsive x2 badge, pause/help/orientation/hidden/signal/countdown freezes, expiration, retry, stored best",
      );
      await context.close();
    } catch (error) {
      results.push({ browser: name, passed: false, error: String(error) });
      console.error("FAIL", name, String(error));
    } finally {
      await browser.close();
    }
  }
} finally {
  await preview.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some((r) => !r.passed)) process.exitCode = 1;
