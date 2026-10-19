import { spring } from './math.js';
/** Worker-owned critically damped channels. Retargeting preserves position and velocity. */
export class SmoothValues {
    omega;
    epsilon;
    values;
    velocities;
    constructor(initial, omega = 22, epsilon = .00001) {
        this.omega = omega;
        this.epsilon = epsilon;
        this.values = [...initial];
        this.velocities = initial.map(() => 0);
    }
    moving(target) { return target.some((value, i) => Math.abs(value - this.values[i]) > this.epsilon || Math.abs(this.velocities[i]) > this.epsilon); }
    set(target) { target.forEach((value, i) => { this.values[i] = value; this.velocities[i] = 0; }); }
    advance(target, dt) {
        target.forEach((value, i) => {
            const [position, velocity] = spring(this.values[i], this.velocities[i], value, dt, this.omega);
            if (Math.abs(value - position) < this.epsilon && Math.abs(velocity) < this.epsilon) {
                this.values[i] = value;
                this.velocities[i] = 0;
            }
            else {
                this.values[i] = position;
                this.velocities[i] = velocity;
            }
        });
    }
}
