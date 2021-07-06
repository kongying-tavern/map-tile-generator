const fs = require("fs");
const nodePath = require("path");
const nodeCanvas = require("canvas");

function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		ensureDir(nodePath.dirname(dir));
		fs.mkdirSync(dir);
	}
}

function ensureParentDir(path) {
    ensureDir(nodePath.dirname(path));
}

function saveBufferToFile(path, buffer) {
    ensureParentDir(path);
    fs.writeFileSync(path, buffer);
}

async function montageImage(files, size, tileSize) {
    const cv = nodeCanvas.createCanvas(size[0], size[1]);
    const ctx = cv.getContext("2d", { alpha: false });
    let x, y, col;
    ctx.fillStyle = "black";
    ctx.fill();
    for (x = 0; x < files.length; x++) {
        col = files[x];
        for (y = 0; y < col.length; y++) {
            let tile = await nodeCanvas.loadImage(fs.readFileSync(col[y]));
            ctx.drawImage(
                tile,
                tileSize[0] * x, tileSize[1] * y,
                tileSize[0], tileSize[1]
            );
        }
    }
    return cv;
}

async function applyMask(cv, maskFilePath) {
    let mask = await nodeCanvas.loadImage(fs.readFileSync(maskFilePath));
    let ctx = cv.getContext("2d");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(mask, 0, 0, cv.width, cv.height);
    ctx.restore();
    return cv;
}

async function clipIntoTiles(drawable, scale, tileSize, onTileComplete) {
    let tileX = 0, tileY = 0;
    let xOffset, yOffset;
    for (tileX = 0, xOffset = 0; xOffset < drawable.width; tileX++, xOffset += tileSize[0] * scale) {
        for (tileY = 0, yOffset = 0; yOffset < drawable.height; tileY++, yOffset += tileSize[1] * scale) {
            let cv = nodeCanvas.createCanvas(tileSize[0], tileSize[1]);
            let ctx = cv.getContext("2d", { alpha: false });
            ctx.fillStyle = "black";
            ctx.fill();
            ctx.drawImage(
                drawable,
                xOffset, yOffset, tileSize[0] * scale, tileSize[1] * scale,
                0, 0, tileSize[0], tileSize[1]
            );
            await onTileComplete(tileX, tileY, cv);
        }
    }
}

async function main() {
    console.time("Total");

    console.time("Montage image");
    let montagedImage = await montageImage(
        new Array(6).fill(0).map((_, x) => {
            return new Array(6).fill(0).map((_, y) => {
                return nodePath.resolve(__dirname, "input", (y + 1) + "_" + (x + 1) + ".png");
            })
        }),
        [2048 * 6, 2048 * 6],
        [2048, 2048]
    );
    console.timeEnd("Montage image");

    console.time("Apply mask to montaged image");
    montagedImage = await applyMask(montagedImage, nodePath.resolve(__dirname, "input", "mask.png"));
    console.timeEnd("Apply mask to montaged image");

    let montagedImagePath = nodePath.resolve(__dirname, "output", "image", "output.png");
    if (!fs.existsSync(montagedImagePath)) { // You should remove output.png first to regenerate
        console.time("Save montaged image");
        saveBufferToFile(montagedImagePath, montagedImage.toBuffer("image/png", {
            compressionLevel: 6 // 9 takes too much time
        }));
        console.timeEnd("Save montaged image");
    }

    let montagedImageJPEGPath = nodePath.resolve(__dirname, "output", "image", "output.jpg");
    if (!fs.existsSync(montagedImageJPEGPath)) { // You should remove output.jpg first to regenerate
        console.time("Save montaged image jpeg");
        saveBufferToFile(montagedImageJPEGPath, montagedImage.toBuffer("image/jpeg", {
            quality: 0.9
        }));
        console.timeEnd("Save montaged image jpeg");
    }

    let zoomLevel, zoomValue;
    const maxZoomLevel = Math.ceil(Math.log(Math.max(montagedImage.width, montagedImage.height)) / Math.LN2);
    const minZoomLevel = 8;
    console.time("Generate tiles");
    for (zoomLevel = maxZoomLevel, zoomValue = 1; zoomLevel >= minZoomLevel; zoomLevel--, zoomValue *= 2) {
        console.time("Generate tiles for zoomLevel = " + zoomLevel);
        await clipIntoTiles(montagedImage, zoomValue, [256, 256], (x, y, tileImage) => {
            let outputPath = nodePath.resolve(__dirname, "output", "tiles", zoomLevel.toString(), x + "_" + y + ".jpg");
            ensureParentDir(outputPath);
            saveBufferToFile(outputPath, tileImage.toBuffer("image/jpeg", {
                quality: 0.9
            }));
        });
        console.timeEnd("Generate tiles for zoomLevel = " + zoomLevel);
        console.time("Generate tiles for zoomLevel = " + zoomLevel + "@2x");
        await clipIntoTiles(montagedImage, zoomValue / 2, [512, 512], (x, y, tileImage) => {
            let outputPath = nodePath.resolve(__dirname, "output", "tiles", zoomLevel.toString() + "@2x", x + "_" + y + ".jpg");
            ensureParentDir(outputPath);
            saveBufferToFile(outputPath, tileImage.toBuffer("image/jpeg", {
                quality: 0.9
            }));
        });
        console.timeEnd("Generate tiles for zoomLevel = " + zoomLevel + "@2x");
    }
    console.timeEnd("Generate tiles");

    console.timeEnd("Total");
}

main().catch(err => {
    console.error(err);
    debugger;
});