window.onload = () => {
  const plot = new lumo.Plot('#plot', {
    inertia: true,
    zoom: 2,
    maxZoom: 47
  });
  window.plot = plot;
  // global gl context for texture rendering
  window.gl = document.createElement("canvas").getContext("webgl");
  if (!gl.getExtension("OES_texture_float")) {
    alert("cant pass in floats, use 8-bit values instead.");
    return;
  }
  init();
  addTextureOverlay(plot);
};

const SHADER_GLSL = {
  vert:
    `
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
      float rHeight = 4.0;
      vec4 col = vec4(0.0,0.0,0.0,0.0);
      float l_count = 0.0;
      vec2 temp_FragCoord = gl_FragCoord.xy;
      for (int dx = 0; dx < 2; dx++){
        for (int dy = 0; dy < 2; dy++){
          vec2 position = (temp_FragCoord.xy + vec2(dx,dy)/3.0) * scale + center;
          vec2 z = vec2(0.0,0.0);
          for (int i = 0; i < 100; i++){
            z = position + vec2(
              z.x*z.x-z.y*z.y,
              2.0*z.x*z.y
            );
            if (length(z) > 2.0){
              col += texture2D(a_texture, vec2(0.5,mod(float(i+4), 32.0)/32.0))/255.0;
              l_count++;
              break;
            }
          }
        }
      }
      if (l_count != 0.0){
        gl_FragColor = col/l_count;
      } else {
        gl_FragColor = vec4(0,0,0,1.0);
      }
    }
    `
};

// WebGL Texture Layer
function addTextureOverlay(plot) {
  const texture = new lumo.TileLayer({
    renderer: new lumo.ImageTileRenderer()
  });
  texture.requestTile = (coord, done) => {
    done(null, createTileTexture(coord));
  };
  plot.add(texture);
}

function numToCol(num, d) {
  if (num % 2 == 1) {
    return Math.floor(-1 * ((num * d) % 256 ) + 256).toString(16).padStart(2,0);
  }
  return Math.floor((num * d) % 256).toString(16).padStart(2,0);
}

function createTileCanvas(coord) {
  var canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  var ctx = canvas.getContext("2d");
  const d = 256 / 2**(coord.z);
  ctx.fillStyle = '#88' + numToCol(coord.x, d) + numToCol(coord.y, d);
  console.log(coord, '#ff' + Math.floor(coord.x * d).toString(16) + Math.floor(coord.y * d).toString(16))
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'black';
  ctx.font = "24px Arial";
  ctx.fillText(`${coord.hash}`, 10, 50);
  return canvas;
}

function init() {
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

  var fragShader = gl.createShader(gl.FRAGMENT_SHADER);     // Create fragment shader object
  gl.shaderSource(fragShader, SHADER_GLSL.frag);            // Attach fragment shader source code
  gl.compileShader(fragShader);                             // Compile the fragment shader

  // Create a shader program object to store combined shader program
  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);               // Attach a vertex shader
  gl.attachShader(shaderProgram, fragShader);               // Attach a fragment shader
  gl.linkProgram(shaderProgram);                            // Link both programs
  glEnv.shaderProgram = shaderProgram;

  gl.clearColor(0.5, 0.5, 0.5, 0.9);                        // Clear the canvas
  gl.enable(gl.DEPTH_TEST);                                 // Enable the depth test
  gl.clear(gl.COLOR_BUFFER_BIT);                            // Clear the color buffer bit
  
  // palette for colouring iterations
  var palette = [
   66,  30,  15, 255,
   45,  13,  20, 255,
   25,   7,  26, 255,
   20,   4,  36, 255,
    9,   1,  55, 255,
    6,   2,  60, 255,
    4,   4,  73, 255,
    2,   5,  86, 255,
    1,   7, 100, 255,
    6,  25, 119, 255,
   12,  44, 138, 255,
   18,  63, 157, 255,
   24,  82, 177, 255,
   40, 103, 193, 255,
   57, 125, 209, 255,
   95, 152, 219, 255,
  134, 181, 229, 255,
  172, 208, 239, 255,
  211, 236, 248, 255,
  226, 234, 220, 255,
  241, 233, 191, 255,
  244, 217, 143, 255,
  248, 201,  95, 255,
  251, 185,  47, 255,
  255, 170,   0, 255,
  235, 150,   0, 255,
  204, 128,   0, 255,
  178, 108,   0, 255,
  153,  87,   0, 255,
  129,  70,   1, 255,
  106,  52,   3, 255,
   80,  41,   8, 255,
  ];
  
  //*** create target texture
  const width = 256;
  const height = 256;
  gl.canvas.width = width;
  gl.canvas.height = height;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);

  // define size and format of level 0
  const level = 0;
  const internalFormat = gl.RGBA;
  const border = 0;
  const format = gl.RGBA;
  const type = gl.UNSIGNED_BYTE;
  const data = null;
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border,
                format, type, data);
 
  // set the filtering so we don't need mips
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  var textureUnit = 3;
  gl.activeTexture(gl.TEXTURE0 + textureUnit);
  gl.bindTexture(gl.TEXTURE_2D, textureFromFloats(gl, 1, 32, new Float32Array(palette)));
  glEnv.textureUnit = textureUnit;
  window.glEnv = glEnv;
  gl.useProgram(glEnv.shaderProgram);
}

function createTileTexture(coord) {
  console.log(coord);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const width = 256;
  const height = 256;
  // Use the combined shader program object

  /* Associate the shader programs to buffer objects */
  // coordinate transformantion
  const step = (4 / 2**coord.z);
  const trans = {
    k: step/256,
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
  return gl.canvas;
}

// Float32Array as texture for variable indexing
// https://stackoverflow.com/questions/19529690/index-expression-must-be-constant-webgl-glsl-error
function textureFromFloats(gl, width, height, float32Array) {
  var oldActive = gl.getParameter(gl.ACTIVE_TEXTURE);
  gl.activeTexture(gl.TEXTURE15);

  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 
                width, height, 0,
                gl.RGBA, gl.FLOAT, float32Array);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(oldActive);
  return texture;
}
