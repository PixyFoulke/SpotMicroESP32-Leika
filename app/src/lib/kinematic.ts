
export interface body_state_t {
	omega: number;
	phi: number;
	psi: number;
	xm: number;
	ym: number;
	zm: number;
	feet: number[][];
}

export interface gait_state_t {
	step_height: number;
	step_x: number;
	step_z: number;
	step_angle: number;
	step_velocity: number;
}

export interface position {
	x: number;
	y: number;
	z: number;
}

export interface target_position {
	x: number;
	z: number;
	yaw: number;
}

const { cos, sin, atan2, sqrt } = Math;

const DEG2RAD = 0.017453292519943;

export default class Kinematic {
	l1: number;
	l2: number;
	l3: number;
	l4: number;

	L: number;
	W: number;

	DEG2RAD = DEG2RAD;

	sHp = sin(Math.PI / 2);
	cHp = cos(Math.PI / 2);

	Tlf: number[][] = [];
	Trf: number[][] = [];
	Tlb: number[][] = [];
	Trb: number[][] = [];

	point_lf: number[][];
	point_rf: number[][];
	point_lb: number[][];
	point_rb: number[][];
	Ix: number[][];

	constructor() {
		this.l1 = 60.5 / 100;
		this.l2 = 10 / 100;
		this.l3 = 100.7 / 100;
		this.l4 = 118.5 / 100;

		this.L = 207.5 / 100;
		this.W = 78 / 100;

		this.point_lf = [
			[this.cHp, 0, this.sHp, this.L / 2],
			[0, 1, 0, 0],
			[-this.sHp, 0, this.cHp, this.W / 2],
			[0, 0, 0, 1]
		];

		this.point_rf = [
			[this.cHp, 0, this.sHp, this.L / 2],
			[0, 1, 0, 0],
			[-this.sHp, 0, this.cHp, -this.W / 2],
			[0, 0, 0, 1]
		];

		this.point_lb = [
			[this.cHp, 0, this.sHp, -this.L / 2],
			[0, 1, 0, 0],
			[-this.sHp, 0, this.cHp, this.W / 2],
			[0, 0, 0, 1]
		];

		this.point_rb = [
			[this.cHp, 0, this.sHp, -this.L / 2],
			[0, 1, 0, 0],
			[-this.sHp, 0, this.cHp, -this.W / 2],
			[0, 0, 0, 1]
		];
		this.Ix = [
			[-1, 0, 0, 0],
			[0, 1, 0, 0],
			[0, 0, 1, 0],
			[0, 0, 0, 1]
		];
	}

	public calcIK(body_state: body_state_t): number[] {
		this.bodyIK(body_state);

		return [
			...this.legIK(this.multiplyVector(this.inverse(this.Tlf), body_state.feet[0])),
			...this.legIK(
				this.multiplyVector(
					this.Ix,
					this.multiplyVector(this.inverse(this.Trf), body_state.feet[1])
				)
			),
			...this.legIK(this.multiplyVector(this.inverse(this.Tlb), body_state.feet[2])),
			...this.legIK(
				this.multiplyVector(
					this.Ix,
					this.multiplyVector(this.inverse(this.Trb), body_state.feet[3])
				)
			)
		];
	}

	bodyIK(p: body_state_t) {
		const cos_omega = cos(p.omega * this.DEG2RAD);
		const sin_omega = sin(p.omega * this.DEG2RAD);
		const cos_phi = cos(p.phi * this.DEG2RAD);
		const sin_phi = sin(p.phi * this.DEG2RAD);
		const cos_psi = cos(p.psi * this.DEG2RAD);
		const sin_psi = sin(p.psi * this.DEG2RAD);

		const Tm: number[][] = [
			[cos_phi * cos_psi, -sin_psi * cos_phi, sin_phi, p.xm],
			[
				sin_omega * sin_phi * cos_psi + sin_psi * cos_omega,
				-sin_omega * sin_phi * sin_psi + cos_omega * cos_psi,
				-sin_omega * cos_phi,
				p.ym
			],
			[
				sin_omega * sin_psi - sin_phi * cos_omega * cos_psi,
				sin_omega * cos_psi + sin_phi * sin_psi * cos_omega,
				cos_omega * cos_phi,
				p.zm
			],
			[0, 0, 0, 1]
		];

		this.Tlf = this.matrixMultiply(Tm, this.point_lf);
		this.Trf = this.matrixMultiply(Tm, this.point_rf);
		this.Tlb = this.matrixMultiply(Tm, this.point_lb);
		this.Trb = this.matrixMultiply(Tm, this.point_rb);
	}

