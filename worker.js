const VERT_SHADER =
  `
  precision highp float;
  attribute vec2 coordinates;
  void main(void) {
    gl_Position = vec4(coordinates,0.0, 1.0);
  }
  `;
function getFragShader(hip, depth) {
  if (hip) {
    return `
      precision highp float;

      uniform sampler2D a_texture;
      uniform float scale;
      uniform vec2 center;
      uniform vec2 centerP;

      //-----------------------
      float times_frc(float a, float b) {
        return mix(0.0, a * b, b != 0.0 ? 1.0 : 0.0);
      }

      float plus_frc(float a, float b) {
        return mix(a, a + b, b != 0.0 ? 1.0 : 0.0);
      }

      float minus_frc(float a, float b) {
        return mix(a, a - b, b != 0.0 ? 1.0 : 0.0);
      }

      // Double emulation based on GLSL Mandelbrot Shader by Henry Thasler (www.thasler.org/blog)
      //
      // Emulation based on Fortran-90 double-single package. See http://crd.lbl.gov/~dhbailey/mpdist/
      // Substract: res = ds_add(a, b) => res = a + b
      vec2 add (vec2 dsa, vec2 dsb) {
        vec2 dsc;
        float t1, t2, e;

        t1 = plus_frc(dsa.x, dsb.x);
        e = minus_frc(t1, dsa.x);
        t2 = plus_frc(plus_frc(plus_frc(minus_frc(dsb.x, e), minus_frc(dsa.x, minus_frc(t1, e))), dsa.y), dsb.y);
        dsc.x = plus_frc(t1, t2);
        dsc.y = minus_frc(t2, minus_frc(dsc.x, t1));
        return dsc;
      }

      // Substract: res = ds_sub(a, b) => res = a - b
      vec2 sub (vec2 dsa, vec2 dsb) {
        vec2 dsc;
        float e, t1, t2;

        t1 = minus_frc(dsa.x, dsb.x);
        e = minus_frc(t1, dsa.x);
        t2 = minus_frc(plus_frc(plus_frc(minus_frc(minus_frc(0.0, dsb.x), e), minus_frc(dsa.x, minus_frc(t1, e))), dsa.y), dsb.y);

        dsc.x = plus_frc(t1, t2);
        dsc.y = minus_frc(t2, minus_frc(dsc.x, t1));
        return dsc;
      }

      // Compare: res = -1 if a < b
      //              = 0 if a == b
      //              = 1 if a > b
      float cmp(vec2 dsa, vec2 dsb) {
        if (dsa.x < dsb.x) {return -1.;}
        if (dsa.x > dsb.x) {return  1.;}
        if (dsa.y < dsb.y) {return -1.;}
        if (dsa.y > dsb.y) {return  1.;}
        return 0.;
      }

      // Multiply: res = ds_mul(a, b) => res = a * b
      vec2 mul (vec2 dsa, vec2 dsb) {
        vec2 dsc;
        float c11, c21, c2, e, t1, t2;
        float a1, a2, b1, b2, cona, conb, split = 8192.;

        cona = times_frc(dsa.x, split);
        conb = times_frc(dsb.x, split);
        a1 = minus_frc(cona, minus_frc(cona, dsa.x));
        b1 = minus_frc(conb, minus_frc(conb, dsb.x));
        a2 = minus_frc(dsa.x, a1);
        b2 = minus_frc(dsb.x, b1);

        c11 = times_frc(dsa.x, dsb.x);
        c21 = plus_frc(times_frc(a2, b2), plus_frc(times_frc(a2, b1), plus_frc(times_frc(a1, b2), minus_frc(times_frc(a1, b1), c11))));

        c2 = plus_frc(times_frc(dsa.x, dsb.y), times_frc(dsa.y, dsb.x));

        t1 = plus_frc(c11, c2);
        e = minus_frc(t1, c11);
        t2 = plus_frc(plus_frc(times_frc(dsa.y, dsb.y), plus_frc(minus_frc(c2, e), minus_frc(c11, minus_frc(t1, e)))), c21);

        dsc.x = plus_frc(t1, t2);
        dsc.y = minus_frc(t2, minus_frc(dsc.x, t1));

        return dsc;
      }

      // create double-single number from float
      vec2 set(float a) {
        return vec2(a, 0.0);
      }

      vec2 complexMul(vec2 a, vec2 b) {
        return vec2(a.x*b.x -  a.y*b.y,a.x*b.y + a.y * b.x);
      }

      // double complex multiplication
      vec4 dcMul(vec4 a, vec4 b) {
        return vec4(sub(mul(a.xy,b.xy),mul(a.zw,b.zw)),add(mul(a.xy,b.zw),mul(a.zw,b.xy)));
      }

      vec4 dcAdd(vec4 a, vec4 b) {
        return vec4(add(a.xy,b.xy),add(a.zw,b.zw));
      }

      // Length of double complex
      vec2 dcLength(vec4 a) {
        return add(mul(a.xy,a.xy),mul(a.zw,a.zw));
      }

      vec4 dcSet(vec2 a) {
        return vec4(a.x,0.,a.y,0.);
      }

      vec4 dcSet(vec2 a, vec2 ad) {
        return vec4(a.x, ad.x,a.y,ad.y);
      }

      // Multiply double-complex with double
      vec4 dcMul(vec4 a, vec2 b) {
        return vec4(mul(a.xy,b),mul(a.wz,b));
      }

      //-----------------------

      void main() {
        vec3 col = vec3(0.0);
        vec2 samples[4];
        vec2 coord = gl_FragCoord.xy;
        samples[0] = vec2(-.12,-.36);
        samples[1] = vec2( .36,-.12);
        samples[2] = vec2(-.36, .12);
        samples[3] = vec2( .12, .36);

        for (int ss = 0; ss < 4; ss++) {
          vec2 p = coord.xy + samples[ss];
          vec4 c = dcAdd(dcMul(dcSet(p),vec2(scale,0.)),dcSet(center, centerP));
          vec4 z = dcSet(vec2(0.0,0.0));
          for (int i = 0; i < ${depth}; i++){
            z = dcAdd(dcMul(z,z),c);
            if (cmp(dcLength(z), set(4.0))>0.){
              col += texture2D(a_texture, vec2(0.5,(.5/16.0) + float(i)/300.0)).xyz;
              break;
            }
          }
        }
        gl_FragColor = vec4(col/4.0, 1.0);
      }`;
  } else {
    return `
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
          for (int i = 0; i < ${depth}; i++){
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
      }`;
  }
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

function buildShader(source, type) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  console.log(gl.getShaderInfoLog(shader));
  return shader;
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
  glEnv.shaderProgram = buildShaderProgram();
  gl.flush();
  gl.finish();
  return glEnv;
}

function buildShaderProgram(options) {
  // Default options.
  options = {hip: false, depth: 3000, ...options};
  var vertShader = buildShader(VERT_SHADER, gl.VERTEX_SHADER);
  var fragShader = buildShader(getFragShader(options.hip, options.depth), gl.FRAGMENT_SHADER);
  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);
  gl.useProgram(shaderProgram);
  return shaderProgram;
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
  gl.uniform2f(gl.getUniformLocation(glEnv.shaderProgram, "center"), Math.fround(trans.x), Math.fround(trans.y));
  gl.uniform2f(gl.getUniformLocation(glEnv.shaderProgram, "centerP"), trans.x - Math.fround(trans.x), trans.y - Math.fround(trans.y));
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
  } else if (e.data.cmd === 'setShaderOptions') {
    glEnv.shaderProgram = buildShaderProgram(e.data.options);
  }
};

