window.onload = () => {
  const plot = new lumo.Plot('#plot', {
    inertia: true,
    zoom: 2,
    center: { x: 0.33, y: 0.5 },
    maxZoom: 47,
    tileSize: 128
  });
  window.plot = plot;

  
  const texture = new lumo.TileLayer({
    renderer: new lumo.ImageTileRenderer()
  });

  let tileCallback = {};
  let worker = new Worker('worker.js');

  texture.requestTile = (coord, done) => {
    worker.postMessage({'cmd': 'getTile', 'coord': coord});
    tileCallback[coord.hash] = done;
  };

  plot.add(texture);

  worker.onmessage = (e) => {
    tileCallback[e.data.hash](null, e.data.tile);
    delete tileCallback[e.data.hash];
  }
};
