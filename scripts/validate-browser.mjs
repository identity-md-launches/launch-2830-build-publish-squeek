import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { serveDist } from "./preview-server.mjs";
const output = "test/scratch/browser";
await mkdir(output, { recursive: true });
const preview = await serveDist();
const API = "https://api.squeekchain.com/v1/status";
const results = [];
const failures = [];
const filter = process.argv[2] ?? "";
async function check(name, fn) {
  if (filter && !name.includes(filter)) return;
  try {
    await fn();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (error) {
    failures.push({ name, error: String(error) });
    results.push({ name, passed: false, error: String(error) });
    console.error("FAIL", name, String(error));
  }
}
function payload(now, options = {}) {
  return {
    schemaVersion: 1,
    measurement: {
      freshness: "online",
      provenance: "hardware",
      coreStatus: "IDLE",
      rpmMilli: 0,
      receivedAt: new Date(now).toISOString(),
      staleAfterSeconds: 120,
      ...options,
    },
  };
}
async function fixture(browser, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    reducedMotion: "no-preference",
  });
  context.setDefaultTimeout(10000);
  if (options.deniedStorage)
    await context.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("denied", "SecurityError");
        },
      }),
    );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    let seed = 7;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  const state = {
    mode: "valid",
    rpmMilli: 0,
    coreStatus: "IDLE",
    staleAfterSeconds: 120,
    calls: 0,
    ...options,
  };
  await page.route(API, async (route) => {
    state.calls++;
    if (state.mode === "network") {
      await route.abort();
      return;
    }
    if (state.mode === "429") {
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "10" },
        body: "{}",
      });
      return;
    }
    if (state.mode === "badJSON") {
      await route.fulfill({
        body: "not JSON",
        contentType: "application/json",
      });
      return;
    }
    const now = await page.evaluate(() => Date.now());
    const data = payload(now, {
      rpmMilli: state.rpmMilli,
      coreStatus: state.coreStatus,
      staleAfterSeconds: state.staleAfterSeconds,
    });
    if (state.mode === "simulated") data.measurement.provenance = "simulated";
    if (state.mode === "schema") data.schemaVersion = 2;
    if (state.mode === "stale")
      data.measurement.receivedAt = new Date(now - 180000).toISOString();
    if (state.mode === "fault") data.measurement.coreStatus = "COUNTER_FAULT";
    await route.fulfill({
      body: JSON.stringify(data),
      contentType: "application/json",
    });
  });
  await page.clock.install({ time: new Date("2026-11-01T15:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-01T15:00:00.100Z"));
  await page.goto(preview.url);
  await page.evaluate(() => document.fonts.ready);
  async function tick(ms) {
    await page.clock.runFor(ms);
    await delay(40);
    await page.clock.runFor(16);
    await delay(10);
  }
  await tick(32);
  return { page, context, state, errors, tick };
}
async function begin(f) {
  await f.page
    .getByRole("button", { name: "Bắt đầu bay" })
    .click({ force: true });
  await f.tick(3050);
  assert.ok(
    (await f.page.locator(".game-viewport").getAttribute("class")).includes(
      "is-active",
    ),
  );
}
async function pixels(page) {
  return page.locator(".game-viewport>canvas").evaluate((c) => c.toDataURL());
}

