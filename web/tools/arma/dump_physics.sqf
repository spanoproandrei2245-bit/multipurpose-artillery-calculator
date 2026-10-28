setWind [0, 0, true];
GRAD_phys_origin = (getPosASL player) vectorAdd [0, 0, 3000];
GRAD_phys_levels = [0, 50, -50];
GRAD_phys_rounds = [
	["Sh_120mm_APFSDS_Tracer_Red", 1670],
	["Sh_120mm_HE_Tracer_Red", 1410],
	["Sh_120mm_HEAT_MP_T_Red", 1330]
];
GRAD_phys_angles = [];
for "_i" from 1 to 150 do { GRAD_phys_angles pushBack (_i * 0.02); };
for "_i" from 1 to 170 do { GRAD_phys_angles pushBack (3 + _i * 0.1); };

GRAD_phys_shots = [];
{
	_x params ["_ammo", "_speed"];
	{
		private _a = _x;
		private _dir = [0, cos _a, sin _a];
		private _p = createVehicle [_ammo, ASLToAGL GRAD_phys_origin, [], 0, "CAN_COLLIDE"];
		_p setPosASL GRAD_phys_origin;
		_p setVectorDirAndUp [_dir, [0, -(sin _a), cos _a]];
		_p setVelocity (_dir vectorMultiply _speed);
		GRAD_phys_shots pushBack [_p, _ammo, _a];
	} forEach GRAD_phys_angles;
} forEach GRAD_phys_rounds;

GRAD_phys_t0 = time;
diag_log format ["GRADBRIDGE|phys|start|shots=%1|originASL=%2", count GRAD_phys_shots, GRAD_phys_origin];

[] spawn {
	private _o = GRAD_phys_origin;
	private _levels = GRAD_phys_levels;
	private _shots = GRAD_phys_shots;
	private _n = count _shots;
	private _state = [];
	for "_i" from 0 to (_n - 1) do { _state pushBack [0, 0, 0, [false, false, false], false]; };
	private _open = _n;
	while { _open > 0 } do {
		private _t = time - GRAD_phys_t0;
		{
			private _i = _forEachIndex;
			(_state select _i) params ["_lastDz", "_lastDist", "_lastT", "_done", "_fin"];
			if (!_fin) then {
				_x params ["_p", "_ammo", "_a"];
				if (isNull _p) then {
					{
						if (!(_done select _forEachIndex)) then {
							diag_log format ["GRADBRIDGE|phys|%1|%2|lvl=%3|none", _ammo, _a, _x];
						};
					} forEach _levels;
					_state set [_i, [_lastDz, _lastDist, _lastT, _done, true]];
					_open = _open - 1;
				} else {
					private _pos = getPosASL _p;
					private _dz = (_pos select 2) - (_o select 2);
					private _dist = _o distance2D _pos;
					private _speed = vectorMagnitude (velocity _p);
					{
						private _lvl = _x;
						private _k = _forEachIndex;
						if (!(_done select _k) && {_lastDz >= _lvl} && {_dz < _lvl}) then {
							private _f = (_lastDz - _lvl) / (_lastDz - _dz);
							diag_log format [
								"GRADBRIDGE|phys|%1|%2|lvl=%3|dist=%4|tof=%5|speed=%6",
								_ammo, _a, _lvl, _lastDist + _f * (_dist - _lastDist), _lastT + _f * (_t - _lastT), _speed
							];
							_done set [_k, true];
						};
					} forEach _levels;
					if ((_done select 0) && (_done select 1) && (_done select 2)) then {
						deleteVehicle _p;
						_state set [_i, [_dz, _dist, _t, _done, true]];
						_open = _open - 1;
					} else {
						_state set [_i, [_dz, _dist, _t, _done, false]];
					};
				};
			};
		} forEach _shots;
		sleep 0.01;
	};
	diag_log "GRADBRIDGE|phys|done";
	systemChat "GRAD: physics sweep done";
};
systemChat format ["GRAD: launched %1 shells, wait for done", count GRAD_phys_shots];
