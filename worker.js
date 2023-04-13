const SHADER_GLSL = {
  vert:
    `
    precision highp float;
    attribute vec2 coordinates;
    void main(void) {
      gl_Position = vec4(coordinates,0.0, 1.0);
    }
    `,
  frag:
    `
    precision highp float;
    uniform vec2 resolution;
    uniform sampler2D a_texture;
    uniform float scale;
    uniform vec2 center;

    void main() {
      vec2 samples[4];
      vec2 coord = gl_FragCoord.xy;
      samples[0] = vec2(-.12,-.36);
      samples[1] = vec2( .36,-.12);
      samples[2] = vec2(-.36, .12);
      samples[3] = vec2( .12, .36);

      vec3 col = vec3(0.0);
      for (int ss = 0; ss < 4; ss++) {
        vec2 c = (coord + samples[ss]) * scale + center;
        vec2 z = vec2(0.0);
        vec2 zz = vec2(0.0);
        for (int i = 0; i < 2000; i++){
          z = c + vec2(
            zz.x - zz.y,
            2.0 * z.x * z.y
          );
          zz = vec2(z.x * z.x, z.y * z.y);
          if (zz.x + zz.y > 4.0){
            col += texture2D(a_texture, vec2(0.5,(.5/16.0) + float(i)/300.0)).xyz;
            break;
          }
        }
      }
      gl_FragColor = vec4(col/4.0, 1.0);
    }
    `
};

function numToCol(num, d) {
  if (num % 2 == 1) {
    return Math.floor(-1 * ((num * d) % 256 ) + 256).toString(16).padStart(2,0);
  }
  return Math.floor((num * d) % 256).toString(16).padStart(2,0);
}

function createTileCanvas(coord) {
  // var canvas = document.createElement('canvas');
  const width = 256;
  const height = width;
  var canvas = new OffscreenCanvas(width, height);
  var ctx = canvas.getContext("2d");
  const d = width / 2**(coord.z);
  ctx.fillStyle = '#88' + numToCol(coord.x, d) + numToCol(coord.y, d);
  console.log(coord, '#ff' + Math.floor(coord.x * d).toString(16) + Math.floor(coord.y * d).toString(16))
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'black';
  ctx.font = "24px Arial";
  ctx.fillText(`${coord.hash}`, 10, 50);
  return createImageBitmap(canvas);
}

function init() {
  const width = 128;
  const height = width;
  gl = (new OffscreenCanvas(width, height)).getContext("webgl");
  gl.canvas.addEventListener("webglcontextlost", (e) => {
    alert('Error: WebGL context lost. Try running on more powerfull hardware.');
  }, false);
  const glEnv = {};
  //*** prepare for draw
  var vertices = [ 1,-1,  -1, 1,  -1,-1,
                   1,-1,  -1, 1,   1, 1];
  var vertex_buffer = gl.createBuffer();                    // Create new buffer object 
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);            // Bind an empty array buffer to buffer
  gl.bufferData(gl.ARRAY_BUFFER, 
             new Float32Array(vertices),                    // Pass the vertices data to the buffer
             gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);                     // Unbind the buffer
  glEnv.vertex_buffer = vertex_buffer;

  /* Create and compile Shader programs */
  var vertShader = gl.createShader(gl.VERTEX_SHADER);       // Create a vertex shader object
  gl.shaderSource(vertShader, SHADER_GLSL.vert);                    // Attach vertex shader source code
  gl.compileShader(vertShader);                             // Compile the vertex shader
  console.log(gl.getShaderInfoLog(vertShader));

  var fragShader = gl.createShader(gl.FRAGMENT_SHADER);     // Create fragment shader object
  gl.shaderSource(fragShader, SHADER_GLSL.frag);            // Attach fragment shader source code
  gl.compileShader(fragShader);                             // Compile the fragment shader
  console.log(gl.getShaderInfoLog(fragShader));

  // Create a shader program object to store combined shader program
  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);               // Attach a vertex shader
  gl.attachShader(shaderProgram, fragShader);               // Attach a fragment shader
  gl.linkProgram(shaderProgram);                            // Link both programs
  glEnv.shaderProgram = shaderProgram;

  gl.enable(gl.DEPTH_TEST);                                 // Enable the depth test
  
  // palette for colouring iterations
  var palette = [
    9,   1,  47, 255,
    4,   4,  73, 255,
    1,   7, 100, 255,
   12,  44, 138, 255,
   24,  82, 177, 255,
   57, 125, 209, 255,
  134, 181, 229, 255,
  211, 236, 248, 255,
  241, 233, 191, 255,
  248, 201,  95, 255,
  255, 170,   0, 255,
  204, 128,   0, 255,
  153,  87,   0, 255,
  106,  52,   3, 255,
   66,  30,  15, 255,
   25,   7,  26, 255,
  ];

  var textureUnit = 3;
  gl.activeTexture(gl.TEXTURE0 + textureUnit);
  gl.bindTexture(gl.TEXTURE_2D, textureFromArray(gl, 1, 16, new Uint8Array(palette)));
  glEnv.textureUnit = textureUnit;
  gl.useProgram(glEnv.shaderProgram);
  gl.flush();
  gl.finish();
  return glEnv;
}

function createTileTexture(coord) {
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const width = gl.canvas.width;
  const height = gl.canvas.height;
  // Use the combined shader program object

  /* Associate the shader programs to buffer objects */
  // coordinate transformantion
  const step = (4 / 2**coord.z);
  const trans = {
    k: step/width,
    x: coord.x * step - 2,
    y: coord.y * step - 2
  };

  // set fragment shader uniforms
  gl.uniform1f(gl.getUniformLocation(glEnv.shaderProgram, "scale"), trans.k);
  gl.uniform2f(gl.getUniformLocation(glEnv.shaderProgram, "center"), trans.x, trans.y);
  gl.uniform2f(gl.getUniformLocation(glEnv.shaderProgram, "resolution"), width, height);
  gl.uniform1i(gl.getUniformLocation(glEnv.shaderProgram, "a_texture"), glEnv.textureUnit);

  // set vertex coordinates
  gl.bindBuffer(gl.ARRAY_BUFFER, glEnv.vertex_buffer);
  var coords = gl.getAttribLocation(glEnv.shaderProgram, "coordinates");  //Get the attribute location
  gl.vertexAttribPointer(coords, 2, gl.FLOAT, false, 0, 0);         //point an attribute to the currently bound VBO
  gl.enableVertexAttribArray(coords);                               //Enable the attribute

  //** draw
  gl.viewport(0, 0, width, height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.flush();
  gl.finish();
  // blocks until draw is done with minimal overhead
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  return createImageBitmap(gl.canvas);
}

function textureFromArray(gl, width, height, arr) {
  var oldActive = gl.getParameter(gl.ACTIVE_TEXTURE);
  gl.activeTexture(gl.TEXTURE15);

  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 
                width, height, 0,
                gl.RGB, gl.UNSIGNED_BYTE, arr);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(oldActive);
  return texture;
}

glEnv = init();

self.onmessage = (e) => {
  if (e.data.cmd === 'getTile') {
    createTileTexture(e.data.coord).then((canvas) => {
      self.postMessage({'tile': canvas, 'hash': e.data.coord.hash}, [canvas]);
    });
  }
};

