private _veh = vehicle player;
if (!isNil "GRAD_trackEh") then {
	if (!isNull GRAD_trackVeh) then { GRAD_trackVeh removeEventHandler ["Fired", GRAD_trackEh]; };
};
GRAD_trackVeh = _veh;
GRAD_trackShot = 0;
GRAD_trackEh = _veh addEventHandler ["Fired", {
	params ["_unit", "_weapon", "_muzzle", "_mode", "_ammo", "_mag", "_proj"];
	if (_weapon != "cannon_120mm") exitWith {};
	GRAD_trackShot = GRAD_trackShot + 1;
	private _id = GRAD_trackShot;
	private _wd = _unit weaponDirection _weapon;
	private _ed = eyeDirection player;
	private _cd = getCameraViewDirection player;
	private _v0 = velocity _proj;
	private _speed0 = vectorMagnitude _v0;
	private _pitch = (_unit call BIS_fnc_getPitchBank) select 0;
	private _pp = getPosASL _proj;
	private _muzzleAbove = (_pp select 2) - (getTerrainHeightASL _pp);
	diag_log format [
		"GRADBRIDGE|shot|%1|start|ammo=%2|mag=%3|muzzleSpeed=%4|launchElevDeg=%5|weaponElevDeg=%6|eyeElevDeg=%7|camElevDeg=%8|zeroing=%9|state=%10|vehPitchDeg=%11|posASL=%12|muzzleAboveGround=%13",
		_id, _ammo, _mag, _speed0, asin ((_v0 select 2) / (_speed0 max 0.001)), asin (_wd select 2),
		asin (_ed select 2), asin (_cd select 2), currentZeroing player, weaponState player, _pitch, _pp, _muzzleAbove
	];
	[_proj, _id] spawn {
		params ["_p", "_id"];
		private _p0 = getPosASL _p;
		private _t0 = time;
		private _last = _p0;
		private _lastV = velocity _p;
		private _logged = -1;
		while { !isNull _p } do {
			_last = getPosASL _p;
			_lastV = velocity _p;
			private _t = time - _t0;
			if (_t - _logged >= 0.05) then {
				_logged = _t;
				diag_log format [
					"GRADBRIDGE|shot|%1|s|t=%2|dist=%3|dz=%4|speed=%5",
					_id, _t, _p0 distance2D _last, (_last select 2) - (_p0 select 2), vectorMagnitude _lastV
				];
			};
			sleep 0.01;
		};
		diag_log format [
			"GRADBRIDGE|shot|%1|end|tof=%2|dist=%3|dz=%4|speed=%5",
			_id, time - _t0, _p0 distance2D _last, (_last select 2) - (_p0 select 2), vectorMagnitude _lastV
		];
	};
}];
GRAD_trackGen = (missionNamespace getVariable ["GRAD_trackGen", 0]) + 1;
[GRAD_trackGen, _veh] spawn {
	params ["_gen", "_v"];
	while { (missionNamespace getVariable ["GRAD_trackGen", 0]) == _gen && {!isNull _v} } do {
		private _wd = _v weaponDirection "cannon_120mm";
		private _md = _v vectorWorldToModel _wd;
		diag_log format [
			"GRADBRIDGE|el|world=%1|rel=%2|pitch=%3",
			asin (_wd select 2), asin (_md select 2), (_v call BIS_fnc_getPitchBank) select 0
		];
		sleep 0.5;
	};
};
systemChat format ["GRAD: tracking shots of %1, fire now", typeOf _veh];
