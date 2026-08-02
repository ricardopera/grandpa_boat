/**
 * Analógico de toque: a manopla segue o dedo dentro do círculo e devolve um
 * vetor entre -1 e 1 em cada eixo. Quanto mais longe do centro, mais forte —
 * dá para acelerar devagar e fazer curvas abertas, o que os botões não faziam.
 */
export class Joystick {
  constructor(base, knob, onChange) {
    this.base = base;
    this.knob = knob;
    this.onChange = onChange;
    this.pointerId = null;
    this.x = 0;
    this.y = 0;

    base.addEventListener('pointerdown', (event) => this.start(event));
    base.addEventListener('pointermove', (event) => this.move(event));
    base.addEventListener('pointerup', (event) => this.end(event));
    base.addEventListener('pointercancel', (event) => this.end(event));
    // Sem isto, arrastar para fora do círculo travaria o controle.
    base.addEventListener('lostpointercapture', () => this.reset());
  }

  get radius() {
    return this.base.clientWidth / 2 - this.knob.clientWidth / 2;
  }

  start(event) {
    if (this.pointerId !== null) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.base.setPointerCapture(event.pointerId);
    this.base.classList.add('active');
    this.move(event);
  }

  move(event) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    const rect = this.base.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);

    // Fora do círculo a manopla para na borda, mas continua apontando.
    const distance = Math.hypot(dx, dy);
    const radius = this.radius;
    if (distance > radius) {
      dx *= radius / distance;
      dy *= radius / distance;
    }

    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.x = dx / radius;
    this.y = dy / radius;
    this.onChange(this.x, this.y);
  }

  end(event) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this.reset();
  }

  reset() {
    this.pointerId = null;
    this.x = 0;
    this.y = 0;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.remove('active');
    this.onChange(0, 0);
  }
}
