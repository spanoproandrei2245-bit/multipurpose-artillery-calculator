if (!isNil "GRAD_hitEh") then { if (!isNull GRAD_hitVeh) then { GRAD_hitVeh removeEventHandler ["Fired", GRAD_hitEh]; }; };
GRAD_hitVeh = vehicle player;
GRAD_hitEh = GRAD_hitVeh addEventHandler ["Fired", {
	params ["_unit", "_weapon", "", "", "_ammo", "", "_proj"];
	if (_weapon != "cannon_120mm") exitWith {};
	private _v0 = velocity _proj;
	private _wd = _unit weaponDirection _weapon;
	GRAD_hitLaunch = format ["LAUNCH %1 WD_WORLD %2 WD_REL %3 ZERO %4", (asin ((_v0 select 2) / (vectorMagnitude _v0))) toFixed 3, (asin (_wd select 2)) toFixed 3, (asin ((_unit vectorWorldToModel _wd) select 2)) toFixed 3, currentZeroing player];
	GRAD_hitMiss = GRAD_hitLaunch;
	[_proj] spawn {
		params ["_p"];
		private _p0 = getPosASL _p;
		private _dt = _p0 distance2D GRAD_hitPos;
		private _prevD = 0;
		private _prevZ = _p0 select 2;
		private _done = false;
		private _last = _p0;
		while { !isNull _p } do {
			private _pos = getPosASL _p;
			private _d = _p0 distance2D _pos;
			_last = _pos;
			if (!_done && {_prevD < _dt} && {_d >= _dt}) then {
				private _z = _prevZ + (_dt - _prevD) / (_d - _prevD) * ((_pos select 2) - _prevZ);
				GRAD_hitMiss = format ["%1 | AT %2 m dz %3", GRAD_hitLaunch, _dt toFixed 0, (_z - ((GRAD_hitPos select 2) + 0.5)) toFixed 2];
				_done = true;
			};
			_prevD = _d;
			_prevZ = _pos select 2;
			sleep 0.005;
		};
		GRAD_hitMiss = format ["%1 | crossed %2 | END %3 m from target, range %4 of %5", GRAD_hitLaunch, _done, (_last distance (GRAD_hitPos vectorAdd [0, 0, 0.5])) toFixed 2, (_p0 distance2D _last) toFixed 1, _dt toFixed 1];
	};
}];
(vehicle player) lockCameraTo [GRAD_hitObj, [0], true];
GRAD_hitMiss = "ready3";