	public legIK(point: number[]): number[] {
		const [x, y, z] = point;

		let F = sqrt(x ** 2 + y ** 2 - this.l1 ** 2);
		if (isNaN(F)) F = this.l1;

		const G = F - this.l2;
		const H = sqrt(G ** 2 + z ** 2);

		const theta1 = -atan2(y, x) - atan2(F, -this.l1);
		const D = (H ** 2 - this.l3 ** 2 - this.l4 ** 2) / (2 * this.l3 * this.l4);
		let theta3 = atan2(sqrt(1 - D ** 2), D);
		if (isNaN(theta3)) theta3 = 0;

		const theta2 = atan2(z, G) - atan2(this.l4 * sin(theta3), this.l3 + this.l4 * cos(theta3));

		return [theta1, theta2, theta3];
	}

	matrixMultiply(a: number[][], b: number[][]): number[][] {
		const result: number[][] = [];

		for (let i = 0; i < a.length; i++) {
			const row: number[] = [];

			for (let j = 0; j < b[0].length; j++) {
				let sum = 0;

				for (let k = 0; k < a[i].length; k++) {
					sum += a[i][k] * b[k][j];
				}

				row.push(sum);
			}

			result.push(row);
		}

		return result;
	}

	multiplyVector(matrix: number[][], vector: number[]): number[] {
		const rows = matrix.length;
		const cols = matrix[0].length;
		const vectorLength = vector.length;

		if (cols !== vectorLength) {
			throw new Error('Matrix and vector dimensions do not match for multiplication.');
		}

		const result = [];

		for (let i = 0; i < rows; i++) {
			let sum = 0;

			for (let j = 0; j < cols; j++) {
				sum += matrix[i][j] * vector[j];
			}

			result.push(sum);
		}

		return result;
	}

	private inverse(matrix: number[][]): number[][] {
		const det = this.determinant(matrix);
		const adjugate = this.adjugate(matrix);
		const scalar = 1 / det;
		const inverse: number[][] = [];

		for (let i = 0; i < matrix.length; i++) {
			const row: number[] = [];

			for (let j = 0; j < matrix[i].length; j++) {
				row.push(adjugate[i][j] * scalar);
			}

			inverse.push(row);
		}

		return inverse;
	}

	private determinant(matrix: number[][]): number {
		if (matrix.length !== matrix[0].length) {
			throw new Error('The matrix is not square.');
		}

		if (matrix.length === 2) {
			return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
		}

		let det = 0;

		for (let i = 0; i < matrix.length; i++) {
			const sign = i % 2 === 0 ? 1 : -1;
			const subMatrix: number[][] = [];

			for (let j = 1; j < matrix.length; j++) {
				const row: number[] = [];

				for (let k = 0; k < matrix.length; k++) {
					if (k !== i) {
						row.push(matrix[j][k]);
					}
				}

				subMatrix.push(row);
			}

			det += sign * matrix[0][i] * this.determinant(subMatrix);
		}

		return det;
	}

	private adjugate(matrix: number[][]): number[][] {
		if (matrix.length !== matrix[0].length) {
			throw new Error('The matrix is not square.');
		}

		const adjugate: number[][] = [];

		for (let i = 0; i < matrix.length; i++) {
			const row: number[] = [];

			for (let j = 0; j < matrix[i].length; j++) {
				const sign = (i + j) % 2 === 0 ? 1 : -1;
				const subMatrix: number[][] = [];

				for (let k = 0; k < matrix.length; k++) {
					if (k !== i) {
						const subRow: number[] = [];

						for (let l = 0; l < matrix.length; l++) {
							if (l !== j) {
								subRow.push(matrix[k][l]);
							}
						}

						subMatrix.push(subRow);
					}
				}

				const cofactor = sign * this.determinant(subMatrix);
				row.push(cofactor);
			}

			adjugate.push(row);
		}

		return this.transpose(adjugate);
	}

