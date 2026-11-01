// Captures a static share illustration from the same editable Canvas art as the game.
// Serves dist/ for this bounded command. No hardware reading is included in the image.
import { chromium } from "playwright";
import { serveDist } from "./preview-server.mjs";
const preview = await serveDist();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(process.argv[2] ?? preview.url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => document.querySelector(".portrait canvas")?.width === 600,
  );
  await page.evaluate(() => {
    const source = document.querySelector(".portrait canvas");
    const markup = document.createElement("div");
    markup.id = "share";
    markup.innerHTML =
      '<div><div style="font-size:20px;margin-bottom:40px;color:#53664c;font-weight:800">Squeekchain · Genesis Code Lane</div><h1 style="font-size:88px;line-height:1.02;margin:0 0 30px">Squeek<br><span style="color:#53664c">&amp; Glide</span></h1><p style="font-size:24px;margin:0;max-width:410px">You pilot.<br>A real hamster powers the wind.</p></div>';
    Object.assign(markup.style, {
      width: "1200px",
      height: "630px",
      background: "#d9ebe0",
      color: "#44382f",
      padding: "72px",
      display: "flex",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
      fontFamily: "Nunito,sans-serif",
    });
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 440;
    canvas.getContext("2d").drawImage(source, 0, 0);
    Object.assign(canvas.style, {
      position: "absolute",
      right: "-5px",
      top: "110px",
      width: "620px",
    });
    markup.append(canvas);
    const footer = document.createElement("div");
    footer.textContent = "A little box. Real hamster wind.";
    Object.assign(footer.style, {
      position: "absolute",
      bottom: "36px",
      left: "72px",
      fontSize: "18px",
      color: "#53664c",
    });
    markup.append(footer);
    document.body.replaceChildren(markup);
    document.body.style.margin = "0";
  });
  await page.locator("#share").screenshot({ path: "public/share.png" });
  console.log("Wrote public/share.png (1200 × 630).");
} finally {
  await browser.close();
  await preview.close();
}
