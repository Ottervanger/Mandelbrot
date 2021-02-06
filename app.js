window.onload = () => {
  const plot = new lumo.Plot('#plot', {
    inertia: true,
    zoom: 2,
    center: { x: 0.33, y: 0.5 },
    maxZoom: 47
  });
  window.plot = plot;

  
  const texture = new lumo.TileLayer({
    renderer: new lumo.ImageTileRenderer()
  });

  let tileCallback = {};
  let worker = new Worker('worker.js');
  window.worker = worker;
  worker.atWork = false;

  texture.requestTile = (coord, done) => {
    tileCallback[coord.hash] = {coord: coord, done: done};
    if (worker.atWork === false) {
      nextJob();
    }
  };

  function nextJob() {
    let keys = Object.keys(tileCallback);
    if (keys.length > 0) {
      worker.atWork = true;
      worker.postMessage({'cmd': 'getTile', 'coord': tileCallback[keys[0]].coord});
    }
  }

  plot.add(texture);

  worker.onmessage = (e) => {
    tileCallback[e.data.hash].done(null, e.data.tile);
    delete tileCallback[e.data.hash];
    worker.atWork = false;
    setTimeout(nextJob, 20);
  }
};
