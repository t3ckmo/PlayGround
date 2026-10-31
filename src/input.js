const MOVE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ShiftLeft',
  'ShiftRight',
]);

export class Input {
  constructor({ canvas, joystick, joystickKnob, mineButton, placeButton, jumpButton, onFly, onPause, onHotbar }) {
    this.canvas = canvas;
    this.joystickEl = joystick;
    this.joystickKnob = joystickKnob;
    this.mineButton = mineButton;
    this.placeButton = placeButton;
    this.jumpButton = jumpButton;
    this.onFly = onFly;
    this.onPause = onPause;
    this.onHotbar = onHotbar;

    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.locked = false;
    this.ignoreLookUntil = 0;
    this.isTouch =
      window.matchMedia?.('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 820;

    this.joystick = { active: false, pointerId: null, x: 0, y: 0 };
    this.touchLook = { active: false, pointerId: null, lastX: 0, lastY: 0, startX: 0, startY: 0, startTime: 0, moved: 0 };
    this.mineHeld = false;
    this.placeHeld = false;
    this.jumpHeld = false;
    this.tapMine = false;
    this.descend = false;
    this.sprint = false;
    this.lastJumpTap = 0;

    this.bindKeyboard();
    this.bindMouse();
    this.bindTouch();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') {
        this.onPause?.();
        return;
      }
      if (event.code === 'KeyF' && !event.repeat) {
        this.onFly?.();
      }
      if (/^Digit[1-9]$/.test(event.code) && !event.repeat) {
        this.onHotbar?.(Number(event.code.slice(5)) - 1);
      }
      if (MOVE_KEYS.has(event.code)) event.preventDefault();
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mineHeld = false;
      this.placeHeld = false;
      this.jumpHeld = false;
    });
  }

  bindMouse() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) {
        // The cursor is wherever the player clicked (often the Play button),
        // so the first movement event after locking is a huge jump. Swallow it
        // instead of snapping the camera across the world.
        this.ignoreLookUntil = performance.now() + 180;
        this.lookDX = 0;
        this.lookDY = 0;
      }
      if (!this.locked && this.wasLocked) this.onPause?.();
      this.wasLocked = this.locked;
    });
    document.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      if (performance.now() < this.ignoreLookUntil) return;
      this.lookDX += event.movementX;
      this.lookDY += event.movementY;
    });
    this.canvas.addEventListener('mousedown', (event) => {
      if (this.isTouch) return;
      if (!this.locked) {
        this.requestLock();
        return;
      }
      if (event.button === 0) this.mineHeld = true;
      if (event.button === 2) this.placeHeld = true;
      event.preventDefault();
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mineHeld = false;
      if (event.button === 2) this.placeHeld = false;
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener(
      'wheel',
      (event) => {
        if (!this.locked) return;
        event.preventDefault();
        this.onHotbar?.(event.deltaY > 0 ? 1 : -1, true);
      },
      { passive: false },
    );
  }

  bindTouch() {
    const joy = this.joystickEl;
    if (!joy) return;

    const updateJoystick = (event) => {
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const max = rect.width * 0.36;
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      this.joystick.x = dx / max;
      this.joystick.y = dy / max;
      if (this.joystickKnob) {
        this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };

    const endJoystick = (event) => {
      if (this.joystick.pointerId !== null && event.pointerId !== this.joystick.pointerId) return;
      this.joystick.active = false;
      this.joystick.pointerId = null;
      this.joystick.x = 0;
      this.joystick.y = 0;
      if (this.joystickKnob) this.joystickKnob.style.transform = '';
    };

    joy.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      joy.setPointerCapture(event.pointerId);
      this.joystick.active = true;
      this.joystick.pointerId = event.pointerId;
      updateJoystick(event);
    });
    joy.addEventListener('pointermove', (event) => {
      if (!this.joystick.active || event.pointerId !== this.joystick.pointerId) return;
      event.preventDefault();
      updateJoystick(event);
    });
    joy.addEventListener('pointerup', endJoystick);
    joy.addEventListener('pointercancel', endJoystick);

    // Drag the world to look around; a short tap mines the targeted block.
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.isTouch || event.pointerType === 'mouse') return;
      this.touchLook.active = true;
      this.touchLook.pointerId = event.pointerId;
      this.touchLook.lastX = event.clientX;
      this.touchLook.lastY = event.clientY;
      this.touchLook.startX = event.clientX;
      this.touchLook.startY = event.clientY;
      this.touchLook.startTime = performance.now();
      this.touchLook.moved = 0;
      this.canvas.setPointerCapture?.(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.touchLook.active || event.pointerId !== this.touchLook.pointerId) return;
      const dx = event.clientX - this.touchLook.lastX;
      const dy = event.clientY - this.touchLook.lastY;
      this.touchLook.lastX = event.clientX;
      this.touchLook.lastY = event.clientY;
      this.touchLook.moved += Math.abs(dx) + Math.abs(dy);
      this.lookDX += dx;
      this.lookDY += dy;
    });
    const endLook = (event) => {
      if (!this.touchLook.active || event.pointerId !== this.touchLook.pointerId) return;
      this.touchLook.active = false;
      const duration = performance.now() - this.touchLook.startTime;
      if (duration < 260 && this.touchLook.moved < 12) this.tapMine = true;
    };
    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', endLook);

    const bindHold = (element, set) => {
      if (!element) return;
      element.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        element.setPointerCapture?.(event.pointerId);
        element.classList.add('active');
        set(true);
      });
      const off = (event) => {
        element.classList.remove('active');
        set(false);
      };
      element.addEventListener('pointerup', off);
      element.addEventListener('pointercancel', off);
      element.addEventListener('pointerleave', (event) => {
        if (event.buttons === 0) off(event);
      });
    };

    bindHold(this.mineButton, (v) => (this.mineHeld = v));
    bindHold(this.placeButton, (v) => (this.placeHeld = v));

    if (this.jumpButton) {
      this.jumpButton.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.jumpButton.setPointerCapture?.(event.pointerId);
        this.jumpButton.classList.add('active');
        this.jumpHeld = true;
        const now = performance.now();
        if (now - this.lastJumpTap < 320) this.onFly?.();
        this.lastJumpTap = now;
      });
      const endJump = () => {
        this.jumpButton.classList.remove('active');
        this.jumpHeld = false;
      };
      this.jumpButton.addEventListener('pointerup', endJump);
      this.jumpButton.addEventListener('pointercancel', endJump);
    }
  }

  requestLock() {
    if (this.isTouch) return;
    const result = this.canvas.requestPointerLock?.();
    if (result?.catch) result.catch(() => {});
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  takeLook() {
    const dx = this.lookDX;
    const dy = this.lookDY;
    this.lookDX = 0;
    this.lookDY = 0;
    return { dx, dy };
  }

  consumeTapMine() {
    const tap = this.tapMine;
    this.tapMine = false;
    return tap;
  }

  get move() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.joystick.active) {
      x = this.joystick.x;
      y = -this.joystick.y;
    }
    return { x, y };
  }

  get jump() {
    return this.jumpHeld || this.keys.has('Space');
  }

  get sprinting() {
    const moving = Math.hypot(this.joystick.x, this.joystick.y) > 0.92;
    return (
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      (this.joystick.active && moving)
    );
  }

  get flyingDown() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  update() {
    this.descend = this.flyingDown;
    this.sprint = this.sprinting;
  }
}