try {
  for (const [browserName, engine] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ]) {
    let browser;
    try {
      browser = await engine.launch({ headless: true });
    } catch (e) {
      results.push({
        name: `${browserName}: available`,
        passed: false,
        limitation: String(e),
      });
      failures.push({ name: `${browserName}: available`, error: String(e) });
      console.error("UNAVAILABLE", browserName, String(e).slice(0, 250));
      continue;
    }
    await check(
      `${browserName}: start, keyboard flap, crash, retry, focus and help`,
      async () => {
        const f = await fixture(browser);
        const { page, tick } = f;
        const button = page.getByRole("button", { name: "Bắt đầu bay" });
        assert.equal(await button.isEnabled(), true);
        const r = await button.boundingBox();
        assert.ok(r.y + r.height < 844);
        await begin(f);
        assert.equal(
          await page
            .locator(".game-viewport")
            .evaluate((e) => e === document.activeElement),
          true,
        );
        const before = await pixels(page);
        await page.keyboard.press("Space");
        await tick(100);
        assert.notEqual(await pixels(page), before);
        await page.keyboard.press("Escape");
        await tick(32);
        assert.ok(
          await page.getByRole("button", { name: "Tiếp tục bay" }).isVisible(),
        );
        const paused = await pixels(page);
        await tick(1000);
        assert.equal(await pixels(page), paused);
        await page
          .getByRole("button", { name: "Cách chơi" })
          .click({ force: true });
        assert.equal(
          await page.locator("dialog").evaluate((e) => e.open),
          true,
        );
        await page.keyboard.press("Escape");
        await tick(32);
        assert.ok(
          await page.getByRole("button", { name: "Tiếp tục bay" }).isVisible(),
          "help must preserve manual pause",
        );
        await page
          .getByRole("button", { name: "Tiếp tục bay" })
          .click({ force: true });
        await tick(3050);
        await tick(3400);
        const retry = page.getByRole("button", { name: "Bay lần nữa" });
        assert.ok(await retry.isVisible());
        assert.equal(
          await retry.evaluate((e) => e === document.activeElement),
          true,
        );
        await page.screenshot({
          path: `${output}/${browserName}-game-over.png`,
        });
        await retry.click({ force: true });
        await tick(32);
        assert.equal(await page.locator(".score").innerText(), "0");
        assert.equal(await page.locator(".countdown").innerText(), "3");
        assert.deepEqual(f.errors, []);
        await f.context.close();
      },
    );
    await check(
      `${browserName}: malformed, simulated, unknown, stale and fault data disable play`,
      async () => {
        for (const mode of [
          "badJSON",
          "simulated",
          "schema",
          "stale",
          "fault",
        ]) {
          const f = await fixture(browser, { mode });
          assert.equal(
            await f.page
              .getByRole("button", { name: "Bắt đầu bay" })
              .isDisabled(),
            true,
            mode,
          );
          assert.equal(
            await f.page
              .locator(".telemetry")
              .innerText()
              .then((t) => t.includes("—")),
            true,
          );
          assert.deepEqual(f.errors, []);
          await f.context.close();
        }
      },
    );
    await check(
      `${browserName}: network failure freezes canvas and recovery counts down`,
      async () => {
        const f = await fixture(browser);
        await begin(f);
        f.state.mode = "network";
        // Keep the pilot airborne until the next scheduled request.
        for (let i = 0; i < 12; i++) {
          await f.page.keyboard.press("Space");
          await f.tick(650);
          if (await f.page.locator(".pause-card").count()) break;
        }
        assert.ok(
          await f.page
            .getByRole("heading", { name: "Đang chờ làn gió" })
            .isVisible(),
        );
        const frozen = await pixels(f.page);
        await f.tick(1200);
        assert.equal(await pixels(f.page), frozen);
        await f.page.screenshot({
          path: `${output}/${browserName}-reconnecting.png`,
        });
        f.state.mode = "valid";
        await f.tick(5000); // Recovery may already be in countdown.
        assert.equal(await f.page.locator(".pause-card").count(), 0);
        assert.ok(
          (await f.page.locator(".countdown").count()) ||
            (
              await f.page.locator(".game-viewport").getAttribute("class")
            ).includes("is-active"),
        );
        assert.deepEqual(f.errors, []);
        await f.context.close();
      },
    );
    await check(
      `${browserName}: hidden tab needs a new response, orientation pauses, resize is inert`,
      async () => {
        const f = await fixture(browser);
        await begin(f);
        const before = await pixels(f.page);
        await f.page.setViewportSize({ width: 375, height: 812 });
        assert.equal(await pixels(f.page), before);
        const calls = f.state.calls;
        await f.page.evaluate(() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await f.tick(5000);
        assert.equal(await pixels(f.page), before);
        assert.equal(f.state.calls, calls);
        await f.page.evaluate(() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => false,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await f.tick(50);
        assert.ok(f.state.calls > calls);
        assert.equal(await pixels(f.page), before);
        assert.ok(await f.page.locator(".countdown").count());
        await f.page.setViewportSize({ width: 844, height: 390 });
        await f.tick(50);
        assert.ok(
          await f.page
            .getByRole("heading", { name: "Màn hình đã xoay" })
            .isVisible(),
        );
        assert.equal(await pixels(f.page), before);
        await f.context.close();
      },
    );
    await check(
      `${browserName}: cached data ages between polls; wheel stops at zero and honors reduced motion`,
      async () => {
        const f = await fixture(browser, { staleAfterSeconds: 2 });
        await f.tick(2100);
        assert.equal(
          await f.page
            .getByRole("button", { name: "Bắt đầu bay" })
            .isDisabled(),
          true,
        );
        await f.context.close();
        const w = await fixture(browser, {
          rpmMilli: 60000,
          coreStatus: "ACTIVE",
        });
        const transform = () =>
          w.page.locator(".wheel g").getAttribute("transform");
        const first = await transform();
        await w.tick(500);
        assert.notEqual(await transform(), first);
        await w.page.emulateMedia({ reducedMotion: "reduce" });
        await w.page.evaluate(
          () => getComputedStyle(document.body).transitionDuration,
        );
        await delay(150);
        await w.tick(32);
        const still = await transform();
        await w.tick(500);
        assert.equal(
          await transform(),
          still,
          "wheel must stop under reduced motion",
        );
        await w.page.emulateMedia({ reducedMotion: "no-preference" });
        w.state.rpmMilli = 0;
        w.state.coreStatus = "IDLE";
        await w.tick(5000);
        const zero = await transform();
        await w.tick(600);
        assert.equal(await transform(), zero, "wheel must stop at zero RPM");
        assert.ok(
          await w.page
            .getByText("Hamster đang nghỉ", { exact: true })
            .isVisible(),
        );
        await w.context.close();
      },
    );
    await check(
      `${browserName}: responsive start, help and result layout; axe accessibility`,
      async () => {
        const f = await fixture(browser);
        const { page } = f;
        for (const [width, height] of [
          [320, 568],
          [390, 844],
          [768, 1024],
          [1440, 1000],
        ]) {
          await page.setViewportSize({ width, height });
          await f.tick(100);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          const box = await page
            .getByRole("button", { name: "Bắt đầu bay" })
            .boundingBox();
          assert.ok(
            box.y + box.height <= height,
            `${width}: action below screen`,
          );
          await page.screenshot({
            path: `${output}/${browserName}-start-${width}.png`,
            fullPage: true,
          });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await f.tick(32);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%";
        });
        await f.tick(32);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          "200% text must reflow",
        );
        await page.screenshot({
          path: `${output}/${browserName}-text-200.png`,
          fullPage: true,
        });
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "";
        });
        await page.clock.resume();
        const scan = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        assert.deepEqual(
          scan.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
        );
        await page
          .getByRole("button", { name: "Cách chơi" })
          .click({ force: true });
        const helpScan = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        assert.deepEqual(
          helpScan.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
        );
        await page.screenshot({ path: `${output}/${browserName}-help.png` });
        await page.keyboard.press("Escape");
        assert.equal(
          await page
            .getByRole("button", { name: "Cách chơi" })
            .evaluate((e) => e === document.activeElement),
          true,
        );
        assert.deepEqual(f.errors, []);
        await f.context.close();
      },
    );
    await check(
      `${browserName}: pass gaps, show parachute, save best and stop scoring on death`,
      async () => {
        const f = await fixture(browser);
        await begin(f);
        for (let i = 0; i < 10; i++) {
          await f.page.keyboard.press("Space");
          await f.tick(700);
          if (i === 4)
            await f.page.screenshot({
              path: `${output}/${browserName}-playing.png`,
            });
        }
        const earned = Number(await f.page.locator(".score").innerText());
        assert.ok(earned >= 1, "passing a wall must update the visible score");
        for (
          let i = 0;
          i < 20 &&
          (
            await f.page.locator(".game-viewport").getAttribute("class")
          ).includes("is-active");
          i++
        )
          await f.tick(100);
        await f.tick(450);
        await f.page.screenshot({
          path: `${output}/${browserName}-parachute.png`,
        });
        await f.tick(2000);
        assert.ok(
          await f.page.getByRole("button", { name: "Bay lần nữa" }).isVisible(),
        );
        const final = Number(await f.page.locator(".score").innerText());
        assert.ok(final >= earned);
        assert.equal(
          await f.page.evaluate(() =>
            Number(localStorage.getItem("squeek-glide.best.v1")),
          ),
          final,
        );
        await f.tick(5000);
        assert.equal(Number(await f.page.locator(".score").innerText()), final);
        await f.context.close();
      },
    );
    await browser.close();
  }
  const chromiumBrowser = await chromium.launch();
  await check(
    "Chromium: touch pointer fires once; synthetic click and keyboard repeat are ignored",
    async () => {
      async function trajectory(kind) {
        const f = await fixture(chromiumBrowser);
        await begin(f);
        await f.page
          .locator(".game-viewport>canvas")
          .dispatchEvent("pointerdown", {
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
          });
        await f.tick(100);
        if (kind === "click")
          await f.page.locator(".game-viewport>canvas").dispatchEvent("click");
        if (kind === "repeat")
          await f.page.locator(".game-viewport").dispatchEvent("keydown", {
            code: "Space",
            key: " ",
            repeat: true,
          });
        if (kind === "secondary")
          await f.page
            .locator(".game-viewport>canvas")
            .dispatchEvent("pointerdown", {
              pointerId: 2,
              pointerType: "touch",
              isPrimary: false,
              button: 0,
            });
        await f.tick(100);
        const p = await pixels(f.page);
        await f.context.close();
        return p;
      }
      const baseline = await trajectory("none");
      assert.equal(await trajectory("click"), baseline);
      assert.equal(await trajectory("repeat"), baseline);
      assert.equal(await trajectory("secondary"), baseline);
    },
  );
  await check(
    "Chromium: denied storage does not prevent flight/retry",
    async () => {
      const f = await fixture(chromiumBrowser, { deniedStorage: true });
      await begin(f);
      for (let i = 0; i < 10; i++) {
        await f.page.keyboard.press("Space");
        await f.tick(700);
      }
      assert.ok(Number(await f.page.locator(".score").innerText()) >= 1);
      await f.tick(3500);
      assert.ok(
        await f.page.getByRole("button", { name: "Bay lần nữa" }).isVisible(),
      );
      assert.ok(
        (await f.page.locator(".local-note").innerText()).includes(
          "không cho lưu",
        ),
      );
      assert.deepEqual(f.errors, []);
      await f.context.close();
    },
  );
  await check(
    "Chromium: live API hardware response, relative assets, no failed resources",
    async () => {
      const page = await chromiumBrowser.newPage({
        viewport: { width: 390, height: 844 },
      });
      const localFailures = [];
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      page.on("response", (r) => {
        if (r.url().startsWith(preview.url) && r.status() >= 400)
          localFailures.push(r.url());
      });
      const response = page.waitForResponse(API, { timeout: 15000 });
      await page.goto(preview.url);
      const res = await response;
      const data = await res.json();
      const observation = {
        status: res.status(),
        schemaVersion: data.schemaVersion,
        measurement: data.measurement
          ? {
              freshness: data.measurement.freshness,
              provenance: data.measurement.provenance,
              coreStatus: data.measurement.coreStatus,
              rpmMilli: data.measurement.rpmMilli,
              receivedAt: data.measurement.receivedAt,
              staleAfterSeconds: data.measurement.staleAfterSeconds,
            }
          : null,
      };
      await writeFile(
        `${output}/live-observation.json`,
        JSON.stringify(observation, null, 2),
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `${output}/live-mobile.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `${output}/live-desktop.png`,
        fullPage: true,
      });
      assert.deepEqual(localFailures, []);
      assert.deepEqual(pageErrors, []);
      assert.equal(
        await page.evaluate(() => document.fonts.check("800 16px Nunito")),
        true,
      );
      assert.equal(
        (
          await page.request.get(new URL("share.png", preview.url).href)
        ).status(),
        200,
      );
      await page.close();
    },
  );
  await chromiumBrowser.close();
} finally {
  await preview.close();
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ results, failures }, null, 2),
  );
  console.log(
    `${results.filter((r) => r.passed).length}/${results.length} checks passed`,
  );
}
if (failures.length) process.exitCode = 1;
