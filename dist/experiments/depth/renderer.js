// Independent WebGL parallax-occlusion renderer. No DepthFlow source is copied.
const vertex = `attribute vec2 position;
varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 uv;
uniform sampler2D photo;
uniform sampler2D depth;
uniform vec2 offset;
uniform float amount;
float surface(vec2 p){return 1.-texture2D(depth,clamp(p,0.,1.)).r;}
void main(){
  // Modest overscan conceals the image boundary; no invented background pixels.
  vec2 base=(uv-.5)/(1.+.075*amount)+.5;
  vec2 ray=offset*amount;
  float hit=1.;
  for(int i=0;i<48;i++){
    float t=float(i)/47.;
    if(t>=surface(base+ray*(t-.5))){hit=t;break;}
  }
  float lo=max(0.,hit-1./47.);
  float hi=hit;
  for(int j=0;j<5;j++){
    float mid=(lo+hi)*.5;
    if(mid>=surface(base+ray*(mid-.5)))hi=mid;else lo=mid;
  }
  vec2 p=base+ray*((lo+hi)*.5-.5);
  gl_FragColor=vec4(texture2D(photo,clamp(p,0.,1.)).rgb,1.);
}`;

export class DepthRenderer {
  constructor(canvas) {
    this.canvas=canvas;
    const gl=this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
    if(!gl) throw new Error('Depth motion is unavailable in this browser. The original photo is still available.');
    const compile=(type,source)=>{
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message);}
      return shader;
    };
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
    const program=this.program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Depth renderer could not start.');
    gl.useProgram(program);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const location=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
    this.uniforms=Object.fromEntries(['photo','depth','offset','amount'].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.uniform1i(this.uniforms.photo,0);gl.uniform1i(this.uniforms.depth,1);
    this.textures=[];
  }
  setImages(photo,depth){
    const gl=this.gl;
    this.textures.forEach(texture=>gl.deleteTexture(texture));this.textures=[];
    [photo,depth].forEach((image,index)=>{
      const texture=gl.createTexture();this.textures.push(texture);gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    });
  }
  resize(width,height){
    const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1400000/(width*height)));
    this.canvas.width=Math.max(1,Math.round(width*ratio));this.canvas.height=Math.max(1,Math.round(height*ratio));
    this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
  }
  draw(x,y,amount){
    const gl=this.gl;gl.uniform2f(this.uniforms.offset,x,y);gl.uniform1f(this.uniforms.amount,amount);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  dispose(){
    this.textures.forEach(texture=>this.gl.deleteTexture(texture));this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);
  }
}
