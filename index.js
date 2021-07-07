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

async function createFile(resolveArgs, callback, skipIfExists) {
    const path = nodePath.resolve(...resolveArgs);
    if (!skipIfExists || !fs.existsSync(path)) {
		ensureParentDir(path);
        fs.writeFileSync(path, await callback());
	}
};

async function generateCanvasFromFile(resolveArgs) {
    const filePath = nodePath.resolve(...resolveArgs);
    const parentPath = nodePath.resolve(filePath, "..");
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const cv = nodeCanvas.createCanvas(data.size[0], data.size[1]);
    const alphaEnabled = data.alpha;
    const ctx = cv.getContext("2d", { alpha: alphaEnabled });
    if (!alphaEnabled) {
        ctx.fillStyle = "black";
        ctx.fill();
    }
    if (data.type == "tile") {
        let tiles = data.tiles;
        let x, y, col, tileWidth = data.size[0] / tiles.length, tileHeight;
        for (x = 0; x < tiles.length; x++) {
            col = tiles[x];
            tileHeight = data.size[1] / col.length;
            for (y = 0; y < col.length; y++) {
                if (col[y]) {
                    let tile = await nodeCanvas.loadImage(fs.readFileSync(nodePath.resolve(parentPath, col[y])));
                    ctx.drawImage(
                        tile,
                        tileWidth * x, tileHeight * y,
                        tileWidth, tileHeight
                    );
                }
            }
        }
    } else if (data.type == "slice") {
        let slices = data.slices;
        let i;
        for (i = 0; i < slices.length; i++) {
            let slice = await nodeCanvas.loadImage(fs.readFileSync(nodePath.resolve(parentPath, slices[i].path)));
            ctx.drawImage(
                slice,
                ...slices[i].rect
            );
        }
    }
    return cv;
}

function applyLayer(cv, layer, composite) {
    let ctx = cv.getContext("2d");
    ctx.save();
    ctx.globalCompositeOperation = composite || "source-over";
    ctx.drawImage(layer, 0, 0, cv.width, cv.height);
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

async function processMap(mapConfig, inputPath, outputPath) {
    const mapId = mapConfig.id;

    console.time(mapId);
    console.timeLog(mapId, "Generate map image");
    let mapImage = await generateCanvasFromFile([inputPath, mapConfig.map]);

    console.timeLog(mapId, "Generate accessible border");
    let accessibleBorder = await generateCanvasFromFile([inputPath, mapConfig.accessibleBorder]);

    console.timeLog(mapId, "Save accessible border");
    createFile([outputPath, mapId, "images", "accessible_border.png"], () => {
        return accessibleBorder.toBuffer("image/png", {
            compressionLevel: 9
        });
    });

    console.timeLog(mapId, "Apply accessible border");
    mapImage = applyLayer(mapImage, accessibleBorder, "screen");

    console.timeLog(mapId, "Save map");
    createFile([outputPath, mapId, "images", "map.png"], () => {
        return mapImage.toBuffer("image/png", {
            compressionLevel: 6
        });
    }, true);

    console.timeLog(mapId, "Save map jpeg");
    createFile([outputPath, mapId, "images", "map.jpg"], () => {
        return mapImage.toBuffer("image/jpeg", {
            quality: 0.9
        });
    });

    let zoomLevel, zoomValue;
    const maxZoomLevel = Math.ceil(Math.log(Math.max(mapImage.width, mapImage.height)) / Math.LN2);
    const minZoomLevel = 8;
    console.timeLog(mapId, "Generate tiles");
    for (zoomLevel = maxZoomLevel, zoomValue = 1; zoomLevel >= minZoomLevel; zoomLevel--, zoomValue *= 2) {
        console.timeLog(mapId, "Generate tiles for zoomLevel = " + zoomLevel);
        await clipIntoTiles(mapImage, zoomValue, [256, 256], (x, y, tileImage) => {
            createFile([outputPath, mapId, "tiles", zoomLevel + "", x + "_" + y + ".jpg"], () => {
                return tileImage.toBuffer("image/jpeg", {
                    quality: 0.9
                });
            });
        });

        console.timeLog(mapId, "Generate tiles for zoomLevel = " + zoomLevel + "@2x");
        await clipIntoTiles(mapImage, zoomValue / 2, [512, 512], (x, y, tileImage) => {
            createFile([outputPath, mapId, "tiles", zoomLevel + "@2x", x + "_" + y + ".jpg"], () => {
                return tileImage.toBuffer("image/jpeg", {
                    quality: 0.9
                });
            });
        });
    }

    console.timeEnd(mapId);
}

async function main() {
    const config = JSON.parse(fs.readFileSync(nodePath.resolve(__dirname, "input", "config.json"), "utf-8"));
    let i;
    for (i = 0; i < config.maps.length; i++) {
        await processMap(
            config.maps[i],
            nodePath.resolve(__dirname, "input"),
            nodePath.resolve(__dirname, "output")
        );
    }
}

main().catch(err => {
    console.error(err);
    debugger;
});