const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const format = process.argv.includes("--vertical") ? "vertical" : "horizontal";
const fps = 20;
const duration = 40;
const size = format === "vertical" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const ffmpeg = path.join(root, "..", "video-tools", "ffmpeg", "ffmpeg-8.1.1-essentials_build", "bin", "ffmpeg.exe");
const output = path.join(root, format === "vertical" ? "浮盈-app-抖音竖屏版.mp4" : "浮盈-app-B站横屏版.mp4");
const tempVideo = path.join(root, `${format}-silent.mp4`);
const cover = path.join(root, format === "vertical" ? "浮盈-app-抖音封面.png" : "浮盈-app-B站封面.png");

app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.on("window-all-closed", () => {});

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

async function render() {
  const window = new BrowserWindow({
    width: size.width,
    height: size.height,
    show: false,
    frame: false,
    webPreferences: { offscreen: true }
  });
  await window.loadFile(path.join(root, "demo-stage.html"));
  await new Promise((resolve) => setTimeout(resolve, 500));

  const encoder = spawn(ffmpeg, [
    "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", `${size.width}x${size.height}`,
    "-r", String(fps), "-i", "-", "-an", "-c:v", "libx264", "-preset", "veryfast",
    "-crf", "18", "-pix_fmt", "yuv420p", tempVideo
  ], { stdio: ["pipe", "inherit", "inherit"] });

  for (let frame = 0; frame < fps * duration; frame += 1) {
    const seconds = frame / fps;
    await window.webContents.executeJavaScript(`window.renderAt(${seconds})`);
    const image = await window.webContents.capturePage();
    const imageSize = image.getSize();
    if (imageSize.width !== size.width || imageSize.height !== size.height) {
      throw new Error(`Unexpected capture size ${imageSize.width}x${imageSize.height}; expected ${size.width}x${size.height}`);
    }
    if (frame === fps * 36) fs.writeFileSync(cover, image.toPNG());
    if (!encoder.stdin.write(image.toBitmap())) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
  }
  encoder.stdin.end();
  await new Promise((resolve, reject) => encoder.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`encoder exited ${code}`))));
  window.destroy();

  await run(ffmpeg, [
    "-y", "-i", tempVideo,
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100:duration=40",
    "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=44100:duration=40",
    "-filter_complex", "[1:a]volume=0.018[a1];[2:a]volume=0.010[a2];[a1][a2]amix=inputs=2:duration=shortest,afade=t=in:st=0:d=1.5,afade=t=out:st=38:d=2[a]",
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", output
  ]);
  fs.unlinkSync(tempVideo);
}

app.whenReady().then(render).then(() => app.quit()).catch((error) => {
  console.error(error);
  app.exit(1);
});
