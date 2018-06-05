
var INF = 1e20;
function getEl(id) {
    return document.getElementById(id);
}

// Stores the x- and y- position of glyphs in the sprite sheet so formed 
// format: sdfs['a'].x or sdfs['a'].y
var sdfs = {};

// list of all characters to be included in the sprite sheet
var chars = "abcdefghijklmnopqrstuvwxyzH";

function TinySDF() {
    // Member variables for configurations for font-style and box of the font
    this.fontSize = 44;
    this.buffer = this.fontSize / 8;
    this.radius = this.fontSize / 3;
    this.cutoff = 0.25;
    this.fontFamily = 'sans-serif';
    this.fontWeight = 'normal';
    // Size of one box of character
    var size = this.size = this.fontSize + this.buffer * 2;

    // Member varaibles for single canvas element on which single character is to be drawn
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.font = this.fontWeight + ' ' + this.fontSize + 'px ' + this.fontFamily;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = 'black';
    // Work-around: https://bugzilla.mozilla.org/show_bug.cgi?id=737852
    this.middle = Math.round((size / 2) * (navigator.userAgent.indexOf('Gecko/') >= 0 ? 1.2 : 1));

    // Member variables for temp arrays required for the distance transform
    this.gridOuter = new Float64Array(size * size);
    this.gridInner = new Float64Array(size * size);
    this.f = new Float64Array(size);
    this.d = new Float64Array(size);
    this.z = new Float64Array(size + 1);
    this.v = new Int16Array(size);
}

// Returns the alpha channel corresponding to the 
TinySDF.prototype.draw = function (char) {
    // Clear the area and draw the glyph
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.ctx.fillText(char, this.buffer, this.middle);
    var imgData = this.ctx.getImageData(0, 0, this.size, this.size);
    var alphaChannel = new Uint8ClampedArray(this.size * this.size);

    // ??? I don't know what outer and inner grids are.
    for (var i = 0; i < this.size * this.size; i++) {
        var a = imgData.data[i * 4 + 3] / 255; // alpha value
        this.gridOuter[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
        this.gridInner[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
    }

    // edt transform is working only on these grid areas. OK
    edt(this.gridOuter, this.size, this.size, this.f, this.d, this.v, this.z);
    edt(this.gridInner, this.size, this.size, this.f, this.d, this.v, this.z);

    // Maybe radius is doing some gamma corrections and then storing in alpha channels
    for (i = 0; i < this.size * this.size; i++) {
        var d = this.gridOuter[i] - this.gridInner[i];
        alphaChannel[i] = Math.max(0, Math.min(255, Math.round(255 - 255 * (d / this.radius + this.cutoff))));
    }
    return alphaChannel;
};

// 2D Euclidean distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
function edt(data, width, height, f, d, v, z) {
    for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
            f[y] = data[y * width + x];
        }
        edt1d(f, d, v, z, height);
        for (y = 0; y < height; y++) {
            data[y * width + x] = d[y];
        }
    }
    for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
            f[x] = data[y * width + x];
        }
        edt1d(f, d, v, z, width);
        for (x = 0; x < width; x++) {
            data[y * width + x] = Math.sqrt(d[x]);
        }
    }
}

// 1D squared distance transform
function edt1d(f, d, v, z, n) {
    v[0] = 0;
    z[0] = -INF;
    z[1] = +INF;

    for (var q = 1, k = 0; q < n; q++) {
        var s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
            k--;
            s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = +INF;
    }

    for (q = 0, k = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
}

// Convert alpha-only to RGBA so we can use convenient
// `putImageData` for building the composite bitmap
function makeRGBAImageData(alphaChannel, size) {
    var imageData = ctx.createImageData(size, size);
    var data = imageData.data;
    for (var i = 0; i < alphaChannel.length; i++) {
        data[4 * i + 0] = alphaChannel[i];
        data[4 * i + 1] = alphaChannel[i];
        data[4 * i + 2] = alphaChannel[i];
        data[4 * i + 3] = 255;
    }
    return imageData;
}

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

function makeSpriteSheet() {
    var h = 0,
        w = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Object that returns glyph data on 'draw(char)' call
    var sdf = new TinySDF();
    // Drawing all Characters in a single canvas object
    for (var y = 0, i = 0; y + sdf.size <= canvas.height && i < chars.length; y += sdf.size) {
        for (var x = 0; x + sdf.size <= canvas.width && i < chars.length; x += sdf.size) {
            var imgData = makeRGBAImageData(sdf.draw(chars[i]), sdf.size);
            ctx.putImageData(imgData, x, y);
            sdfs[chars[i]] = { x: x, y: y };
            i++;
            w += sdf.size;
        }
        h += sdf.size;
    }    
    var ret = ctx.getImageData(0, 0, w, h);
    return ret;
}

/**
 * Actually, Alpha Channel is a 2D matrix of n-rows and 4 columns(representing RGBA)
 * Maybe in sequence it is giving all the pixels color value.
 */

var sprite = makeSpriteSheet();
var testCtx = getEl("test-canvas").getContext("2d");
testCtx.putImageData(sprite, 0, 0);