	private transpose(matrix: number[][]): number[][] {
		const transposed: number[][] = [];

		for (let i = 0; i < matrix.length; i++) {
			const row: number[] = [];

			for (let j = 0; j < matrix[i].length; j++) {
				row.push(matrix[j][i]);
			}

			transposed.push(row);
		}

		return transposed;
	}
}

export class Command {
	public x_vel_cmd_mps = 0;
	public y_vel_cmd_mps = 0;
	public yaw_rate_cmd_rps = 0;
	public phi_cmd = 0;
	public theta_cmd = 0;
	public psi_cmd = 0;
	public idle_cmd = false;
	public walk_cmd = false;
	public stand_cmd = false;
	constructor() {}

	resetCommands() {
		this.x_vel_cmd_mps = 0;
		this.y_vel_cmd_mps = 0;
		this.yaw_rate_cmd_rps = 0;
		this.phi_cmd = 0;
		this.theta_cmd = 0;
		this.psi_cmd = 0;
		this.idle_cmd = false;
		this.walk_cmd = false;
		this.stand_cmd = false;
	}

	getXSpeedCmd() {
		return this.x_vel_cmd_mps;
	}
	getYSpeedCmd() {
		return this.y_vel_cmd_mps;
	}
	getYawRateCmd() {
		return this.yaw_rate_cmd_rps;
	}
}

const cmd = new Command();

export class GaitState {
	protected name: string;
	protected static body_state: body_state_t;
	constructor() {
		this.name = 'GaitState';
	}

	begin() {
		console.log('Starting', this.name);
	}
	end() {
		console.log('Ending', this.name);
	}
	step(dt: number) {
		console.log('Stepping', this.name);
	}

	getNeutralStance() {
		return [
			[100, -100, 100, 1],
			[100, -100, -100, 1],
			[-100, -100, 100, 1],
			[-100, -100, -100, 1]
		];
	}

	getDefaultStandHeight = () => 70;
}

export class IdleState extends GaitState {
	constructor() {
		super();
		this.name = 'Idle';
	}

	begin() {
		console.log('Starting', this.name);
	}
}

export class StandState extends GaitState {
	constructor() {
		super();
		this.name = 'Stand';
	}
}

export class WalkState extends GaitState {
	num_phases = 4;
	ticks = 0;
	constructor() {
		super();
		this.name = 'Walk';
	}

	begin() {
		super.begin();
		WalkState.body_state.feet = this.getNeutralStance();
		WalkState.body_state.omega = 0;
		WalkState.body_state.phi = 0;
		WalkState.body_state.psi = 0;
		WalkState.body_state.xm = 0;
		WalkState.body_state.ym = this.getDefaultStandHeight();
		WalkState.body_state.zm = 0;
	}
	end() {
		super.end();
	}
	step(dt: number) {
		super.end();
		this.updatePhaseData();
		WalkState.body_state.feet = this.stepGait();
		if (this.num_phases == 8) {
			const [omega, phi, psi] = this.stepBodyShift();
			WalkState.body_state.omega = omega;
			WalkState.body_state.phi = phi;
			WalkState.body_state.psi = psi;
		}
		this.ticks++;
	}

	updatePhaseData() {}

	stepGait() {
		let contact_mode;
		let swing_proportion;
		let foot_pos;
		let new_foot_pos;
		let default_stance_feet_pos = this.getNeutralStance();
	}

	stepBodyShift() {
		let omega = 0;
		let phi = 0;
		let psi = 0;
		return [omega, phi, psi];
	}
}

export class TrotState extends GaitState {
	constructor() {
		super();
		this.name = 'Trot';
	}
}

export class PhaseGaitPlanner {
	private tick = 0;
	private phase = 0;
	private phase_time = 0;
	private total_phases_length = 60;
	private num_phases = 4;
	private phase_length = this.total_phases_length / this.num_phases;
	private sub_phase_tick = 0;

	private _frame: number[][];
	private _phi: number;
	private _phi_stance: number;
	private _last_time: number;
	private _alpha: number;
	private _s: boolean;
	private _offset: number[];
	private step_offset: number;

	private contact_phases = [
		[1, 0, 1, 1],
		[1, 1, 1, 0],
		[1, 1, 1, 0],
		[1, 0, 1, 1]
	];

