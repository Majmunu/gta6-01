// Keyboard, mouse and touch input. One shared state object; the game reads
// it every frame and the menus read the edge-triggered `pressed` set.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    touch: { up: false, down: false, left: false, right: false, action: false, brake: false },
    usingTouch: false,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyE: 'action',
    KeyF: 'attack',
    Space: 'brake',
    KeyM: 'missions',
    KeyP: 'pause', Escape: 'pause',
    Enter: 'confirm',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (action) {
      if (!e.repeat) input.pressed.add(action);
      input.keys.add(action);
      if (action === 'brake' || action === 'up' || action === 'down') e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) input.keys.delete(action);
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('touchstart', (e) => {
    input.usingTouch = true;
    e.preventDefault();
  }, { passive: false });

  input.endFrame = () => {
    input.pressed.clear();
    input.mouseClicked = false;
  };
  input.isDown = (action) => input.keys.has(action) || !!input.touch[action];
  input.wasPressed = (action) => input.pressed.has(action);
  return input;
}
