# 空荧酒馆原神正交坐标系

状态：草案（Working Draft）

## 稻妻版本前坐标系情况

目前空荧酒馆·原神地图网页版使用的是基于地球空间的坐标系，使用墨卡托投影将地球空间转换为显示空间。纬度范围为南纬66.5度至赤道，经度范围为0度至东经90度。显然这种坐标系没有拓展性，无法适应新地区的加入。

空荧酒馆·原神地图Unity客户端对此进行了优化，使用正交坐标系，大地图左上角为(-4096,-4096),右下角为(4096,4096)。但由于原点并不是确定的点，在适配时较难确定坐标。

米游社·观测枢·原神地图的比例与空荧酒馆·原神地图Unity客户端相同，区别在于米游社·观测枢·原神地图使用蒙德城风神像作为原点。

## 空荧酒馆原神正交坐标系

以下简称“提议坐标系”。

使用空荧酒馆·原神地图Unity客户端使用的坐标系比例，原点设为玉京台中心。

[示例](http://ysmap.projectxero.top/?url=yuanshen.site/default.json&size=4096)

## 坐标转换

由空荧酒馆·原神地图网页版坐标系转为提议坐标系：

```javascript
const originalMapSize = [8192, 8192];
const centerOffsetFromLeftTop = [3568, 6286];
function project(lat, lng) {
    let sinLat = Math.sin(lat * Math.PI / 180);
    return [
        lng / 90 * originalMapSize[0] - centerOffsetFromLeftTop[0],
        -Math.log((1 + sinLat) / (1 - sinLat)) / Math.PI * originalMapSize[1] - centerOffsetFromLeftTop[1]
    ];
}
```

由提议坐标系转为空荧酒馆·原神地图网页版坐标系：

```javascript
function unproject(x, y) {
    return [
        2 * (Math.atan(Math.exp((y + centerOffsetFromLeftTop[1]) / -originalMapSize[1] / 2 * Math.PI))) * 180 / Math.PI - 90,
        (x + centerOffsetFromLeftTop[0]) / originalMapSize[0] * 90
    ];
}
```

## Tile 切割与转换

以只包含单一 Tile 为最小放大级别 8，大地图 1:1 缩放为最大放大级别。每级别的大地图均为前一级在横向与纵向上各放大2倍。

以目前提供的 6x6 大图（12888x12888 pixels）为例，放大级别 8 仅包含一张内容大小为 192x192 的 Tile，而最大放大级别 14 则有 2304 张 256x256 的 Tile。

注意，此处所述的最小放大级别与最大放大级别均为生成的 Tile 支持的放大级别，即所谓的 `NativeZoomLevel`。需要更大或者更小的级别则需要地图框架自行缩放，实际的缩放级别范围请视情况决定。

此外，可选地，部分 Retina 屏幕需要使用更加清晰的 Tile，生成方式已在示例工具链中给出。

[示例工具链](https://gitee.com/KYJGYSDT/map-tile-generator)

[示例 Tile 链接](http://ysmap.projectxero.top/mapdata/yuanshen.site/tiles/12@2x/7_3.jpg)：http://ysmap.projectxero.top/mapdata/yuanshen.site/tiles/{z}{r}/{x}_{y}.jpg

## 适配内容

- 网页版的 Leaflet.js 版本改为使用 `L.CRS.Simple`
- Unity版的坐标适配只需在坐标上加上 `[centerOffsetFromLeftTop[0] - 4096, centerOffsetFromLeftTop[1] - 4096]`
- 后端管理平台适配正交坐标系
- 数据库坐标统一转为正交坐标系
- 网页版的 deck.gl 版本改为使用 `deck.OrthographicView`

## 时间线

- 2021年7月18日前搞定适配
- 随稻妻版本一同公开

## 金苹果群岛

取决于你们希不希望显示在1.7更新后把金苹果群岛放在地图列表上。