	private default_feet_pos = [
		[1, -1, 1, 1],
		[1, -1, -1, 1],
		[-1, -1, 1, 1],
		[-1, -1, -1, 1]
	];

	private body_state!: body_state_t;
	private gait_state!: gait_state_t;
	private dt: number = 0.02;

	constructor(mode: string) {
		this._frame = Array.from({ length: 4 }, () => Array(3).fill(0));
		this._phi = 0;
		this._phi_stance = 0;
		this._last_time = 0;
		this._alpha = 0;
		this._s = false;
		if (mode === 'walk') {
			this._offset = [0, 0.5, 0.5, 0];
			this.step_offset = 0.5;
		} else {
			this._offset = [0, 0, 0.8, 0.8];
			this.step_offset = 0.5;
		}
	}

	_loop(body_state: body_state_t, gait_state: gait_state_t, dt: number = 0.02) {
		this.body_state = body_state;
		this.gait_state = gait_state;
		this.dt = dt;
		this.update_phase();
		this.update_body_position();
		this.update_feet_positions();
		return body_state.feet;
	}

	update_phase() {
		this.tick += 1;
		this.phase_time = this.tick / this.phase_length;

		if (this.tick % this.phase_length == 0) {
			this.phase += 1;
			if (this.phase == this.num_phases) this.phase = 0;
			this.tick = 0;
		}
	}

	update_body_position() {}

	update_feet_positions() {
		for (let i = 0; i < 4; i++) {
			this.body_state.feet[i] = this.update_foot_position(i);
		}
	}

	update_foot_position(index: number): number[] {
		const contact = this.contact_phases[index][this.phase];
		return contact ? this.stand(index) : this.swing(index);
	}

	stand(index: number): number[] {
		const delta_pos = [
			(-this.gait_state.step_x * this.dt) / 3,
			0,
			(-this.gait_state.step_z * this.dt) / 3
		];

		this.body_state.feet[index][0] = this.body_state.feet[index][0] + delta_pos[0];
		this.body_state.feet[index][1] = this.default_feet_pos[index][1];
		this.body_state.feet[index][2] = this.body_state.feet[index][2] + delta_pos[2];
		return this.body_state.feet[index];
	}

	swing(index: number): number[] {
		const delta_pos = [this.gait_state.step_x * this.dt, 0, this.gait_state.step_z * this.dt];

		if (this.gait_state.step_x == 0) {
			delta_pos[0] =
				(this.default_feet_pos[index][0] - this.body_state.feet[index][0]) * this.dt * 8;
		}

		if (this.gait_state.step_z == 0) {
			delta_pos[2] =
				(this.default_feet_pos[index][2] - this.body_state.feet[index][2]) * this.dt * 8;
		}

		this.body_state.feet[index][0] = this.body_state.feet[index][0] + delta_pos[0];
		this.body_state.feet[index][1] =
			this.default_feet_pos[index][1] +
			sin(this.phase_time * Math.PI) * this.gait_state.step_height;
		this.body_state.feet[index][2] = this.body_state.feet[index][2] + delta_pos[2];
		return this.body_state.feet[index];
	}

	private static solve_bin_factor(n: number, k: number): number {
		return Number(this.factorial(n) / (this.factorial(k) * this.factorial(n - k)));
	}

	private bezier_curve(t: number, k: number, point: number): number {
		const n = 11;
		return (
			point * PhaseGaitPlanner.solve_bin_factor(n, k) * Math.pow(t, k) * Math.pow(1 - t, n - k)
		);
	}

	private static calculate_stance(phi_st: number, v: number, angle: number): number[] {
		const c = Math.cos(angle * DEG2RAD);
		const s = Math.sin(angle * DEG2RAD);
		const A = 0.001;
		const half_l = 0.05;
		const p_stance = half_l * (1 - 2 * phi_st);
		const stance_x = c * p_stance * Math.abs(v);
		const stance_y = -s * p_stance * Math.abs(v);
		const stance_z = -A * Math.cos((Math.PI / (2 * half_l)) * p_stance);
		return [stance_x, stance_y, stance_z];
	}

