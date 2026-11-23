// Keyboard, mouse and on-screen touch input.
// The game reads this each frame; edges (justPressed) clear at frame end.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseUsed = false;
    this.touch = { up: false, down: false, left: false, right: false, e: false, f: false, brake: false };
    this.touchRects = null; // { name: {x,y,w,h} } in screen pixels, set by the HUD
    this._touchActive = new Map(); // pointerId -> button name

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); });

    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
      if (e.pointerType === 'mouse') this.mouseUsed = true;
    });
    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
      if (e.pointerType === 'mouse') {
        this.mouseDown = true;
        this.mouseClicked = true;
        this.mouseUsed = true;
      } else {
        const name = this._hitTouch(this.mouseX, this.mouseY);
        if (name) {
          this.touch[name] = true;
          this._touchActive.set(e.pointerId, name);
          e.preventDefault();
        }
      }
    });
    const up = (e) => {
      if (e.pointerType === 'mouse') this.mouseDown = false;
      const name = this._touchActive.get(e.pointerId);
      if (name) { this.touch[name] = false; this._touchActive.delete(e.pointerId); }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  _hitTouch(x, y) {
    if (!this.touchRects) return null;
    for (const [name, r] of Object.entries(this.touchRects)) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return name;
    }
    return null;
  }

  isDown(code) { return this.down.has(code); }

  justPressed(code) { return this.pressed.has(code); }

  anyPressed(codes) { return codes.some((c) => this.pressed.has(c)); }

  // Movement axis from WASD/arrows or the touch D-pad. y is down-positive.
  moveAxis() {
    let x = 0, y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft') || this.touch.left) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight') || this.touch.right) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp') || this.touch.up) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown') || this.touch.down) y += 1;
    return { x, y };
  }

  get interact() { return this.justPressed('KeyE') || this.touch.e; }
  get attack() { return this.justPressed('KeyF') || this.touch.f || this.mouseClicked; }
  get handbrake() { return this.isDown('Space') || this.touch.brake; }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    this.touch.e = false;
    this.touch.f = false;
  }
}
