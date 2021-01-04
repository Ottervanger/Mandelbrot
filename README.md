# Mandelbrot
Mandelbrot Set renderer using WebGL.

Hosted here: [Ottervanger.GitHub.io/Mandelbrot](https://ottervanger.github.io/Mandelbrot/)

## Version 1.0
Tile rendering: lumo.js detects which tiles should be rendered.
Tiles are requested using a 3-dimensional coordinate system.
Tiles are rendered to a separate canvas using WebGL and a custom fragment shader.
Tiles are send back to lumo.js wich renders them on the visible canvas in the DOM.
lumo.js is able to zoom up to about `2^45` times.
Currently, the Mandelbrot tile renderer is limited to single precision floats, meaning max zoom of about `2^19` times.

## Planned Features
- Deeper zoom using [emulated double precision floats](https://blog.cyclemap.link/2011-06-09-glsl-part2-emu/)
- [Supersampling Anti-Aliasing](https://en.wikipedia.org/wiki/Supersampling)
- [Adaptive Supersampling using distance estimate](https://mathr.co.uk/blog/2014-11-22_adaptive_supersampling_using_distance_estimate.html)
- Move Mandelbrot computations to separate worker using [Offscreen Canvas](https://newinweb.com/2018/09/10/offscreen-canvas/)
- Other optimizations
- Basic UI