	private calculate_bezier_swing(
		phi_sw: number,
		v: number,
		angle: number,
		direction: number
	): number[] {
		const c = Math.cos((angle * Math.PI) / 180);
		const s = Math.sin((angle * Math.PI) / 180);
		const X = [-0.04, -0.056, -0.06, -0.06, -0.06, 0, 0, 0, 0.06, 0.06, 0.056, 0.04].map(
			(x) => Math.abs(v) * c * x * direction
		);
		const Y = X.map((x) => Math.abs(v) * s * -x);
		const Z = [0, 0, 0.0405, 0.0405, 0.0405, 0.0405, 0.0405, 0.0495, 0.0495, 0.0495, 0, 0].map(
			(x) => Math.abs(v) * x
		);
		let swing_x = 0,
			swing_y = 0,
			swing_z = 0;
		for (let i = 0; i < 10; i++) {
			swing_x += this.bezier_curve(phi_sw, i, X[i]);
			swing_y += this.bezier_curve(phi_sw, i, Y[i]);
			swing_z += this.bezier_curve(phi_sw, i, Z[i]);
		}
		return [swing_x, swing_y, swing_z];
	}

	step_trajectory(
		phi: number,
		v: number,
		angle: number,
		w_rot: number,
		center_to_foot: number[],
		direction: number
	) {
		if (phi >= 1) phi -= 1;
		const r = Math.sqrt(center_to_foot[0] ** 2 + center_to_foot[1] ** 2);
		const foot_angle = Math.atan2(center_to_foot[1], center_to_foot[0]);
		let circle_trajectory;
		if (w_rot >= 0) {
			circle_trajectory = 90 - ((foot_angle - this._alpha) * 180) / Math.PI;
		} else {
			circle_trajectory = 270 - ((foot_angle - this._alpha) * 180) / Math.PI;
		}

		let stepX_long, stepY_long, stepZ_long, stepX_rot, stepY_rot, stepZ_rot;
		if (phi <= this.step_offset) {
			const phi_stance = phi / this.step_offset;
			[stepX_long, stepY_long, stepZ_long] = PhaseGaitPlanner.calculate_stance(
				phi_stance,
				v,
				angle
			);
			[stepX_rot, stepY_rot, stepZ_rot] = PhaseGaitPlanner.calculate_stance(
				phi_stance,
				w_rot,
				circle_trajectory
			);
		} else {
			const phiSwing = (phi - this.step_offset) / (1 - this.step_offset);
			[stepX_long, stepY_long, stepZ_long] = this.calculate_bezier_swing(
				phiSwing,
				v,
				angle,
				direction
			);
			[stepX_rot, stepY_rot, stepZ_rot] = this.calculate_bezier_swing(
				phiSwing,
				w_rot,
				circle_trajectory,
				direction
			);
		}

		if (center_to_foot[1] > 0) {
			this._alpha =
				stepX_rot < 0
					? -Math.atan2(Math.sqrt(stepX_rot ** 2 + stepY_rot ** 2), r)
					: Math.atan2(Math.sqrt(stepX_rot ** 2 + stepY_rot ** 2), r);
		} else {
			this._alpha =
				stepX_rot < 0
					? Math.atan2(Math.sqrt(stepX_rot ** 2 + stepY_rot ** 2), r)
					: -Math.atan2(Math.sqrt(stepX_rot ** 2 + stepY_rot ** 2), r);
		}

		return [stepX_long + stepX_rot, stepY_long + stepY_rot, stepZ_long + stepZ_rot];
	}

	loop(v: number, angle: number, w_rot: number, t: number, direction: number, frames: number[][]) {
		if (t <= 0.01) t = 0.01;
		if (this._phi >= 0.99) this._last_time = Date.now() / 1000;
		this._phi = (Date.now() / 1000 - this._last_time) / t;

		for (let i = 0; i < 4; i++) {
			const step_coord = this.step_trajectory(
				this._phi + this._offset[i],
				v,
				angle,
				w_rot,
				frames[i],
				direction
			);
			this._frame[i] = [
				frames[i][0] + step_coord[0],
				frames[i][1] + step_coord[1],
				frames[i][2] + step_coord[2],
				1
			];
		}

		return this._frame;
	}

	private static factorial = (function () {
		const cache = [1n, 1n];
		let i = 2;

		return function (n: number) {
			if (cache[n] !== undefined) return cache[n];
			for (; i <= n; i++) {
				cache[i] = cache[i - 1] * BigInt(i);
			}
			return cache[n];
		};
	})();
}
